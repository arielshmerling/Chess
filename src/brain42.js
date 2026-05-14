/**
 * Brain 4.2 — negamax with alpha-beta pruning over the same legal-move tree as other brains.
 *
 * Evaluation is material only (sum of configured piece values for the side to move minus the opponent).
 * Terminal positions: checkmate / stalemate / draw flag from {@link ChessGame}.
 *
 * Every tentative move uses {@link withAppliedMove} so `makeMove` / `completePromotion` always pair with
 * exactly one `undo`, including when pruning breaks out of the move loop early.
 */
const { Worker, isMainThread, parentPort } = require("worker_threads");
const { State } = require("./modules/game/model");
const { ChessGame } = require("./ChessGame");
const { getDefaultConfig, sanitizeBrainConfig } = require("./modules/game/brainConfigService");

const DEFAULT_MAX_DEPTH = 2;
const LOG_PREFIX = "[Brain4.2]";
/** Large enough to dominate material; mate distance not tuned (future work). */
const MATE_SCORE = 1_000_000;

let chess;
let runtimeConfig = getDefaultConfig("brain42");

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
    const moves = collectLegalMoves(game);
    return moves.length > 0 ? moves[0] : null;
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

async function tryFindMatchState(game) {
    const gameState = game.SavedGameState;
    const options = [];
    const findResult = await State.find({ state: gameState });
    for await (const doc of findResult) {
        options.push(JSON.parse(doc.move));
    }
    const rand = Math.floor(Math.random() * options.length);
    return options.length > 0 ? options[rand] : null;
}

exports.brainNextMoveFunc = async (game, options) => {
    runtimeConfig = sanitizeBrainConfig("brain42", options?.config || {});
    const state = game.GameState;
    const strState = JSON.stringify(state);
    const maxDepth = options?.maxDepth != null ? Math.min(5, Math.max(1, Number(options.maxDepth))) : DEFAULT_MAX_DEPTH;

    const bookMove = await tryFindMatchState(game);
    if (bookMove && isBookMoveStillLegal(game, bookMove)) {
        return bookMove;
    }

    try {
        return await createWorkerPromise(strState, maxDepth, runtimeConfig);
    } catch (err) {
        console.warn(`${LOG_PREFIX} First worker attempt failed: ${err.message}`);
        try {
            return await createWorkerPromise(strState, maxDepth, runtimeConfig);
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

/** Material for {@link ChessGame#Turn} minus opponent (no positional terms). */
function evaluateMaterialForSideToMove(game) {
    if (game.Draw) {
        return 0;
    }
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
            const v = pieceValue(game, p.pieceType);
            if (p.color === side) {
                mine += v;
            } else {
                theirs += v;
            }
        }
    }
    return mine - theirs;
}

function collectLegalMoves(game) {
    let moves = [];
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const source = game.square(i, j);
            const options = game.possibleMoves(source);
            if (options.length > 0) {
                for (const move of options) {
                    moves = moves.concat(move);
                }
            }
        }
    }
    return moves;
}

function orderMovesCapturesFirst(game, moves) {
    const state = game.GameState;
    if (!state?.board?.length || moves.length <= 1) {
        return moves.slice();
    }
    return moves.slice().sort((a, b) => {
        const capA = state.board[a.target.row]?.[a.target.col];
        const capB = state.board[b.target.row]?.[b.target.col];
        const va = capA ? pieceValue(game, capA.pieceType) : 0;
        const vb = capB ? pieceValue(game, capB.pieceType) : 0;
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

/** Score for the side to move when they have no legal moves. */
function scoreTerminalNoMoves(game) {
    if (game.Check) {
        return -MATE_SCORE;
    }
    return 0;
}

/**
 * Negamax with alpha-beta. Returns a score for the side to move at `game` (higher is better).
 * @param {import("./ChessGame").ChessGame} game
 * @param {number} depthRemaining half-moves left to search (0 = leaf eval only)
 */
function negamax(game, depthRemaining, alpha, beta) {
    if (depthRemaining === 0) {
        return evaluateMaterialForSideToMove(game);
    }

    const moves = collectLegalMoves(game);
    if (moves.length === 0) {
        return scoreTerminalNoMoves(game);
    }

    const ordered = orderMovesCapturesFirst(game, moves);
    let best = -Infinity;
    for (let i = 0; i < ordered.length; i++) {
        const move = ordered[i];
        const score = withAppliedMove(game, move, () => -negamax(game, depthRemaining - 1, -beta, -alpha));
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

/**
 * Root: pick a move maximizing negamax score after the reply subtree.
 * @returns {object|null} best legal move for {@link ChessGame#Turn}
 */
function searchBestMoveAtRoot(game, maxDepth) {
    const moves = collectLegalMoves(game);
    if (moves.length === 0) {
        return null;
    }
    const ordered = orderMovesCapturesFirst(game, moves);
    const depthAfterRoot = Math.max(0, maxDepth - 1);
    let alpha = -Infinity;
    const beta = Infinity;
    const tiedBest = [];
    let bestScore = -Infinity;

    for (let i = 0; i < ordered.length; i++) {
        const move = ordered[i];
        const score = withAppliedMove(game, move, () => -negamax(game, depthAfterRoot, -beta, -alpha));
        if (!Number.isFinite(score)) {
            continue;
        }
        if (score > bestScore) {
            bestScore = score;
            tiedBest.length = 0;
            tiedBest.push(move);
        } else if (score === bestScore) {
            tiedBest.push(move);
        }
        if (score > alpha) {
            alpha = score;
        }
    }

    if (tiedBest.length === 0) {
        return ordered[0];
    }
    const pick = tiedBest[Math.floor(Math.random() * tiedBest.length)];
    pick.score = bestScore;
    return pick;
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
        runtimeConfig = sanitizeBrainConfig("brain42", config || {});
        const startTime = Date.now();
        console.log(`${LOG_PREFIX} Thinking... request=${requestId}, depth=${maxDepth}`);

        try {
            chess.loadGame(gameState);
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

            if (out && out.source != null) {
                out.turn = chess.Turn;
                parentPort.postMessage({ requestId, move: out });
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
