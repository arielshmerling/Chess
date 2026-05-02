const { Worker, isMainThread, parentPort } = require("worker_threads");
const { State } = require("./modules/game/model");
const { ChessGame } = require("./ChessGame");
const { getDefaultConfig, sanitizeBrainConfig } = require("./modules/game/brainConfigService");
var chess;
const DEFAULT_MAX_DEPTH = 2;
const MAX_DEBUG_MOVES_TO_PRINT = 12;
const LOG_PREFIX = "[Brain4.1]";
let runtimeConfig = getDefaultConfig("brain41");
let lastLoggedRuntimeConfigJson = null;

/** Increments inside {@link scoreMove}; reset once per worker search. One count per branching evaluation (static score + recurse). */
let positionsEvaluatedThisSearch = 0;

/** Logs the effective brain41 config when it changes (avoids per-move spam in main thread and worker). */
function logRuntimeConfigIfChanged(config, where) {
    const serialized = JSON.stringify(config);
    if (lastLoggedRuntimeConfigJson === serialized) {
        return;
    }
    lastLoggedRuntimeConfigJson = serialized;
    console.log(`${LOG_PREFIX} Using configuration [${where}]:`, serialized);
}

exports.Name = "Brain 4.1";

// Single persistent worker instance
let persistentWorker = null;
let requestIdCounter = 0;
const pendingRequests = new Map(); // Map<requestId, {resolve, reject, timeout}>

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

function createWorkerPromise(strState, maxDepth, config) {
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
        console.log(`${LOG_PREFIX} Sending request ${requestId} (depth ${depthLimit})`);
        worker.postMessage({ requestId, gameState: strState, maxDepth: depthLimit, config });
    });
}

class BrainTimeoutFallbackError extends Error {
    constructor(move) {
        super("Brain move timeout - using fallback move");
        this.name = "BrainTimeoutFallbackError";
        this.fallbackMove = move;
    }
}

function getFirstLegalMove(game) {
    const moves = allPossibleMoves(game);
    if (moves.length === 0) {
        return null;
    }
    return moves[0];
}

exports.brainNextMoveFunc = async (game, options) => {
    runtimeConfig = sanitizeBrainConfig("brain41", options?.config || {});
    logRuntimeConfigIfChanged(runtimeConfig, "main");
    const state = game.GameState;
    const strState = JSON.stringify(state);
    const maxDepth = options?.maxDepth != null ? Math.min(5, Math.max(1, Number(options.maxDepth))) : DEFAULT_MAX_DEPTH;
    const move = await tryFindMatchState(game);
    if (move) {
        console.log(`${LOG_PREFIX} Opening book hit: ${toSimpleNotationSafe(game, move)} (positions evaluated: 0)`);
        return move;
    }

    try {
        return await createWorkerPromise(strState, maxDepth, runtimeConfig);
    } catch (err) {
        console.log(`${LOG_PREFIX} First attempt failed, retrying once. Error: ${err.message}`);
        try {
            return await createWorkerPromise(strState, maxDepth, runtimeConfig);
        } catch {
            console.log(`${LOG_PREFIX} Both attempts failed, using first legal fallback move`);
            const fallbackMove = getFirstLegalMove(game);
            if (!fallbackMove) {
                throw new Error("No legal moves available (checkmate or stalemate)");
            }
            throw new BrainTimeoutFallbackError(fallbackMove);
        }
    }
};

exports.BrainTimeoutFallbackError = BrainTimeoutFallbackError;

function logAtPly(ply, message) {
    const indent = "  ".repeat(Math.max(0, ply - 1));
    console.log(`${LOG_PREFIX} ${indent}${message}`);
}

function toSimpleNotationSafe(localChess, move) {
    try {
        if (!move || !move.source || !move.target) {
            return "<?>"; 
        }
        return localChess.getSimpleNotation(move);
    } catch {
        const s = move?.source || {};
        const t = move?.target || {};
        return `${s.row},${s.col}->${t.row},${t.col}`;
    }
}

function summarizeTopMoves(localChess, scoredMoves) {
    const top = scoredMoves
        .slice()
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, MAX_DEBUG_MOVES_TO_PRINT)
        .map((m) => `${toSimpleNotationSafe(localChess, m)}:${m.score}`);
    return top.join(", ");
}

function summarizeLegalMoves(localChess, moves) {
    const shown = moves
        .slice(0, MAX_DEBUG_MOVES_TO_PRINT)
        .map((m) => toSimpleNotationSafe(localChess, m));
    const suffix = moves.length > MAX_DEBUG_MOVES_TO_PRINT
        ? `, ... +${moves.length - MAX_DEBUG_MOVES_TO_PRINT} more`
        : "";
    return shown.join(", ") + suffix;
}

function suggestMove(localChess, maxDepth, ply = 1) {
    const moves = allPossibleMoves(localChess);
    logAtPly(
        ply,
        `Enter ply=${ply}, turn=${localChess.Turn}, legalMoves=${moves.length} (${summarizeLegalMoves(localChess, moves)})`
    );

    if (moves.length === 0) {
        logAtPly(ply, "No legal moves (terminal node)");
        return null;
    }

    if (ply > maxDepth) {
        logAtPly(ply, `Depth cutoff reached (maxDepth=${maxDepth}), returning first legal move`);
        return moves[0];
    }

    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        move.score = scoreMove(localChess, move, maxDepth, ply);
    }

    const finalResult = findBestMove(localChess, moves, ply);
    logAtPly(ply, `Exit ply=${ply}, selected=${toSimpleNotationSafe(localChess, finalResult)}, score=${finalResult?.score}`);
    return finalResult;
}

function findBestMove(localChess, moves, ply) {
    if (!moves || moves.length === 0) {
        return null;
    }

    const max = Math.max(...moves.map((o) => o.score));
    const candidates = moves.filter((o) => o.score === max);
    const rand = Math.floor(Math.random() * candidates.length);
    const selected = candidates[rand];

    logAtPly(ply, `Scored moves (top): ${summarizeTopMoves(localChess, moves)}`);
    logAtPly(ply, `Filtering by best score=${max}, candidates=${candidates.length}`);
    logAtPly(ply, `Random choice index=${rand}, selected=${toSimpleNotationSafe(localChess, selected)}`);
    return selected;
}

function allPossibleMoves(localChess) {
    let moves = [];
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const source = localChess.square(i, j);
            const options = localChess.possibleMoves(source);
            if (options.length > 0) {
                for (const move of options) {
                    moves = moves.concat(move);
                }
            }
        }
    }
    return moves;
}

function isCastlingKingMove(localChess, move) {
    if (!move.piece || move.piece.pieceType !== localChess.KING) {
        return false;
    }
    if (move.source.row !== move.target.row) {
        return false;
    }
    return Math.abs(move.target.col - move.source.col) === 2;
}

/** Negative adjustment when the side to move “spends” first king or rook development (castling king jump exempt). */
function getFirstKingRookMovePenaltyDelta(localChess, move, specialEvaluations) {
    const kPen = Number(specialEvaluations && specialEvaluations.firstKingMovePenalty) || 0;
    const rPen = Number(specialEvaluations && specialEvaluations.firstRookMovePenalty) || 0;
    if (kPen === 0 && rPen === 0) {
        return 0;
    }
    const state = localChess.GameState;
    if (!state || !move.piece) {
        return 0;
    }
    const wpv = state.whitePlayerView !== false;
    const kingsideRookCol = wpv ? 7 : 0;
    const queensideRookCol = wpv ? 0 : 7;
    let units = 0;
    if (kPen !== 0 && move.piece.pieceType === localChess.KING) {
        const isFirst = (move.piece.color === "white" && !state.whiteKingMoved)
            || (move.piece.color === "black" && !state.blackKingMoved);
        if (isFirst && !isCastlingKingMove(localChess, move)) {
            units += kPen;
        }
    }
    if (rPen !== 0 && move.piece.pieceType === localChess.ROOK) {
        const c = move.piece.color;
        if (c === "white") {
            if (move.source.col === kingsideRookCol && !state.kingsideWhiteRookMoved) {
                units += rPen;
            } else if (move.source.col === queensideRookCol && !state.queensideWhiteRookMoved) {
                units += rPen;
            }
        } else {
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

function stateScore(localChess, move) {
    const state = localChess.GameState;
    const targetPiece = state.board[move.target.row][move.target.col];
    let score = 0;
    if (targetPiece != null) {
        score = pieceValue(localChess, targetPiece.pieceType);
    }
    score += getPawnEvalDelta(localChess, runtimeConfig.specialEvaluations, pieceValue(localChess, localChess.PAWN));
    score += getPawnChainCountEvalDelta(localChess, runtimeConfig.specialEvaluations);
    score += getFirstKingRookMovePenaltyDelta(localChess, move, runtimeConfig.specialEvaluations);
    return score;
}

function getCurrentPlayerDoubledPawnCount(localChess) {
    const state = localChess.GameState;
    if (!state || !state.board) {
        return 0;
    }
    const currentColor = localChess.Turn;
    let doubledCount = 0;
    for (let col = 0; col < 8; col++) {
        let pawnsInFile = 0;
        for (let row = 0; row < 8; row++) {
            const piece = state.board[row][col];
            if (piece && piece.color === currentColor && piece.pieceType === localChess.PAWN) {
                pawnsInFile += 1;
            }
        }
        if (pawnsInFile >= 2) {
            doubledCount += pawnsInFile;
        }
    }
    return doubledCount;
}

function getCurrentPlayerAdvancedPawnCount(localChess) {
    const state = localChess.GameState;
    if (!state || !state.board) {
        return 0;
    }
    const currentColor = localChess.Turn;
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state.board[row][col];
            if (!piece || piece.color !== currentColor || piece.pieceType !== localChess.PAWN) {
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
 * Counts how many **pawn chains** the side to move has (Chess.com sense: pawns on the same
 * diagonal, each “supporting” the next along that diagonal; 
 * Two pawns are in the same chain if they are on **diagonally adjacent** squares
 * (|Δrow| = 1, |Δcol| = 1) — the graph where edges are those links is split into
 * connected components; each component is one chain. Isolated pawns are chains of size 1.
 * Pawns on the same rank/file only (e.g. doubled pawns) are not on a diagonal with each
 * other unless a third pawn links them.
 */
function getCurrentPlayerPawnChainCount(localChess) {
    const state = localChess.GameState;
    if (!state || !state.board) {
        return 0;
    }
    const currentColor = localChess.Turn;
    const pawns = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state.board[row][col];
            if (piece && piece.color === currentColor && piece.pieceType === localChess.PAWN) {
                pawns.push({ row, col });
            }
        }
    }
    const n = pawns.length;
    if (n === 0) {
        return 0;
    }
    const parent = new Array(n);
    for (let i = 0; i < n; i++) {
        parent[i] = i;
    }
    function find(i) {
        if (parent[i] !== i) {
            parent[i] = find(parent[i]);
        }
        return parent[i];
    }
    function union(i, j) {
        const ri = find(i);
        const rj = find(j);
        if (ri !== rj) {
            parent[ri] = rj;
        }
    }
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dr = Math.abs(pawns[i].row - pawns[j].row);
            const dc = Math.abs(pawns[i].col - pawns[j].col);
            if (dr === 1 && dc === 1) {
                union(i, j);
            }
        }
    }
    const roots = new Set();
    for (let i = 0; i < n; i++) {
        roots.add(find(i));
    }
    return roots.size;
}

/** Penalizes fragmentation into many diagonal pawn chains: (chainCount - 1) * pawnsChainCountPenalty; one chain (or no pawns) adds nothing. */
function getPawnChainCountEvalDelta(localChess, specialEvaluations) {
    const p = Number(specialEvaluations && specialEvaluations.pawnsChainCountPenalty) || 0;
    if (p === 0) {
        return 0;
    }
    const c = getCurrentPlayerPawnChainCount(localChess);
    if (c <= 1) {
        return 0;
    }
    return -(c - 1) * p;
}

function isAdvancedPawnRankForColor(row, color) {
    if (color === "white") {
        return row >= 1 && row <= 3; // ranks 7..5 for white
    }
    if (color === "black") {
        return row >= 4 && row <= 6; // ranks 4..2 for black
    }
    return false;
}

/** Pawn structure adjustment used by {@link stateScore} (config-driven double penalty + advanced bonus). */
function getPawnEvalDelta(localChess, specialEvaluations, pawnValue) {
    const dpp = Number(specialEvaluations && specialEvaluations.doublePawnPenalty) || 0;
    const pab = Number(specialEvaluations && specialEvaluations.pawnAdvancedBonus) || 0;
    const pv = Number(pawnValue) || 0;
    return -getCurrentPlayerDoubledPawnCount(localChess) * dpp
        + getCurrentPlayerAdvancedPawnCount(localChess) * pv * pab;
}

exports.getCurrentPlayerDoubledPawnCount = getCurrentPlayerDoubledPawnCount;
exports.getCurrentPlayerAdvancedPawnCount = getCurrentPlayerAdvancedPawnCount;
exports.getCurrentPlayerPawnChainCount = getCurrentPlayerPawnChainCount;
exports.getPawnChainCountEvalDelta = getPawnChainCountEvalDelta;
exports.isAdvancedPawnRankForColor = isAdvancedPawnRankForColor;
exports.getPawnEvalDelta = getPawnEvalDelta;
exports.getFirstKingRookMovePenaltyDelta = getFirstKingRookMovePenaltyDelta;
exports.isCastlingKingMove = isCastlingKingMove;
exports.getTotalMaterialValueForColor = getTotalMaterialValueForColor;
exports.getDrawLeafScoreForMover = getDrawLeafScoreForMover;

function scoreMove(localChess, move, maxDepth, ply) {
    positionsEvaluatedThisSearch += 1;
    const movingPlayer = localChess.Turn;
    let score = stateScore(localChess, move);
    localChess.makeMove(move.source, move.target);

    if ( localChess.Check) {
        console.log("check");
    }

    if (move.promotion) {
        localChess.completePromotion(move);
        switch (move.selectedPiece) {
            case localChess.QUEEN:
                score = pieceValue(localChess, localChess.QUEEN);
                break;
            case localChess.ROOK:
                score = pieceValue(localChess, localChess.ROOK);
                break;
            case localChess.KNIGHT:
                score = pieceValue(localChess, localChess.KNIGHT);
                break;
            case localChess.BISHOP:
                score = pieceValue(localChess, localChess.BISHOP);
                break;
        }
    }

    if (localChess.Checkmate) {
        score = 9999;
    }

    if (localChess.Draw) {
        score = getDrawLeafScoreForMover(localChess, movingPlayer, runtimeConfig.specialEvaluations);
    }

    if (localChess.Moves.length > 50 && localChess.Check) {
        score += 2.5;
    }

    if (ply < maxDepth) {
        const opponentMove = suggestMove(localChess, maxDepth, ply + 1);
        if (opponentMove) {
            score -= opponentMove.score;
        }
    }

    localChess.undo();
    logAtPly(ply, `Evaluated ${toSimpleNotationSafe(localChess, move)} => ${score}`);
    return score;
}

function pieceValue(localChess, pieceType) {
    const scores = runtimeConfig.pieceScores;
    switch (pieceType) {
        case localChess.PAWN:
            return scores.pawn;
        case localChess.ROOK:
            return scores.rook;
        case localChess.KNIGHT:
            return scores.knight;
        case localChess.BISHOP:
            return scores.bishop;
        case localChess.QUEEN:
            return scores.queen;
        case localChess.KING:
            return scores.king;
        default:
            return 0;
    }
}

function getTotalMaterialValueForColor(localChess, color) {
    const state = localChess.GameState;
    if (!state || !state.board) {
        return 0;
    }
    let total = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state.board[row][col];
            if (piece && piece.color === color) {
                total += pieceValue(localChess, piece.pieceType);
            }
        }
    }
    return total;
}

/**
 * Leaf score when a move ends in a draw, from the perspective of the side that moved.
 * If material (sum of piece values) advantage >= threshold, draw is bad (-5 default); if
 * behind by >= threshold, draw is good (+5); if within threshold, small preference (-0.1).
 */
function getDrawLeafScoreForMover(localChess, movingPlayerColor, specialEvaluations) {
    const se = specialEvaluations || {};
    const thrRaw = Number(se.drawMaterialDiffThreshold);
    const threshold = Number.isFinite(thrRaw) ? thrRaw : 3;
    const opponent = movingPlayerColor === "white" ? "black" : "white";
    const my = getTotalMaterialValueForColor(localChess, movingPlayerColor);
    const op = getTotalMaterialValueForColor(localChess, opponent);
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

async function tryFindMatchState(game) {
    const gameState = game.SavedGameState;
    const options = [];
    const findResult = await State.find({ state: gameState });
    for await (const doc of findResult) {
        options.push(JSON.parse(doc.move));
    }
    const rand = Math.floor(Math.random() * options.length);
    if (options.length > 0) {
        console.log(`${LOG_PREFIX} ${options.length} opening moves found, choosing #${rand}`);
    }
    return options.length > 0 ? options[rand] : null;
}

if (!isMainThread) {
    if (!chess) {
        chess = new ChessGame();
    }

    console.log(`${LOG_PREFIX} worker thread initialized`);

    parentPort.on("message", (request) => {
        const { requestId, gameState, maxDepth: requestMaxDepth, config } = request;

        if (!requestId || !gameState) {
            console.error(`${LOG_PREFIX} Worker received invalid request`, request);
            parentPort.postMessage({ requestId: request?.requestId || 0, error: "Invalid request format" });
            return;
        }

        const maxDepth = requestMaxDepth != null ? Math.min(5, Math.max(1, Number(requestMaxDepth))) : DEFAULT_MAX_DEPTH;
        runtimeConfig = sanitizeBrainConfig("brain41", config || {});
        const startTime = Date.now();
        console.log(`${LOG_PREFIX} Thinking... request=${requestId}, depth=${maxDepth}`);

        try {
            positionsEvaluatedThisSearch = 0;
            chess.loadGame(gameState);
            chess.SearchMode = true;
            const move = suggestMove(chess, maxDepth, 1);
            chess.SearchMode = false;

            const duration = Date.now() - startTime;
            console.log(
                `${LOG_PREFIX} request=${requestId} positions evaluated: ${positionsEvaluatedThisSearch}, `
                    + `${duration}ms`
            );

            if (move) {
                move.turn = chess.Turn;
                parentPort.postMessage({ requestId, move });
            } else {
                parentPort.postMessage({ requestId, error: "No move found" });
            }
        } catch (err) {
            const duration = Date.now() - startTime;
            console.error(`${LOG_PREFIX} Worker error request=${requestId} after ${duration}ms:`, err);
            parentPort.postMessage({ requestId, error: err.message || "Unknown error in worker thread" });
        }
    });
}
