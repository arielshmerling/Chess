const { Worker, isMainThread, parentPort } = require("worker_threads");
const { State } = require("./modules/game/model");
const { ChessGame } = require("./ChessGame");
var chess;
const DEFAULT_MAX_DEPTH = 2;
const MAX_DEBUG_MOVES_TO_PRINT = 12;
const LOG_PREFIX = "[Brain4.1]";

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

function createWorkerPromise(strState, maxDepth) {
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
        worker.postMessage({ requestId, gameState: strState, maxDepth: depthLimit });
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
    const state = game.GameState;
    const strState = JSON.stringify(state);
    const maxDepth = options?.maxDepth != null ? Math.min(5, Math.max(1, Number(options.maxDepth))) : DEFAULT_MAX_DEPTH;
    const move = await tryFindMatchState(game);
    if (move) {
        console.log(`${LOG_PREFIX} Opening book hit: ${toSimpleNotationSafe(game, move)}`);
        return move;
    }

    try {
        return await createWorkerPromise(strState, maxDepth);
    } catch (err) {
        console.log(`${LOG_PREFIX} First attempt failed, retrying once. Error: ${err.message}`);
        try {
            return await createWorkerPromise(strState, maxDepth);
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

function stateScore(localChess, move) {
    const state = localChess.GameState;
    const targetPiece = state.board[move.target.row][move.target.col];
    if (targetPiece == null) {
        return 0;
    }
    return pieceValue(localChess, targetPiece.pieceType);
}

function scoreMove(localChess, move, maxDepth, ply) {
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

    if (localChess.Draw ) {
        score = 0;
    }

    if (localChess.Moves.length > 50 && localChess.Check) {
        score += 3;
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
    switch (pieceType) {
        case localChess.PAWN:
            return 1;
        case localChess.ROOK:
            return 5;
        case localChess.KNIGHT:
            return 3;
        case localChess.BISHOP:
            return 3.25;
        case localChess.QUEEN:
            return 9;
        case localChess.KING:
            return 10000;
        default:
            return 0;
    }
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
        const { requestId, gameState, maxDepth: requestMaxDepth } = request;

        if (!requestId || !gameState) {
            console.error(`${LOG_PREFIX} Worker received invalid request`, request);
            parentPort.postMessage({ requestId: request?.requestId || 0, error: "Invalid request format" });
            return;
        }

        const maxDepth = requestMaxDepth != null ? Math.min(5, Math.max(1, Number(requestMaxDepth))) : DEFAULT_MAX_DEPTH;
        const startTime = Date.now();
        console.log(`${LOG_PREFIX} Thinking... request=${requestId}, depth=${maxDepth}`);

        try {
            chess.loadGame(gameState);
            chess.SearchMode = true;
            const move = suggestMove(chess, maxDepth, 1);
            chess.SearchMode = false;

            const duration = Date.now() - startTime;
            console.log(`${LOG_PREFIX} request=${requestId} completed in ${duration}ms`);

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
