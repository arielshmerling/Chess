
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const { State } = require("./modules/game/model");
const { ChessGame } = require("./ChessGame");
var chess;
var depth = 0;
const DEFAULT_MAX_DEPTH = 2;

exports.Name = "Brain 4.0";

// Single persistent worker instance
let persistentWorker = null;
let requestIdCounter = 0;
const pendingRequests = new Map(); // Map<requestId, {resolve, reject, timeout}>

function getOrCreateWorker() {
    if (!isMainThread) {
        throw new Error("getOrCreateWorker called from worker thread");
    }

    if (!persistentWorker) {
        console.log("Creating persistent worker thread...");
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
            console.error("Persistent worker thread error:", err);
            // Reject all pending requests
            for (const [requestId, pending] of pendingRequests.entries()) {
                clearTimeout(pending.timeout);
                pending.reject(err);
            }
            pendingRequests.clear();
            // Reset worker so it will be recreated on next request
            persistentWorker = null;
        });

        persistentWorker.on("exit", (code) => {
            if (code !== 0) {
                console.error(`Persistent worker thread exited with code ${code}`);
            }
            // Reject all pending requests
            for (const [requestId, pending] of pendingRequests.entries()) {
                clearTimeout(pending.timeout);
                pending.reject(new Error(`Worker thread exited with code ${code}`));
            }
            pendingRequests.clear();
            // Reset worker so it will be recreated on next request
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

        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
            const pending = pendingRequests.get(requestId);
            if (pending) {
                pendingRequests.delete(requestId);
                console.error(`Brain move timeout for request ${requestId} - worker thread took too long`);
                reject(new Error("Brain move timeout"));
            }
        }, 120000); // 120 second timeout

        pendingRequests.set(requestId, { resolve, reject, timeout });

        // Send request to worker
        console.log(`Sending request ${requestId} to worker thread (depth ${depthLimit})`);
        worker.postMessage({ requestId, gameState: strState, maxDepth: depthLimit });
    });
}

// Custom error class for timeout fallback
class BrainTimeoutFallbackError extends Error {
    constructor(move) {
        super("Brain move timeout - using fallback move");
        this.name = "BrainTimeoutFallbackError";
        this.fallbackMove = move;
    }
}

// Helper function to get first legal move from game
function getFirstLegalMove(game) {
    const moves = allPossibleMoves(game);
    if (moves.length === 0) {
        return null; // No legal moves (checkmate or stalemate)
    }
    return moves[0];
}

exports.brainNextMoveFunc = async (game, options) => {
    const state = game.GameState;
    const strState = JSON.stringify(state);
    const maxDepth = options?.maxDepth != null ? Math.min(5, Math.max(1, Number(options.maxDepth))) : DEFAULT_MAX_DEPTH;
    const move = await tryFindMatchState(game);
    if (move) {
        return move;
    }

    // Try once, and retry once if it fails
    try {
        return await createWorkerPromise(strState, maxDepth);
    } catch (err) {
        console.log(`Brain move failed, retrying once. Error: ${err.message}`);
        // Retry once
        try {
            return await createWorkerPromise(strState, maxDepth);
        } catch (retryErr) {
            // Both attempts timed out - get first legal move as fallback
            console.log("Both brain move attempts timed out, using fallback move");
            const fallbackMove = getFirstLegalMove(game);
            if (!fallbackMove) {
                throw new Error("No legal moves available (checkmate or stalemate)");
            }
            throw new BrainTimeoutFallbackError(fallbackMove);
        }
    }
};

// Export the error class so it can be caught in makeBrainMove
exports.BrainTimeoutFallbackError = BrainTimeoutFallbackError;

function suggestMove(chess, maxDepth) {
    depth++;
    const moves = allPossibleMoves(chess);
    if (moves.length === 0) {
        depth--;
        return null; // No legal moves available (checkmate or stalemate)
    }
    if (depth > maxDepth) {
        depth--;
        return moves[0];
    }

    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        move.score = scoreMove(chess, move, maxDepth);
    }

    const finalResult = findBestMove(moves);
    depth--;
    return finalResult;
}

function findBestMove(moves) {
    if (!moves || moves.length == 0) { return null; }
    const max = Math.max(...moves.map(o => o.score));
    moves = moves.filter(o => o.score == max);
    const rand = Math.floor(Math.random() * moves.length);
    //console.log("findBestMove: " + moves.length + " moves, choosing random move #" + rand);
    return moves[rand];
}
/**
 * 
 * @param {ChessGame} chess 
 * @returns an array of objects representing possible moves, each with source square, destination square, and value.
 */
function allPossibleMoves(chess) {
    let moves = [];
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const source = chess.square(i, j);
            const options = chess.possibleMoves(source);
            if (options.length > 0) {
                for (const move of options) {
                    moves = moves.concat(move);

                }
            }
        }
    }
    return moves;
}

function stateScore(chess, move) {

    let score = 0;
    const state = chess.GameState;
    const targetPiece = state.board[move.target.row][move.target.col];
    if (targetPiece == null) {
        score = 0;
    }
    else {
        score = pieceValue(targetPiece.pieceType);
    }

    return score;
}

function scoreMove(chess, move, maxDepth) {

    let score = stateScore(chess, move);
    chess.makeMove(move.source, move.target);
    if (chess.Checkmate) { score = 9999; }

    if (move.promotion) {
        switch (move.selectedPiece) {
            case chess.QUEEN:
                score = 1100;
                break;
            case chess.ROOK:
                score = 1010;
                break;
            case chess.KNIGHT:
                score = 1005;
                break;
            case chess.BISHOP:
                score = 1000;
                break;
        }
    }

    if (chess.Moves.length > 50) {
        if (chess.Check) { score += 3; }
    }

    if (depth < maxDepth) {
        const opponentMove = suggestMove(chess, maxDepth);
        if (opponentMove) {
            score -= opponentMove.score;
        }
    }
    chess.undo();
    return score;
}

function pieceValue(pieceType) {

    switch (pieceType) {
        case chess.PAWN:
            return 1;
        case chess.ROOK:
            return 5;
        case chess.KNIGHT:
            return 3;
        case chess.BISHOP:
            return 3.25;
        case chess.QUEEN:
            return 9;
        case chess.KING:
            return 10000;
        default:
            return 0;
    }
}

async function tryFindMatchState(game) {
    const gameState = game.SavedGameState;
    const options = [];
    const stateStr = gameState;
    const findResult = await State.find({ state: stateStr });
    for await (const doc of findResult) {
        options.push(JSON.parse(doc.move));
    }
    const rand = Math.floor(Math.random() * options.length);
    console.log(options.length + " moves found, chosing option #" + rand);
    return options.length > 0 ? options[rand] : null;
}

if (!isMainThread) {
    // Initialize chess instance once
    if (!chess) {
        chess = new ChessGame();
    }

    console.log("Brain 4 worker thread initialized and ready");

    // Listen for messages from main thread
    parentPort.on("message", (request) => {
        const { requestId, gameState, maxDepth: requestMaxDepth } = request;

        if (!requestId || !gameState) {
            console.error("Worker thread: Invalid request received", request);
            parentPort.postMessage({ requestId: request?.requestId || 0, error: "Invalid request format" });
            return;
        }

        const maxDepth = requestMaxDepth != null ? Math.min(5, Math.max(1, Number(requestMaxDepth))) : DEFAULT_MAX_DEPTH;
        console.log(`Brain 4 is thinking... (request ${requestId}, depth ${maxDepth})`);
        const startTime = Date.now();

        try {
            depth = 0;
            chess.loadGame(gameState);
            chess.SearchMode = true;
            const move = suggestMove(chess, maxDepth);
            chess.SearchMode = false;

            const duration = Date.now() - startTime;
            console.log(`Brain 4 completed request ${requestId} in ${duration}ms`);

            if (move) {
                move.turn = chess.Turn;
                parentPort.postMessage({ requestId, move });
            } else {
                console.error(`Worker thread: suggestMove returned null (request ${requestId})`);
                parentPort.postMessage({ requestId, error: "No move found" });
            }
        } catch (err) {
            const duration = Date.now() - startTime;
            console.error(`Worker thread error (request ${requestId}) after ${duration}ms:`, err);
            parentPort.postMessage({ requestId, error: err.message || "Unknown error in worker thread" });
        }
    });
}