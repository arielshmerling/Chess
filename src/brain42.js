/**
 * Brain 4.2 — negamax with alpha-beta pruning over the same legal-move tree as other brains.
 *
 * Opening book: JSONL `opening-book-states.json` — `{ state, move, weight }` per line.
 *
 * Edge scoring mirrors Brain 4.1: capture value on the move, first king/rook move penalties, pawn structure,
 * and rook file bonuses. Leaf scoring adds the same positional terms plus material for the side to move.
 * Mate / draw handling aligns with {@link ChessGame} flags ({@link MATE_SCORE} for terminal mate).
 *
 * Every tentative move uses {@link withAppliedMove} so `makeMove` / `completePromotion` always pair with
 * exactly one `undo`, including when pruning breaks out of the move loop early.
 *
 * The worker increments {@link leafEvaluationsThisSearch} once per {@link evaluateLeafPosition} call and logs
 * the total after each completed search.
 */
const { Worker, isMainThread, parentPort } = require("worker_threads");
const { ChessGame } = require("./ChessGame");
const { getDefaultConfig, sanitizeBrainConfig } = require("./modules/game/brainConfigService");
const gamesManagerService = require("./modules/gamesManager/service");
const { savedGameStateToLookupKey } = require("./openingBookJson");

const DEFAULT_MAX_DEPTH = 2;
const LOG_PREFIX = "[Brain4.2]";
/** Magnitude of a loss when the side to move is mated; dominates any material total (finite for stable arithmetic). */
const MATE_SCORE = 9_000_000_000_000_000;

let chess;
let brain42FullConfig = getDefaultConfig("brain42");
/** Plies already played before the current search root (worker loadGame clears Moves). */
let brain42RootPliesPlayed = 0;
let runtimeConfig = { pieceScores: {}, specialEvaluations: {} };

function countPiecesForColor(game, color) {
    const state = game && game.GameState;
    if (!state?.board) {
        return 0;
    }
    let count = 0;
    for (let row = 0; row < game.BOARD_ROWS; row++) {
        const boardRow = state.board[row];
        if (!boardRow) {
            continue;
        }
        for (let col = 0; col < game.BOARD_COLUMNS; col++) {
            const piece = boardRow[col];
            if (piece && piece.color === color) {
                count += 1;
            }
        }
    }
    return count;
}

function detectBrain42Phase(fullConfig, game, pliesPlayed) {
    const gp = (fullConfig && fullConfig.gamePhase) || {};
    const endMax = Number.isFinite(gp.endGameOpponentMaxPieces) ? gp.endGameOpponentMaxPieces : 8;
    const midAfter = Number.isFinite(gp.midGameAfterMoves) ? gp.midGameAfterMoves : 10;
    const plies = Number.isFinite(pliesPlayed) ? Math.max(0, Math.floor(pliesPlayed)) : 0;

    if (game && game.GameState?.board) {
        const opponent = opponentColor(game.Turn);
        const oppPieces = countPiecesForColor(game, opponent);
        const totalPieces =
            countPiecesForColor(game, "white") + countPiecesForColor(game, "black");
        if (totalPieces > 0 && oppPieces <= endMax) {
            return "endGame";
        }
    }

    if (Math.floor(plies / 2) >= midAfter) {
        return "midGame";
    }
    return "startGame";
}

function resolveBrain42ActivePhaseSettings(fullConfig, game, pliesPlayed) {
    const phase = detectBrain42Phase(fullConfig, game, pliesPlayed);
    const phaseSettings = (fullConfig && fullConfig[phase]) || (fullConfig && fullConfig.startGame) || {};
    return {
        phase,
        pieceScores: phaseSettings.pieceScores || {},
        specialEvaluations: phaseSettings.specialEvaluations || {},
        pawnFileValues: (fullConfig && fullConfig.pawnFileValues) || null,
    };
}

function setBrain42SearchContext(fullConfig, rootPliesPlayed) {
    brain42FullConfig = sanitizeBrainConfig("brain42", fullConfig || {});
    brain42RootPliesPlayed = Number.isFinite(rootPliesPlayed)
        ? Math.max(0, Math.floor(rootPliesPlayed))
        : 0;
}

function currentSearchPliesPlayed(game) {
    return brain42RootPliesPlayed + (game && game.Moves ? game.Moves.length : 0);
}

/** Applies pieceScores / specialEvaluations for the active game phase on runtimeConfig. */
function applyRuntimeConfigForGame(game) {
    const pliesPlayed = currentSearchPliesPlayed(game);
    const active = resolveBrain42ActivePhaseSettings(brain42FullConfig, game, pliesPlayed);
    runtimeConfig = {
        pieceScores: active.pieceScores,
        specialEvaluations: active.specialEvaluations,
        pawnFileValues: active.pawnFileValues,
        pawnFileTableKey: active.phase === "endGame" ? "endGame" : "openingMidGame",
    };
    return active.phase;
}

(function initBrain42RuntimeConfig() {
    const active = resolveBrain42ActivePhaseSettings(brain42FullConfig, null, 0);
    runtimeConfig = {
        pieceScores: active.pieceScores,
        specialEvaluations: active.specialEvaluations,
        pawnFileValues: active.pawnFileValues,
        pawnFileTableKey: "openingMidGame",
    };
})();

/** @type {Map<string, object[]>|null} compact state lookup key → book moves */
let openingBookByStateKey = null;
/** @type {Promise<Map<string, object[]>>|null} */
let openingBookLoadPromise = null;

function bookMovesEqual(a, b) {
    return a
        && b
        && a.source
        && b.source
        && a.target
        && b.target
        && a.source.row === b.source.row
        && a.source.col === b.source.col
        && a.target.row === b.target.row
        && a.target.col === b.target.col;
}

function addOpeningBookEntry(map, stateKey, move, weight) {
    if (typeof stateKey !== "string" || !stateKey || !move) {
        return;
    }
    const w = Number.isFinite(weight) && weight > 0 ? Math.floor(weight) : 1;
    let list = map.get(stateKey);
    if (!list) {
        list = [];
        map.set(stateKey, list);
    }
    const existing = list.find((m) => bookMovesEqual(m, move));
    if (existing) {
        existing.weight = (existing.weight || 1) + w;
        if (!existing.pgn && move.pgn) {
            existing.pgn = move.pgn;
        }
    } else {
        list.push({
            source: { row: move.source.row, col: move.source.col },
            target: { row: move.target.row, col: move.target.col },
            pgn: move.pgn,
            weight: w,
        });
    }
}

function beginOpeningBookLoad() {
    if (openingBookByStateKey) {
        return Promise.resolve(openingBookByStateKey);
    }
    if (!openingBookLoadPromise) {
        openingBookLoadPromise = gamesManagerService
            .loadOpeningBookEntries()
            .then((entries) => {
                const map = new Map();
                for (const e of entries) {
                    if (!e.state || !e.move) {
                        continue;
                    }
                    addOpeningBookEntry(map, e.state, e.move, e.weight);
                }
                openingBookByStateKey = map;
                const distinctLists = new Set(map.values());
                console.log(
                    `${LOG_PREFIX} Opening book: ${entries.length} entries, ${distinctLists.size} distinct positions`,
                );
                return map;
            })
            .catch((err) => {
                console.error(`${LOG_PREFIX} Opening book load failed:`, err.message || err);
                openingBookByStateKey = new Map();
                return openingBookByStateKey;
            });
    }
    return openingBookLoadPromise;
}

/** Start loading the opening book in the background (idempotent). */
exports.preloadOpeningBook = function preloadOpeningBook() {
    beginOpeningBookLoad();
};

/** Resolves when the opening book is loaded (starts load if needed). */
exports.whenOpeningBookReady = function whenOpeningBookReady() {
    return beginOpeningBookLoad();
};

/** Counts {@link evaluateLeafPosition} invocations per worker search; reset before each request. */
let leafEvaluationsThisSearch = 0;

exports.Name = "Brain 4.2";

let persistentWorker = null;
let requestIdCounter = 0;
const pendingRequests = new Map();

function getOrCreateWorker() {
    if (!isMainThread) {
        throw new Error("getOrCreateWorker called from worker thread");
    }
    if (!persistentWorker) {
        console.log(`${LOG_PREFIX} Creating persistent worker thread...`);
        persistentWorker = new Worker(__filename);

        persistentWorker.on("message", (response) => {
            const { requestId, move, error } = response;
            const pending = pendingRequests.get(requestId);
            if (pending) {
                pendingRequests.delete(requestId);
                clearTimeout(pending.timeout);
                if (error) {
                    pending.reject(new Error(error));
                } else if (move) {
                    pending.resolve(move);
                } else {
                    pending.reject(new Error("Worker returned null move"));
                }
            }
        });

        persistentWorker.on("error", (err) => {
            console.error(`${LOG_PREFIX} Persistent worker thread error:`, err);
            for (const [, pending] of pendingRequests.entries()) {
                clearTimeout(pending.timeout);
                pending.reject(err);
            }
            pendingRequests.clear();
            persistentWorker = null;
        });

        persistentWorker.on("exit", (code) => {
            if (code !== 0) {
                console.error(`${LOG_PREFIX} Persistent worker thread exited with code ${code}`);
            }
            for (const [, pending] of pendingRequests.entries()) {
                clearTimeout(pending.timeout);
                pending.reject(new Error(`Worker thread exited with code ${code}`));
            }
            pendingRequests.clear();
            persistentWorker = null;
        });
    }
    return persistentWorker;
}

function createWorkerPromise(strState, maxDepth, config, pliesPlayed) {
    return new Promise((resolve, reject) => {
        if (!isMainThread) {
            reject(new Error("createWorkerPromise called from worker thread"));
            return;
        }
        const requestId = ++requestIdCounter;
        const worker = getOrCreateWorker();
        const depthLimit = maxDepth != null ? Math.min(5, Math.max(1, Number(maxDepth))) : DEFAULT_MAX_DEPTH;
        const timeout = setTimeout(() => {
            const pending = pendingRequests.get(requestId);
            if (pending) {
                pendingRequests.delete(requestId);
                console.error(`${LOG_PREFIX} move timeout for request ${requestId}`);
                reject(new Error("Brain move timeout"));
            }
        }, 120000);

        pendingRequests.set(requestId, { resolve, reject, timeout });
        worker.postMessage({
            requestId,
            gameState: strState,
            maxDepth: depthLimit,
            config,
            pliesPlayed,
        });
    });
}

class BrainTimeoutFallbackError extends Error {
    constructor(move) {
        super("Brain move timeout - using fallback move");
        this.name = "BrainTimeoutFallbackError";
        this.fallbackMove = move;
    }
}

function isBookMoveStillLegal(game, move) {
    if (!move || move.source == null || move.target == null) {
        return false;
    }
    if (
        typeof move.source.row !== "number"
        || typeof move.source.col !== "number"
        || typeof move.target.row !== "number"
        || typeof move.target.col !== "number"
    ) {
        return false;
    }
    return !!game.validateMove(move.source, move.target, game.Turn).valid;
}

function formatStateForLog(stateKey) {
    return stateKey;
}

function bookMovePgn(game, bookMove) {
    if (bookMove && typeof bookMove.pgn === "string" && bookMove.pgn) {
        return bookMove.pgn;
    }
    try {
        return game.getSimpleNotation(bookMove);
    } catch {
        if (bookMove && bookMove.source && bookMove.target) {
            return `[${bookMove.source.row},${bookMove.source.col}]→[${bookMove.target.row},${bookMove.target.col}]`;
        }
        return "?";
    }
}

function logOpeningBookOptions(game, options) {
    const pgns = options.map((m) => {
        const w = m.weight || 1;
        return `${bookMovePgn(game, m)} (${w})`;
    });
    console.log(`${LOG_PREFIX} Opening book options: ${pgns.join(", ")}`);
}

function logTiedBestMoveOptions(game, options, bestScore) {
    const pgns = options.map((m) => bookMovePgn(game, m));
    console.log(
        `${LOG_PREFIX} Equal best score ${bestScore}; ${options.length} move(s), picking randomly: ${pgns.join(", ")}`,
    );
}

function pickWeightedBookMove(options) {
    if (options.length === 0) {
        return null;
    }
    let total = 0;
    for (let i = 0; i < options.length; i++) {
        total += options[i].weight || 1;
    }
    let r = Math.random() * total;
    for (let i = 0; i < options.length; i++) {
        r -= options[i].weight || 1;
        if (r <= 0) {
            return options[i];
        }
    }
    return options[options.length - 1];
}

function tryFindMatchState(game) {
    const stateKey = savedGameStateToLookupKey(game.SavedGameState);

    if (!openingBookByStateKey) {
        console.log(
            `${LOG_PREFIX} Opening book search (book not loaded): turn=${game.Turn}\n${(stateKey)}`,
        );
        return null;
    }

    const options = openingBookByStateKey.get(stateKey) || [];
    console.log(
        `${LOG_PREFIX} Opening book search: turn=${game.Turn},`
            + ` bookPositions=${openingBookByStateKey.size},`
            + ` movesAtPosition=${options.length}\n${(stateKey)}`,
    );

    if (options.length === 0) {
        console.log(`${LOG_PREFIX} Opening book miss: no entry for this state key (turn=${game.Turn})`);
        return null;
    }

    logOpeningBookOptions(game, options);

    const legal = options.filter((m) => isBookMoveStillLegal(game, m));
    if (legal.length === 0) {
        console.warn(
            `${LOG_PREFIX} Opening book: ${options.length} stored move(s) but none legal at this position`,
        );
        return null;
    }

    const pick = pickWeightedBookMove(legal);
    console.log(
        `${LOG_PREFIX} Opening book pick: ${bookMovePgn(game, pick)}`
            + ` (weight ${pick.weight || 1}, ${legal.length} legal option(s))`,
    );
    return pick;
}

exports.brainNextMoveFunc = async (game, options) => {
    const pliesPlayed = options?.pliesPlayed ?? (game.Moves ? game.Moves.length : 0);
    setBrain42SearchContext(options?.config || {}, pliesPlayed);
    const phase = applyRuntimeConfigForGame(game);
    console.log(`${LOG_PREFIX} Game phase: ${phase} (plies=${pliesPlayed})`);
    const state = game.GameState;
    if (!Array.isArray(state.capturedPiecesList)) {
        state.capturedPiecesList = [];
    }
    const strState = JSON.stringify(state);
    const maxDepth = options?.maxDepth != null ? Math.min(5, Math.max(1, Number(options.maxDepth))) : DEFAULT_MAX_DEPTH;

    const mateNow = findImmediateMatingMove(game, collectLegalMoves(game));
    if (mateNow) {
        return mateNow;
    }

    const bookMove = tryFindMatchState(game);
    if (bookMove && isBookMoveStillLegal(game, bookMove)) {
        console.log(
            `${LOG_PREFIX} Opening book hit: ${bookMovePgn(game, bookMove)} (positions evaluated: 0)`,
        );
        return bookMove;
    }

    try {
        return await createWorkerPromise(strState, maxDepth, brain42FullConfig, pliesPlayed);
    } catch (err) {
        console.warn(`${LOG_PREFIX} First worker attempt failed: ${err.message}`);
        try {
            return await createWorkerPromise(strState, maxDepth, brain42FullConfig, pliesPlayed);
        } catch {
            const fallbackMove = getFirstLegalMove(game);
            if (!fallbackMove) {
                throw new Error("No legal moves available (checkmate or stalemate)");
            }
            throw new BrainTimeoutFallbackError(fallbackMove);
        }
    }
};

exports.BrainTimeoutFallbackError = BrainTimeoutFallbackError;

// --- Search (worker thread) -------------------------------------------------

function pieceValue(game, pieceType) {
    const scores = runtimeConfig.pieceScores;
    switch (pieceType) {
        case game.PAWN:
            return scores.pawn;
        case game.ROOK:
            return scores.rook;
        case game.KNIGHT:
            return scores.knight;
        case game.BISHOP:
            return scores.bishop;
        case game.QUEEN:
            return scores.queen;
        case game.KING:
            return scores.king;
        default:
            return 0;
    }
}

/** Multiplier for pawn on file `col` (0=a … 7=h); 1 when no table configured. */
function pawnFileMultiplier(col) {
    const pfv = runtimeConfig.pawnFileValues;
    if (!pfv || typeof col !== "number" || col < 0 || col > 7) {
        return 1;
    }
    const tableKey = runtimeConfig.pawnFileTableKey || "openingMidGame";
    const table = pfv[tableKey];
    if (!table) {
        return 1;
    }
    const file = "abcdefgh"[col];
    const mult = table[file];
    return Number.isFinite(mult) ? mult : 1;
}

function pieceValueOnSquare(game, piece, col) {
    if (!piece) {
        return 0;
    }
    if (piece.pieceType === game.PAWN) {
        return pieceValue(game, game.PAWN) * pawnFileMultiplier(col);
    }
    return pieceValue(game, piece.pieceType);
}

function specialEvaluations() {
    return runtimeConfig.specialEvaluations || {};
}

function isCastlingKingMove(game, move) {
    if (!move.piece || move.piece.pieceType !== game.KING) {
        return false;
    }
    if (move.source.row !== move.target.row) {
        return false;
    }
    return Math.abs(move.target.col - move.source.col) === 2;
}

function getFirstKingRookMovePenaltyDelta(game, move, se) {
    const kPen = Number(se.firstKingMovePenalty) || 0;
    const rPen = Number(se.firstRookMovePenalty) || 0;
    if (kPen === 0 && rPen === 0) {
        return 0;
    }
    const state = game.GameState;
    if (!state || !move.piece) {
        return 0;
    }
    const wpv = state.whitePlayerView !== false;
    const kingsideRookCol = wpv ? 7 : 0;
    const queensideRookCol = wpv ? 0 : 7;
    let units = 0;
    if (kPen !== 0 && move.piece.pieceType === game.KING) {
        const isFirst = (move.piece.color === "white" && !state.whiteKingMoved)
            || (move.piece.color === "black" && !state.blackKingMoved);
        if (isFirst && !isCastlingKingMove(game, move)) {
            units += kPen;
        }
    }
    if (rPen !== 0 && move.piece.pieceType === game.ROOK) {
        const c = move.piece.color;
        if (c === "white") {
            if (move.source.col === kingsideRookCol && !state.kingsideWhiteRookMoved) {
                units += rPen;
            } else if (move.source.col === queensideRookCol && !state.queensideWhiteRookMoved) {
                units += rPen;
            }
        } else if (c === "black") {
            if (move.source.col === kingsideRookCol && !state.kingsideBlackRookMoved) {
                units += rPen;
            } else if (move.source.col === queensideRookCol && !state.queensideBlackRookMoved) {
                units += rPen;
            }
        }
    }
    if (units === 0) {
        return 0;
    }
    return -units;
}

function getCurrentPlayerDoubledPawnCount(game) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    const currentColor = game.Turn;
    let doubledCount = 0;
    for (let col = 0; col < 8; col++) {
        let pawnsInFile = 0;
        for (let row = 0; row < 8; row++) {
            const piece = state.board[row][col];
            if (piece && piece.color === currentColor && piece.pieceType === game.PAWN) {
                pawnsInFile += 1;
            }
        }
        if (pawnsInFile >= 2) {
            doubledCount += pawnsInFile;
        }
    }
    return doubledCount;
}

/**
 * Stacked advanced-pawn bonus fraction (× pawn value on that square).
 * White: rank 5/6/7 (rows 3/2/1) → 20% / 40% / 60% per pawnAdvancedBonus step.
 * Black: rank 4/3/2 (rows 4/5/6) → 20% / 40% / 60%.
 */
function getAdvancedPawnBonusFraction(row, color, bonusPerRank) {
    const step = Number(bonusPerRank);
    if (!Number.isFinite(step) || step <= 0) {
        return 0;
    }
    if (color === "white") {
        if (row === 3) {
            return step;
        }
        if (row === 2) {
            return step * 2;
        }
        if (row === 1) {
            return step * 3;
        }
        return 0;
    }
    if (color === "black") {
        if (row === 4) {
            return step;
        }
        if (row === 5) {
            return step * 2;
        }
        if (row === 6) {
            return step * 3;
        }
        return 0;
    }
    return 0;
}

function isAdvancedPawnRankForColor(row, color) {
    return getAdvancedPawnBonusFraction(row, color, 1) > 0;
}

function getAdvancedPawnBonusForColor(game, color, se) {
    const pab = Number(se.pawnAdvancedBonus) || 0;
    if (pab === 0) {
        return 0;
    }
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    let total = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state.board[row][col];
            if (!piece || piece.color !== color || piece.pieceType !== game.PAWN) {
                continue;
            }
            const frac = getAdvancedPawnBonusFraction(row, color, pab);
            if (frac > 0) {
                total += pieceValueOnSquare(game, piece, col) * frac;
            }
        }
    }
    return total;
}

function getCurrentPlayerAdvancedPawnCount(game) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    const currentColor = game.Turn;
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state.board[row][col];
            if (!piece || piece.color !== currentColor || piece.pieceType !== game.PAWN) {
                continue;
            }
            if (isAdvancedPawnRankForColor(row, currentColor)) {
                count += 1;
            }
        }
    }
    return count;
}

/**
 * Pawn chains for the side to move: each chain is a run of adjacent files (columns)
 * that contain at least one friendly pawn. Rank does not matter; pawns need not
 * defend each other. Example: pawns on c3, d6, e5, f2 => one chain (files c–f).
 */
function getCurrentPlayerPawnChainCount(game) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    const currentColor = game.Turn;
    const filesWithPawns = [];
    for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 8; row++) {
            const piece = state.board[row][col];
            if (piece && piece.color === currentColor && piece.pieceType === game.PAWN) {
                filesWithPawns.push(col);
                break;
            }
        }
    }
    if (filesWithPawns.length === 0) {
        return 0;
    }
    let chains = 1;
    for (let i = 1; i < filesWithPawns.length; i++) {
        if (filesWithPawns[i] !== filesWithPawns[i - 1] + 1) {
            chains += 1;
        }
    }
    return chains;
}

function getPawnChainCountEvalDelta(game, se) {
    const p = Number(se.pawnsChainCountPenalty) || 0;
    if (p === 0) {
        return 0;
    }
    const c = getCurrentPlayerPawnChainCount(game);
    if (c <= 1) {
        return 0;
    }
    return -(c - 1) * p;
}

function isBoardFileFullyOpen(game, col) {
    const state = game.GameState;
    const board = state?.board;
    if (!board) {
        return false;
    }
    const pawn = game.PAWN;
    for (let row = 0; row < 8; row++) {
        const p = board[row][col];
        if (p && p.pieceType === pawn) {
            return false;
        }
    }
    return true;
}

function isRookOnInvadingSeventhRowForColor(row, color) {
    if (color === "white") {
        return row === 1;
    }
    if (color === "black") {
        return row === 6;
    }
    return false;
}

function getBestOpenRookSeventhBonusDelta(game, se) {
    const raw = se.bestOpenRookOnSeventhMultiplier;
    const mult = Number.isFinite(Number(raw)) ? Number(raw) : 1.25;
    if (mult <= 1) {
        return 0;
    }
    const state = game.GameState;
    const board = state?.board;
    if (!board) {
        return 0;
    }
    const side = game.Turn;
    const rookT = game.ROOK;
    const rookScore = pieceValue(game, rookT);
    const extraPerRook = (mult - 1) * rookScore;
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (
                piece
                && piece.color === side
                && piece.pieceType === rookT
                && isRookOnInvadingSeventhRowForColor(row, side)
                && isBoardFileFullyOpen(game, col)
            ) {
                count += 1;
            }
        }
    }
    return count * extraPerRook;
}

function getVeryGoodOpenFileRookBonusDelta(game, se) {
    const raw = se.veryGoodOpenRookMultiplier;
    const mult = Number.isFinite(Number(raw)) ? Number(raw) : 1.125;
    if (mult <= 1) {
        return 0;
    }
    const state = game.GameState;
    const board = state?.board;
    if (!board) {
        return 0;
    }
    const side = game.Turn;
    const rookT = game.ROOK;
    const rookScore = pieceValue(game, rookT);
    const extraPerRook = (mult - 1) * rookScore;
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === side && piece.pieceType === rookT && isBoardFileFullyOpen(game, col)) {
                count += 1;
            }
        }
    }
    return count * extraPerRook;
}

function isBoardFileClosedForRook(game, col) {
    return !isBoardFileFullyOpen(game, col);
}

function getPoorClosedFileRookPenaltyDelta(game, se) {
    const raw = se.poorClosedFileRookMultiplier;
    const mult = Number.isFinite(Number(raw)) ? Number(raw) : 0.75;
    if (mult >= 1) {
        return 0;
    }
    const state = game.GameState;
    const board = state?.board;
    if (!board) {
        return 0;
    }
    const side = game.Turn;
    const rookT = game.ROOK;
    const rookScore = pieceValue(game, rookT);
    const deltaPerRook = (mult - 1) * rookScore;
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === side && piece.pieceType === rookT && isBoardFileClosedForRook(game, col)) {
                count += 1;
            }
        }
    }
    if (count === 0) {
        return 0;
    }
    return count * deltaPerRook;
}

/** Doubled pawns: −count × doublePawnPenalty × pawn value; advanced: stacked rank bonus per pawn. */
function getPawnEvalDelta(game, se) {
    const dpp = Number(se.doublePawnPenalty) || 0;
    const pv = pieceValue(game, game.PAWN);
    return -getCurrentPlayerDoubledPawnCount(game) * dpp * pv
        + getAdvancedPawnBonusForColor(game, game.Turn, se);
}

function getTotalMaterialValueForColor(game, color) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    let total = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state.board[row][col];
            if (piece && piece.color === color) {
                total += pieceValueOnSquare(game, piece, col);
            }
        }
    }
    return total;
}

function getDrawLeafScoreForMover(game, movingPlayerColor, se) {
    const thrRaw = Number(se.drawMaterialDiffThreshold);
    const threshold = Number.isFinite(thrRaw) ? thrRaw : 3;
    const opponent = movingPlayerColor === "white" ? "black" : "white";
    const my = getTotalMaterialValueForColor(game, movingPlayerColor);
    const op = getTotalMaterialValueForColor(game, opponent);
    const diff = my - op;
    if (diff >= threshold) {
        const v = Number(se.drawScoreWhenAhead);
        return Number.isFinite(v) ? v : -5;
    }
    if (diff <= -threshold) {
        const v = Number(se.drawScoreWhenBehind);
        return Number.isFinite(v) ? v : 5;
    }
    const v = Number(se.drawScoreWhenEven);
    return Number.isFinite(v) ? v : -0.1;
}

function positionalBonusesForSideToMove(game) {
    const se = specialEvaluations();
    return getPawnEvalDelta(game, se)
        + getPawnChainCountEvalDelta(game, se)
        + getBestOpenRookSeventhBonusDelta(game, se)
        + getVeryGoodOpenFileRookBonusDelta(game, se)
        + getPoorClosedFileRookPenaltyDelta(game, se);
}

/** Brain 4.1-style move-local score before recursion (same board, candidate move). */
function stateScoreForMove(game, move) {
    const state = game.GameState;
    const targetPiece = state.board[move.target.row][move.target.col];
    let score = 0;
    if (targetPiece != null) {
        score = pieceValueOnSquare(game, targetPiece, move.target.col);
    }
    const se = specialEvaluations();
    score += getPawnEvalDelta(game, se);
    score += getPawnChainCountEvalDelta(game, se);
    score += getFirstKingRookMovePenaltyDelta(game, move, se);
    score += getBestOpenRookSeventhBonusDelta(game, se);
    score += getVeryGoodOpenFileRookBonusDelta(game, se);
    score += getPoorClosedFileRookPenaltyDelta(game, se);
    return score;
}

/**
 * Immediate score for playing `move` (promotion / mate / draw / repetition bonuses), without recursion.
 * Uses its own make/undo so {@link withAppliedMove} can stay nested for search.
 */
function immediateLineScoreForMove(game, move) {
    applyRuntimeConfigForGame(game);
    const movingPlayer = game.Turn;
    let score = stateScoreForMove(game, move);
    game.makeMove(move.source, move.target);
    try {
        if (move.promotion) {
            game.completePromotion(move);
            switch (move.selectedPiece) {
                case game.QUEEN:
                    score = pieceValue(game, game.QUEEN);
                    break;
                case game.ROOK:
                    score = pieceValue(game, game.ROOK);
                    break;
                case game.KNIGHT:
                    score = pieceValue(game, game.KNIGHT);
                    break;
                case game.BISHOP:
                    score = pieceValue(game, game.BISHOP);
                    break;
                default:
                    break;
            }
        }
        if (game.Checkmate) {
            score = MATE_SCORE;
        }
        if (game.Draw) {
            score = getDrawLeafScoreForMover(game, movingPlayer, specialEvaluations());
        }
        if (game.Moves.length > 50 && game.Check) {
            score += 2.5;
        }
        return score;
    } finally {
        game.undo();
    }
}

function materialDifferenceForSideToMove(game) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    const side = game.Turn;
    let mine = 0;
    let theirs = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = state.board[r][c];
            if (!p) {
                continue;
            }
            const v = pieceValueOnSquare(game, p, c);
            if (p.color === side) {
                mine += v;
            } else {
                theirs += v;
            }
        }
    }
    return mine - theirs;
}

/** Leaf: material + positional terms for side to move (no move-specific king/rook first penalty). */
function evaluateLeafPosition(game) {
    applyRuntimeConfigForGame(game);
    leafEvaluationsThisSearch += 1;
    if (game.Checkmate) {
        return -MATE_SCORE;
    }
    if (game.Draw) {
        return 0;
    }
    return materialDifferenceForSideToMove(game) + positionalBonusesForSideToMove(game);
}

function roundEvalScore(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.round(value * 100) / 100;
}

function pieceLabel(game, pieceType) {
    switch (pieceType) {
        case game.PAWN:
            return "Pawn";
        case game.ROOK:
            return "Rook";
        case game.KNIGHT:
            return "Knight";
        case game.BISHOP:
            return "Bishop";
        case game.QUEEN:
            return "Queen";
        case game.KING:
            return "King";
        default:
            return "Piece";
    }
}

function opponentColor(color) {
    return color === "white" ? "black" : "white";
}

function withEvalTurn(game, color, fn) {
    const state = game.GameState;
    const prev = state ? state.turn : null;
    if (state) {
        state.turn = color;
    }
    try {
        return fn();
    } finally {
        if (state) {
            state.turn = prev;
        }
    }
}

function countPawnsInFileForColor(game, col, color) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    let count = 0;
    for (let row = 0; row < 8; row++) {
        const piece = state.board[row][col];
        if (piece && piece.color === color && piece.pieceType === game.PAWN) {
            count += 1;
        }
    }
    return count;
}

function getPawnEvalDeltaParts(game, se) {
    const dpp = Number(se.doublePawnPenalty) || 0;
    const pv = pieceValue(game, game.PAWN);
    return {
        doubled: -getCurrentPlayerDoubledPawnCount(game) * dpp * pv,
        advanced: getAdvancedPawnBonusForColor(game, game.Turn, se),
    };
}

function getPawnEvalDeltaPartsForColor(game, color, se) {
    return withEvalTurn(game, color, () => getPawnEvalDeltaParts(game, se));
}

function getPawnChainCountForColor(game, color) {
    return withEvalTurn(game, color, () => getCurrentPlayerPawnChainCount(game));
}

function getPawnChainPenaltyForColor(game, color, se) {
    return withEvalTurn(game, color, () => getPawnChainCountEvalDelta(game, se));
}

function positionalScoreForColor(game, color) {
    return withEvalTurn(game, color, () => positionalBonusesForSideToMove(game));
}

function signedForPerspective(value, pieceColor, perspectiveColor) {
    return pieceColor === perspectiveColor ? value : -value;
}

function getSquarePawnPositionalBreakdown(game, row, col, se, perspectiveColor) {
    const state = game.GameState;
    const piece = state?.board?.[row]?.[col];
    const breakdown = [];
    if (!piece || piece.pieceType !== game.PAWN) {
        return breakdown;
    }
    const dpp = Number(se.doublePawnPenalty) || 0;
    if (dpp !== 0 && countPawnsInFileForColor(game, col, piece.color) >= 2) {
        const penalty = -dpp * pieceValueOnSquare(game, piece, col);
        breakdown.push({
            label: piece.color === perspectiveColor ? "Doubled pawn penalty" : "Opponent doubled pawn penalty",
            value: roundEvalScore(signedForPerspective(penalty, piece.color, perspectiveColor)),
        });
    }
    const pab = Number(se.pawnAdvancedBonus) || 0;
    const frac = getAdvancedPawnBonusFraction(row, piece.color, pab);
    if (frac > 0) {
        const bonus = pieceValueOnSquare(game, piece, col) * frac;
        const pct = Math.round(frac * 100);
        breakdown.push({
            label: piece.color === perspectiveColor
                ? `Advanced pawn bonus (+${pct}%)`
                : `Opponent advanced pawn bonus (+${pct}%)`,
            value: roundEvalScore(signedForPerspective(bonus, piece.color, perspectiveColor)),
        });
    }
    return breakdown;
}

function getSquareRookPositionalBreakdown(game, row, col, se, perspectiveColor) {
    const state = game.GameState;
    const piece = state?.board?.[row]?.[col];
    const breakdown = [];
    if (!piece || piece.pieceType !== game.ROOK) {
        return breakdown;
    }
    const rookScore = pieceValue(game, game.ROOK);
    const openFile = isBoardFileFullyOpen(game, col);
    if (openFile) {
        const openMult = Number.isFinite(Number(se.veryGoodOpenRookMultiplier))
            ? Number(se.veryGoodOpenRookMultiplier)
            : 1.125;
        if (openMult > 1) {
            const bonus = (openMult - 1) * rookScore;
            breakdown.push({
                label: piece.color === perspectiveColor ? "Open file rook bonus" : "Opponent open file rook bonus",
                value: roundEvalScore(signedForPerspective(bonus, piece.color, perspectiveColor)),
            });
        }
        const seventhMult = Number.isFinite(Number(se.bestOpenRookOnSeventhMultiplier))
            ? Number(se.bestOpenRookOnSeventhMultiplier)
            : 1.25;
        if (
            seventhMult > 1
            && isRookOnInvadingSeventhRowForColor(row, piece.color)
        ) {
            const bonus = (seventhMult - 1) * rookScore;
            breakdown.push({
                label: piece.color === perspectiveColor ? "Rook on 7th rank bonus" : "Opponent rook on 7th rank bonus",
                value: roundEvalScore(signedForPerspective(bonus, piece.color, perspectiveColor)),
            });
        }
    } else {
        const closedMult = Number.isFinite(Number(se.poorClosedFileRookMultiplier))
            ? Number(se.poorClosedFileRookMultiplier)
            : 0.75;
        if (closedMult < 1) {
            const penalty = (closedMult - 1) * rookScore;
            breakdown.push({
                label: piece.color === perspectiveColor ? "Closed file rook penalty" : "Opponent closed file rook penalty",
                value: roundEvalScore(signedForPerspective(penalty, piece.color, perspectiveColor)),
            });
        }
    }
    return breakdown;
}

function formatBrain42PhaseLabel(phase) {
    switch (phase) {
        case "startGame":
            return "Start game";
        case "midGame":
            return "Mid game";
        case "endGame":
            return "End game";
        default:
            return phase || "Start game";
    }
}

/** Status-bar tooltip: game phase, per-color piece score total and pawn chain count. */
function buildPositionSummaryBreakdown(game, squares, phase) {
    const totals = { white: 0, black: 0 };
    (squares || []).forEach((sq) => {
        const color = sq.piece && sq.piece.color;
        if (color === "white" || color === "black") {
            totals[color] += sq.score;
        }
    });
    const colorLines = ["white", "black"].map((color) => {
        const chainCount = getPawnChainCountForColor(game, color);
        const chainWord = chainCount === 1 ? "chain" : "chains";
        return {
            label: color === "white" ? "White" : "Black",
            value: roundEvalScore(totals[color]),
            text: `${chainCount} pawn ${chainWord}`,
        };
    });
    return [
        {
            label: "Game mode",
            text: formatBrain42PhaseLabel(phase),
        },
        ...colorLines,
    ];
}

/**
 * Static position evaluation for UI display (material + positional terms for side to move).
 * @param {import("./ChessGame").ChessGame} game
 * @param {{ config?: object }} [options]
 * @returns {{
 *   total: number,
 *   sideToMove: string,
 *   terminal: string|null,
 *   gamePhase: string,
 *   summary: { label: string, value?: number, text?: string }[],
 *   squares: { row: number, col: number, piece: { color: string, pieceType: number }, score: number, breakdown: { label: string, value: number }[] }[]
 * }}
 */
function evaluatePositionDisplay(game, options) {
    const pliesPlayed = options?.pliesPlayed ?? (game.Moves ? game.Moves.length : 0);
    setBrain42SearchContext(options?.config || brain42FullConfig, pliesPlayed);
    const phase = applyRuntimeConfigForGame(game);
    console.log(`${LOG_PREFIX} Display eval phase: ${phase} (plies=${pliesPlayed})`);
    const se = specialEvaluations();
    const side = game.Turn;
    let total;
    let terminal = null;
    if (game.Checkmate) {
        total = -MATE_SCORE;
        terminal = "checkmate";
    } else if (game.Draw) {
        total = 0;
        terminal = "draw";
    } else {
        total = materialDifferenceForSideToMove(game)
            + positionalScoreForColor(game, side)
            - positionalScoreForColor(game, opponentColor(side));
    }
    total = roundEvalScore(total);

    const squares = [];
    const state = game.GameState;
    if (state?.board) {
        for (let row = 0; row < game.BOARD_ROWS; row++) {
            for (let col = 0; col < game.BOARD_COLUMNS; col++) {
                const piece = state.board[row][col];
                if (!piece) {
                    continue;
                }
                const isMine = piece.color === side;
                const materialValue = pieceValueOnSquare(game, piece, col);
                const signedMaterial = isMine ? materialValue : -materialValue;
                let materialLabel = `${pieceLabel(game, piece.pieceType)} material`;
                if (piece.pieceType === game.PAWN && pawnFileMultiplier(col) !== 1) {
                    materialLabel += ` (${"abcdefgh"[col]}-file)`;
                }
                const breakdown = [
                    {
                        label: materialLabel,
                        value: roundEvalScore(signedMaterial),
                    },
                ];
                breakdown.push(...getSquarePawnPositionalBreakdown(game, row, col, se, side));
                breakdown.push(...getSquareRookPositionalBreakdown(game, row, col, se, side));
                let score = breakdown.reduce((sum, item) => sum + item.value, 0);
                score = roundEvalScore(score);
                squares.push({
                    row,
                    col,
                    piece: { color: piece.color, pieceType: piece.pieceType },
                    score,
                    breakdown,
                });
            }
        }
    }

    return {
        total,
        sideToMove: side,
        terminal,
        gamePhase: phase,
        summary: buildPositionSummaryBreakdown(game, squares, phase),
        squares,
    };
}

exports.evaluatePositionDisplay = evaluatePositionDisplay;
exports.detectBrain42Phase = detectBrain42Phase;
exports.countPiecesForColor = countPiecesForColor;
exports.resolveBrain42ActivePhaseSettings = resolveBrain42ActivePhaseSettings;
exports.getAdvancedPawnBonusFraction = getAdvancedPawnBonusFraction;
exports.getAdvancedPawnBonusForColor = getAdvancedPawnBonusForColor;

function collectLegalMoves(game) {
    const state = game.GameState;
    if (!state || !state.board) {
        return [];
    }
    const turn = game.Turn;
    let moves = [];
    for (let i = 0; i < game.BOARD_ROWS; i++) {
        const row = state.board[i];
        if (!row) {
            continue;
        }
        for (let j = 0; j < game.BOARD_COLUMNS; j++) {
            const piece = row[j];
            if (!piece || piece.color !== turn) {
                continue;
            }
            const source = game.square(i, j);
            let options;
            try {
                options = game.possibleMoves(source);
            } catch (err) {
                console.error("[Brain4.2] possibleMoves failed at", i, j, err);
                continue;
            }
            if (options.length > 0) {
                for (const move of options) {
                    moves = moves.concat(move);
                }
            }
        }
    }
    return moves;
}

function getFirstLegalMove(game) {
    const moves = collectLegalMoves(game);
    return moves.length > 0 ? moves[0] : null;
}

function orderMovesCapturesFirst(game, moves) {
    const state = game.GameState;
    if (!state?.board?.length || moves.length <= 1) {
        return moves.slice();
    }
    return moves.slice().sort((a, b) => {
        const capA = state.board[a.target.row]?.[a.target.col];
        const capB = state.board[b.target.row]?.[b.target.col];
        const va = capA ? pieceValueOnSquare(game, capA, a.target.col) : 0;
        const vb = capB ? pieceValueOnSquare(game, capB, b.target.col) : 0;
        return vb - va;
    });
}

/**
 * Applies a legal move, runs `fn`, then always undoes once — even if `fn` throws or search prunes.
 * @template T
 * @param {import("./ChessGame").ChessGame} game
 * @param {object} move
 * @param {() => T} fn
 * @returns {T}
 */
function withAppliedMove(game, move, fn) {
    game.makeMove(move.source, move.target);
    try {
        if (move.promotion) {
            game.completePromotion(move);
        }
        return fn();
    } finally {
        game.undo();
    }
}

function scoreTerminalNoMoves(game) {
    if (game.Checkmate) {
        return -MATE_SCORE;
    }
    return 0;
}

/** If any legal move mates immediately, return it (do not search past checkmate). */
function findImmediateMatingMove(game, moves) {
    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const mates = withAppliedMove(game, move, () => game.Checkmate);
        if (mates) {
            return move;
        }
    }
    return null;
}

function negamax(game, depthRemaining, alpha, beta) {
    applyRuntimeConfigForGame(game);
    if (depthRemaining === 0) {
        return evaluateLeafPosition(game);
    }

    const moves = collectLegalMoves(game);
    if (moves.length === 0) {
        return scoreTerminalNoMoves(game);
    }

    const ordered = orderMovesCapturesFirst(game, moves);
    let best = -Infinity;
    for (let i = 0; i < ordered.length; i++) {
        const move = ordered[i];
        const q = immediateLineScoreForMove(game, move);
        const score = q + withAppliedMove(game, move, () => -negamax(game, depthRemaining - 1, -beta, -alpha));
        if (score > best) {
            best = score;
        }
        if (score > alpha) {
            alpha = score;
        }
        if (alpha >= beta) {
            break;
        }
    }
    return best;
}

function searchBestMoveAtRoot(game, maxDepth) {
    const moves = collectLegalMoves(game);
    if (moves.length === 0) {
        return null;
    }
    const mateNow = findImmediateMatingMove(game, moves);
    if (mateNow) {
        mateNow.score = MATE_SCORE;
        return mateNow;
    }
    const ordered = orderMovesCapturesFirst(game, moves);
    const depthAfterRoot = Math.max(0, maxDepth - 1);
    let alpha = -Infinity;
    const beta = Infinity;
    const tiedBest = [];
    let bestScore = -Infinity;

    for (let i = 0; i < ordered.length; i++) {
        const move = ordered[i];
        const q = immediateLineScoreForMove(game, move);
        const score = q + withAppliedMove(game, move, () => -negamax(game, depthAfterRoot, -beta, -alpha));
        if (!Number.isFinite(score)) {
            continue;
        }
        if (score > bestScore) {
            bestScore = score;
            tiedBest.length = 0;
            tiedBest.push(move);
        } else if (score === bestScore) {
            const q = immediateLineScoreForMove(game, move);
            const prevQ =
                tiedBest.length > 0
                    ? immediateLineScoreForMove(game, tiedBest[0])
                    : -Infinity;
            if (q > prevQ) {
                tiedBest.length = 0;
                tiedBest.push(move);
            } else if (q === prevQ) {
                tiedBest.push(move);
            }
        }
        if (score > alpha) {
            alpha = score;
        }
    }

    if (tiedBest.length === 0) {
        return ordered[0];
    }
    if (tiedBest.length > 1) {
        logTiedBestMoveOptions(game, tiedBest, bestScore);
    }
    const pick = tiedBest[Math.floor(Math.random() * tiedBest.length)];
    if (tiedBest.length > 1) {
        console.log(`${LOG_PREFIX} Random pick among ties: ${bookMovePgn(game, pick)}`);
    }
    pick.score = bestScore;
    return pick;
}

if (!isMainThread) {
    if (!chess) {
        chess = new ChessGame();
    }

    console.log(`${LOG_PREFIX} worker thread initialized`);

    parentPort.on("message", (request) => {
        const { requestId, gameState, maxDepth: requestMaxDepth, config, pliesPlayed } = request;

        if (!requestId || !gameState) {
            console.error(`${LOG_PREFIX} Worker received invalid request`, request);
            parentPort.postMessage({ requestId: request?.requestId || 0, error: "Invalid request format" });
            return;
        }

        const maxDepth = requestMaxDepth != null ? Math.min(5, Math.max(1, Number(requestMaxDepth))) : DEFAULT_MAX_DEPTH;
        setBrain42SearchContext(config || {}, pliesPlayed ?? 0);
        const startTime = Date.now();

        try {
            leafEvaluationsThisSearch = 0;
            chess.loadGame(gameState);
            if (!Array.isArray(chess.GameState.capturedPiecesList)) {
                chess.GameState.capturedPiecesList = [];
            }
            const phase = applyRuntimeConfigForGame(chess);
            console.log(
                `${LOG_PREFIX} Thinking... request=${requestId}, depth=${maxDepth}, phase=${phase}, `
                    + `plies=${currentSearchPliesPlayed(chess)}`,
            );
            chess.SearchMode = true;
            const move = searchBestMoveAtRoot(chess, maxDepth);
            chess.SearchMode = false;

            const duration = Date.now() - startTime;
            console.log(`${LOG_PREFIX} request=${requestId} done in ${duration}ms`);

            let out = move;
            if (!out || out.source == null) {
                out = getFirstLegalMove(chess);
                console.error(`${LOG_PREFIX} Worker: search returned empty; first legal fallback`);
            } else {
                const v = chess.validateMove(out.source, out.target, chess.Turn);
                if (!v.valid) {
                    out = getFirstLegalMove(chess);
                    console.error(`${LOG_PREFIX} Worker: chosen move failed validateMove; first legal fallback`, out);
                }
            }

            console.log(
                `${LOG_PREFIX} request=${requestId} final decision: leaf evaluations=${leafEvaluationsThisSearch}`,
            );

            if (out && out.source != null) {
                out.turn = chess.Turn;
                parentPort.postMessage({ requestId, move: out });
            } else {
                parentPort.postMessage({ requestId, error: "No move found" });
            }
        } catch (err) {
            const duration = Date.now() - startTime;
            console.error(
                `${LOG_PREFIX} Worker error request=${requestId} after ${duration}ms `
                    + `(leaf evaluations before error: ${leafEvaluationsThisSearch}):`,
                err,
            );
            parentPort.postMessage({ requestId, error: err.message || "Unknown error in worker thread" });
        }
    });
}
