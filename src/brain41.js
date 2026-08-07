const { Worker, isMainThread, parentPort } = require("worker_threads");
const { ChessGame } = require("./ChessGame");
const { getDefaultConfig, sanitizeBrainConfig } = require("./modules/game/brainConfigService");
const {
    beginTimedSearch,
    endTimedSearch,
    shouldStopSearch,
    getRemainingSearchMs,
} = require("./brainSearchTime");
const {
    reportDepthCompleted,
    reportSearchProgress,
    reportSearchThinking,
    flushWorkerProgress,
    setWorkerSearchProgressRequestId,
} = require("./brainSearchProgress");
var chess;
const DEFAULT_MAX_DEPTH = 2;
const MAX_DEBUG_MOVES_TO_PRINT = 12;
const LOG_PREFIX = "[Brain4.1]";
/** Worker safety timeout when search uses fixed depth (tests). */
const BRAIN_MOVE_TIMEOUT_MS = 4 * 60 * 1000;
/** Extra ms beyond user thinking time before main thread abandons the worker request. */
const THINKING_TIME_SAFETY_BUFFER_MS = 400;
/** Do not start another iterative-deepening ply below this remaining budget. */
const MIN_MS_FOR_NEXT_DEPTH = 50;
const MAX_ITERATIVE_DEPTH = 6;
let runtimeConfig = getDefaultConfig("brain41");

/** Increments inside {@link scoreMove}; reset once per worker search. One count per branching evaluation (static score + recurse). */
let positionsEvaluatedThisSearch = 0;

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
            const { requestId, move, error, progress } = response;
            if (progress) {
                reportSearchProgress(progress);
                return;
            }
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
            if (code !== 0 && pendingRequests.size > 0) {
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

function terminatePersistentWorker(reason) {
    if (!persistentWorker) {
        return;
    }
    console.warn(`${LOG_PREFIX} Terminating worker: ${reason}`);
    const worker = persistentWorker;
    persistentWorker = null;
    for (const [, pending] of pendingRequests.entries()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(reason || "Worker terminated"));
    }
    pendingRequests.clear();
    worker.terminate();
}

function createWorkerPromise(strState, searchOptions) {
    return new Promise((resolve, reject) => {
        if (!isMainThread) {
            reject(new Error("createWorkerPromise called from worker thread"));
            return;
        }

        const requestId = ++requestIdCounter;
        const worker = getOrCreateWorker();
        const thinkingTimeMs = searchOptions?.thinkingTimeMs;
        const maxDepth = searchOptions?.maxDepth;
        const config = searchOptions?.config;
        const timeoutMs = thinkingTimeMs != null && Number(thinkingTimeMs) > 0
            ? Math.max(1000, Math.floor(Number(thinkingTimeMs)) + THINKING_TIME_SAFETY_BUFFER_MS)
            : BRAIN_MOVE_TIMEOUT_MS;

        const timeout = setTimeout(() => {
            const pending = pendingRequests.get(requestId);
            if (pending) {
                pendingRequests.delete(requestId);
                console.error(`${LOG_PREFIX} move timeout for request ${requestId} after ${timeoutMs}ms`);
                terminatePersistentWorker("Brain move timeout");
                reject(new Error("Brain move timeout"));
            }
        }, timeoutMs);

        pendingRequests.set(requestId, { resolve, reject, timeout });
        const label = thinkingTimeMs != null && Number(thinkingTimeMs) > 0
            ? `time ${thinkingTimeMs}ms`
            : `depth ${maxDepth != null ? maxDepth : DEFAULT_MAX_DEPTH}`;
        console.log(`${LOG_PREFIX} Sending request ${requestId} (${label})`);
        worker.postMessage({ requestId, gameState: strState, thinkingTimeMs, maxDepth, config });
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
    const state = game.GameState;
    const strState = JSON.stringify(state);
    const maxDepth = options?.maxDepth != null ? Math.min(6, Math.max(1, Number(options.maxDepth))) : DEFAULT_MAX_DEPTH;
    const move = await tryFindMatchState(game);
    if (move) {
        move.searchDepthReached = 0;
        console.log(
            `${LOG_PREFIX} Opening book hit (depth 0): ${toSimpleNotationSafe(game, move)} (positions evaluated: 0)`,
        );
        return move;
    }

    const workerSearchOptions = { config: runtimeConfig };
    if (options?.thinkingTimeMs != null && Number(options.thinkingTimeMs) > 0) {
        workerSearchOptions.thinkingTimeMs = Math.floor(Number(options.thinkingTimeMs));
        console.log(`${LOG_PREFIX} Search budget: ${workerSearchOptions.thinkingTimeMs}ms`);
    } else {
        workerSearchOptions.maxDepth = maxDepth;
    }

    try {
        const workerMove = await createWorkerPromise(strState, workerSearchOptions);
        if (workerMove && workerMove.searchDepthReached != null) {
            console.log(
                `${LOG_PREFIX} Move chosen: ${toSimpleNotationSafe(game, workerMove)}, `
                    + `score=${workerMove.score != null ? workerMove.score : "n/a"}, `
                    + `search depth=${workerMove.searchDepthReached}`,
            );
        }
        return workerMove;
    } catch (err) {
        if (err && err.message === "Search aborted") {
            throw err;
        }
        if (err && err.message === "Brain move timeout") {
            const fallbackMove = getFirstLegalMove(game);
            if (!fallbackMove) {
                throw new Error("No legal moves available (checkmate or stalemate)");
            }
            fallbackMove.searchDepthReached = 0;
            console.log(
                `${LOG_PREFIX} Timeout fallback (depth 0): ${toSimpleNotationSafe(game, fallbackMove)}`,
            );
            throw new BrainTimeoutFallbackError(fallbackMove);
        }
        console.log(`${LOG_PREFIX} First attempt failed, retrying once. Error: ${err.message}`);
        try {
            return await createWorkerPromise(strState, workerSearchOptions);
        } catch (retryErr) {
            if (retryErr && retryErr.message === "Brain move timeout") {
                const fallbackMove = getFirstLegalMove(game);
                if (!fallbackMove) {
                    throw new Error("No legal moves available (checkmate or stalemate)");
                }
                fallbackMove.searchDepthReached = 0;
                console.log(
                    `${LOG_PREFIX} Timeout fallback (depth 0): ${toSimpleNotationSafe(game, fallbackMove)}`,
                );
                throw new BrainTimeoutFallbackError(fallbackMove);
            }
            console.log(`${LOG_PREFIX} Both attempts failed, using first legal fallback move`);
            const fallbackMove = getFirstLegalMove(game);
            if (!fallbackMove) {
                throw new Error("No legal moves available (checkmate or stalemate)");
            }
            fallbackMove.searchDepthReached = 0;
            console.log(
                `${LOG_PREFIX} Error fallback (depth 0): ${toSimpleNotationSafe(game, fallbackMove)}`,
            );
            throw new BrainTimeoutFallbackError(fallbackMove);
        }
    }
};

exports.BrainTimeoutFallbackError = BrainTimeoutFallbackError;

exports.abortActiveSearch = function abortActiveSearch() {
    if (!isMainThread) {
        return;
    }
    terminatePersistentWorker("Search aborted");
};

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

    if (shouldStopSearch()) {
        return null;
    }

    if (ply > maxDepth) {
        logAtPly(ply, `Depth cutoff reached (maxDepth=${maxDepth}), returning first legal move`);
        return moves[0];
    }

    for (let i = 0; i < moves.length; i++) {
        if (shouldStopSearch()) {
            return null;
        }
        const move = moves[i];
        move.score = scoreMove(localChess, move, maxDepth, ply);
    }

    if (shouldStopSearch()) {
        return null;
    }

    const finalResult = findBestMove(localChess, moves, ply);
    logAtPly(ply, `Exit ply=${ply}, selected=${toSimpleNotationSafe(localChess, finalResult)}, score=${finalResult?.score}`);
    return finalResult;
}

async function suggestMoveWithTimeLimit(localChess, thinkingTimeMs) {
    beginTimedSearch(thinkingTimeMs);
    try {
        const fallback = getFirstLegalMove(localChess);
        if (!fallback) {
            return null;
        }
        let bestMove = fallback;
        let completedDepth = 0;

        for (let depth = 1; depth <= MAX_ITERATIVE_DEPTH; depth += 1) {
            if (shouldStopSearch()) {
                break;
            }
            if (getRemainingSearchMs() < MIN_MS_FOR_NEXT_DEPTH) {
                break;
            }
            const atDepth = suggestMove(localChess, depth, 1);
            if (atDepth) {
                bestMove = atDepth;
                completedDepth = depth;
                reportDepthCompleted(
                    LOG_PREFIX,
                    depth,
                    toSimpleNotationSafe(localChess, bestMove),
                    bestMove.score,
                );
                await flushWorkerProgress();
            }
            if (shouldStopSearch()) {
                break;
            }
        }

        bestMove.searchDepthReached = completedDepth || 1;
        console.log(
            `${LOG_PREFIX} Timed search finished: depth=${bestMove.searchDepthReached}, `
                + `best=${toSimpleNotationSafe(localChess, bestMove)}, `
                + `score=${bestMove.score != null ? bestMove.score : "n/a"}`,
        );
        return bestMove;
    } finally {
        endTimedSearch();
    }
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

/** Signed config deltas for first king/rook development (values are ≤ 0; castling king jump exempt). */
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
    let delta = 0;
    if (kPen !== 0 && move.piece.pieceType === localChess.KING) {
        const isFirst = (move.piece.color === "white" && !state.whiteKingMoved)
            || (move.piece.color === "black" && !state.blackKingMoved);
        if (isFirst && !isCastlingKingMove(localChess, move)) {
            delta += kPen;
        }
    }
    if (rPen !== 0 && move.piece.pieceType === localChess.ROOK) {
        const c = move.piece.color;
        if (c === "white") {
            if (move.source.col === kingsideRookCol && !state.kingsideWhiteRookMoved) {
                delta += rPen;
            } else if (move.source.col === queensideRookCol && !state.queensideWhiteRookMoved) {
                delta += rPen;
            }
        } else {
            if (move.source.col === kingsideRookCol && !state.kingsideBlackRookMoved) {
                delta += rPen;
            } else if (move.source.col === queensideRookCol && !state.queensideBlackRookMoved) {
                delta += rPen;
            }
        }
    }
    return delta;
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
    score += getBestOpenRookSeventhBonusDelta(localChess, runtimeConfig.specialEvaluations);
    score += getVeryGoodOpenFileRookBonusDelta(localChess, runtimeConfig.specialEvaluations);
    score += getPoorClosedFileRookPenaltyDelta(localChess, runtimeConfig.specialEvaluations);
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
 * A pawn chain is a run of adjacent files (columns) that each contain at least one
 * friendly pawn. Rank does not matter; pawns need not defend each other.
 */
function getCurrentPlayerPawnChainCount(localChess) {
    const state = localChess.GameState;
    if (!state || !state.board) {
        return 0;
    }
    const currentColor = localChess.Turn;
    const filesWithPawns = [];
    for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 8; row++) {
            const piece = state.board[row][col];
            if (piece && piece.color === currentColor && piece.pieceType === localChess.PAWN) {
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

/** Penalizes extra pawn chains: -(chainCount - 1) * pawnsChainCountPenalty; one chain (or no pawns) adds nothing. */
function getPawnChainCountEvalDelta(localChess, specialEvaluations) {
    const p = Number(specialEvaluations && specialEvaluations.pawnsChainCountPenalty) || 0;
    if (p === 0) {
        return 0;
    }
    const c = getCurrentPlayerPawnChainCount(localChess);
    if (c <= 1) {
        return 0;
    }
    return (c - 1) * p;
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

/** Open file (no pawn of either color anywhere on that file). Same convention as pawn rows in {@link isAdvancedPawnRankForColor}. */
function isBoardFileFullyOpen(localChess, col) {
    const state = localChess.GameState;
    const board = state && state.board;
    if (!board) {
        return false;
    }
    const pawn = localChess.PAWN;
    for (let row = 0; row < 8; row++) {
        const p = board[row][col];
        if (p && p.pieceType === pawn) {
            return false;
        }
    }
    return true;
}

/** True if this square matches “rook on seventh rank”: white rook on row 1; black rook on row 6 (mirrors pawn-advanced indexing). */
function isRookOnInvadingSeventhRowForColor(row, color) {
    if (color === "white") {
        return row === 1;
    }
    if (color === "black") {
        return row === 6;
    }
    return false;
}

/**
 * Side to move: each friendly rook that sits on an open file on rank 7 (white) / rank 2 (black)
 * earns (multiplier − 1)× rook score (default multiplier 1.25 ⇒ +25% per such rook).
 */
function getBestOpenRookSeventhBonusDelta(localChess, specialEvaluations) {
    const raw = specialEvaluations && specialEvaluations.bestOpenRookOnSeventhMultiplier;
    const mult = Number.isFinite(Number(raw)) ? Number(raw) : 1.25;
    if (mult <= 1) {
        return 0;
    }
    const state = localChess.GameState;
    const board = state && state.board;
    if (!board) {
        return 0;
    }
    const side = localChess.Turn;
    const rookT = localChess.ROOK;
    const rookScore = pieceValue(localChess, rookT);
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
                && isBoardFileFullyOpen(localChess, col)
            ) {
                count += 1;
            }
        }
    }
    return count * extraPerRook;
}

/**
 * Side to move: each friendly rook on a fully open file (any rank) earns (multiplier − 1)× rook score
 * (default 1.125 ⇒ +12.5% per such rook). Stacks with {@link getBestOpenRookSeventhBonusDelta} when both apply.
 */
function getVeryGoodOpenFileRookBonusDelta(localChess, specialEvaluations) {
    const raw = specialEvaluations && specialEvaluations.veryGoodOpenRookMultiplier;
    const mult = Number.isFinite(Number(raw)) ? Number(raw) : 1.125;
    if (mult <= 1) {
        return 0;
    }
    const state = localChess.GameState;
    const board = state && state.board;
    if (!board) {
        return 0;
    }
    const side = localChess.Turn;
    const rookT = localChess.ROOK;
    const rookScore = pieceValue(localChess, rookT);
    const extraPerRook = (mult - 1) * rookScore;
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (
                piece
                && piece.color === side
                && piece.pieceType === rookT
                && isBoardFileFullyOpen(localChess, col)
            ) {
                count += 1;
            }
        }
    }
    return count * extraPerRook;
}

/** A closed file has at least one pawn on it (inverse of fully open file). */
function isBoardFileClosedForRook(localChess, col) {
    return !isBoardFileFullyOpen(localChess, col);
}

/**
 * Side to move: each friendly rook on a closed file earns (multiplier − 1)× rook score (negative if multiplier &lt; 1).
 * Default multiplier 0.75 ⇒ −25% per rook. Set to 1 to disable.
 */
function getPoorClosedFileRookPenaltyDelta(localChess, specialEvaluations) {
    const raw = specialEvaluations && specialEvaluations.poorClosedFileRookMultiplier;
    const mult = Number.isFinite(Number(raw)) ? Number(raw) : 0.75;
    if (mult >= 1) {
        return 0;
    }
    const state = localChess.GameState;
    const board = state && state.board;
    if (!board) {
        return 0;
    }
    const side = localChess.Turn;
    const rookT = localChess.ROOK;
    const rookScore = pieceValue(localChess, rookT);
    const deltaPerRook = (mult - 1) * rookScore;
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (
                piece
                && piece.color === side
                && piece.pieceType === rookT
                && isBoardFileClosedForRook(localChess, col)
            ) {
                count += 1;
            }
        }
    }
    if (count === 0) {
        return 0;
    }
    return count * deltaPerRook;
}

/** Pawn structure adjustment used by {@link stateScore} (signed penalties + advanced bonus). */
function getPawnEvalDelta(localChess, specialEvaluations, pawnValue) {
    const dpp = Number(specialEvaluations && specialEvaluations.doublePawnPenalty) || 0;
    const pab = Number(specialEvaluations && specialEvaluations.pawnAdvancedBonus) || 0;
    const pv = Number(pawnValue) || 0;
    return getCurrentPlayerDoubledPawnCount(localChess) * dpp
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
exports.isBoardFileFullyOpen = isBoardFileFullyOpen;
exports.isRookOnInvadingSeventhRowForColor = isRookOnInvadingSeventhRowForColor;
exports.getBestOpenRookSeventhBonusDelta = getBestOpenRookSeventhBonusDelta;
exports.getVeryGoodOpenFileRookBonusDelta = getVeryGoodOpenFileRookBonusDelta;
exports.isBoardFileClosedForRook = isBoardFileClosedForRook;
exports.getPoorClosedFileRookPenaltyDelta = getPoorClosedFileRookPenaltyDelta;

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
        if (shouldStopSearch()) {
            localChess.undo();
            return score;
        }
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
    if (process.env.SHMERLING_MODE === "desktop") {
        return null;
    }
    const gameState = game.SavedGameState;
    const options = [];
    try {
        const { State } = require("./modules/game/model");
        const findResult = await State.find({ state: gameState });
        for await (const doc of findResult) {
            options.push(JSON.parse(doc.move));
        }
    } catch (err) {
        console.warn("[brain41] opening book lookup skipped:", err.message);
        return null;
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
        const {
            requestId,
            gameState,
            thinkingTimeMs: requestThinkingTimeMs,
            maxDepth: requestMaxDepth,
            config,
        } = request;

        if (!requestId || !gameState) {
            console.error(`${LOG_PREFIX} Worker received invalid request`, request);
            parentPort.postMessage({ requestId: request?.requestId || 0, error: "Invalid request format" });
            return;
        }

        setWorkerSearchProgressRequestId(requestId);

        const maxDepth = requestMaxDepth != null ? Math.min(6, Math.max(1, Number(requestMaxDepth))) : DEFAULT_MAX_DEPTH;
        const thinkingTimeMs = requestThinkingTimeMs != null && Number(requestThinkingTimeMs) > 0
            ? Math.floor(Number(requestThinkingTimeMs))
            : null;
        runtimeConfig = sanitizeBrainConfig("brain41", config || {});
        const startTime = Date.now();
        const budgetLabel = thinkingTimeMs != null ? `time=${thinkingTimeMs}ms` : `depth=${maxDepth}`;
        reportSearchThinking(LOG_PREFIX, budgetLabel, null, null, requestId);

        (async () => {
            try {
                positionsEvaluatedThisSearch = 0;
                chess.loadGame(gameState);
                chess.SearchMode = true;
                let move = thinkingTimeMs != null
                    ? await suggestMoveWithTimeLimit(chess, thinkingTimeMs)
                    : suggestMove(chess, maxDepth, 1);
                if (move && move.searchDepthReached == null) {
                    move.searchDepthReached = maxDepth;
                }
                chess.SearchMode = false;

                const duration = Date.now() - startTime;
                const depthReached = move && move.searchDepthReached != null ? move.searchDepthReached : "?";
                console.log(
                    `${LOG_PREFIX} request=${requestId} done in ${duration}ms, `
                        + `depth=${depthReached}, move=${toSimpleNotationSafe(chess, move)}, `
                        + `positions evaluated=${positionsEvaluatedThisSearch}`,
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
        })();
    });
}
