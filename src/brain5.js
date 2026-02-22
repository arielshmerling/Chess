
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const { State } = require("./modules/game/model");
const { ChessGame } = require("./ChessGame");
var chess;
var depth = 0;
const MAX_DEPTH = 4;

exports.Name = "Brain 5.0";

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

function createWorkerPromise(strState) {
    return new Promise((resolve, reject) => {
        if (!isMainThread) {
            reject(new Error("createWorkerPromise called from worker thread"));
            return;
        }

        const requestId = ++requestIdCounter;
        const worker = getOrCreateWorker();

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
        console.log(`Sending request ${requestId} to worker thread`);
        worker.postMessage({ requestId, gameState: strState });
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

exports.brainNextMoveFunc = async (game) => {
    const state = game.GameState;
    const strState = JSON.stringify(state);
    const move = await tryFindMatchState(game);
    if (move) {
        return move;
    }

    // Try once, and retry once if it fails
    try {
        return await createWorkerPromise(strState);
    } catch (err) {
        console.log(`Brain move failed, retrying once. Error: ${err.message}`);
        // Retry once
        try {
            return await createWorkerPromise(strState);
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

/**
 * Alpha-Beta Pruning Minimax Algorithm
 * 
 * @param {ChessGame} chess - The chess game instance
 * @param {number} alpha - Best value for maximizing player (starts at -Infinity)
 * @param {number} beta - Best value for minimizing player (starts at +Infinity)
 * @param {string} originalTurn - The turn color at root level ("white" or "black")
 * @returns {Object|null} - Best move with score at root, or best score when recursing
 */
function suggestMove(chess, alpha = -Infinity, beta = Infinity, originalTurn = null) {
    depth++;

    // Track original turn at root level
    if (originalTurn === null) {
        originalTurn = chess.Turn;
    }

    const moves = allPossibleMoves(chess);

    if (moves.length === 0) {
        depth--;
        // No legal moves - checkmate or stalemate
        if (chess.Check) {
            // Checkmate - return very bad score for current player
            return { score: -9999 };
        }
        // Stalemate
        return { score: 0 };
    }

    if (depth > MAX_DEPTH) {
        depth--;
        // At max depth, return static evaluation from current player's perspective
        const eval = evaluatePosition(chess, chess.Turn);
        return { score: eval };
    }

    let bestMove = null;
    let bestScore = -Infinity; // Always maximize for current player (matching brain4)

    // Order moves for better pruning (captures first, then checks, then quiet moves)
    const orderedMoves = orderMoves(chess, moves);

    for (let i = 0; i < orderedMoves.length; i++) {
        const move = orderedMoves[i];
        const moveScore = scoreMove(chess, move, alpha, beta, originalTurn);

        // Always maximize for the current player (matching brain4's behavior)
        if (moveScore > bestScore) {
            bestScore = moveScore;
            bestMove = move;
            bestMove.score = moveScore;
        }

        // Alpha-beta pruning
        // Both players maximize from their own perspective
        // Alpha and beta are from the original player's perspective
        const isOriginalPlayer = (chess.Turn === originalTurn);

        if (isOriginalPlayer) {
            // Original player's turn - update alpha (best score for original player)
            alpha = Math.max(alpha, bestScore);
            if (alpha >= beta) {
                break; // Beta cutoff: opponent won't allow us to get this good
            }
        } else {
            // Opponent's turn - their score is from their perspective (positive = good for them)
            // Convert to original player's perspective: opponent's good = our bad
            // Update beta (worst score opponent can force on us)
            const scoreFromOriginalPerspective = -bestScore;
            beta = Math.min(beta, scoreFromOriginalPerspective);
            if (alpha >= beta) {
                break; // Alpha cutoff: we won't allow opponent to get this good
            }
        }
    }

    depth--;

    // At root level (depth 0), return the move. Otherwise return score
    if (depth === 0 && bestMove) {
        return bestMove;
    }
    return { score: bestScore };
}

/**
 * Orders moves to improve alpha-beta pruning efficiency
 * Priority: captures (by value), checks, then quiet moves
 */
function orderMoves(chess, moves) {
    return moves.sort((a, b) => {
        const state = chess.GameState;

        // Get captured piece values
        const aCapture = state.board[a.target.row]?.[a.target.col];
        const bCapture = state.board[b.target.row]?.[b.target.col];
        const aValue = aCapture ? pieceValue(aCapture.pieceType) : 0;
        const bValue = bCapture ? pieceValue(bCapture.pieceType) : 0;

        // Captures first (higher value captures first)
        if (aValue !== bValue) {
            return bValue - aValue; // Descending order
        }

        // Then checks (we'll check this in scoreMove, but prioritize moves that might be checks)
        // For now, just return captures first, then quiet moves
        return 0;
    });
}

function findBestMove(moves) {
    if (!moves || moves.length == 0) { return null; }
    const max = Math.max(...moves.map(o => o.score));
    moves = moves.filter(o => o.score == max);
    const rand = Math.floor(Math.random() * moves.length);
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

/**
 * Evaluates the current position statically (without searching deeper)
 * Returns score from the perspective of the current player (whose turn it is)
 */
function evaluatePosition(chess, currentTurn) {
    const state = chess.GameState;
    let score = 0;

    // Material evaluation from current player's perspective
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = state.board[i][j];
            if (piece) {
                const value = pieceValue(piece.pieceType);
                if (piece.color === currentTurn) {
                    score += value;
                } else {
                    score -= value;
                }
            }
        }
    }

    // Check bonus (negative for the player in check)
    if (chess.Check) {
        if (chess.Turn === currentTurn) {
            score -= 3; // Current player is in check (bad for them)
        } else {
            score += 3; // Opponent is in check (good for current player)
        }
    }

    return score;
}

function stateScore(chess, move) {
    let score = 0;
    const state = chess.GameState;
    const targetPiece = state.board[move.target.row][move.target.col];
    if (targetPiece == null) {
        score = 0;
    } else {
        score = pieceValue(targetPiece.pieceType);
    }
    return score;
}

/**
 * Scores a move using alpha-beta pruning
 * Score is calculated from the perspective of the player making the move
 * (matching brain4's logic for consistency)
 * 
 * @param {ChessGame} chess - The chess game instance
 * @param {Object} move - The move to evaluate
 * @param {number} alpha - Best value for maximizing player
 * @param {number} beta - Best value for minimizing player
 * @param {string} originalTurn - The turn color at root level
 * @returns {number} - The score of this move (from the player making the move's perspective)
 */
function scoreMove(chess, move, alpha, beta, originalTurn) {
    // Score is from the perspective of the player making the move (before the move)
    const movePlayerTurn = chess.Turn;
    let score = stateScore(chess, move);

    chess.makeMove(move.source, move.target);

    // Checkmate is the best outcome for the player who delivered it
    if (chess.Checkmate) {
        chess.undo();
        // Score is from the perspective of who made the move
        return 9999;
    }

    // Promotion bonus
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

    // Endgame check bonus (from the perspective of who made the move)
    if (chess.Moves.length > 50) {
        if (chess.Check) {
            // If the opponent (who it's now their turn) is in check, that's good for us
            // Score is from our perspective (the player who just moved)
            score += 3;
        }
    }

    // Recursively evaluate opponent's best response
    if (depth < MAX_DEPTH) {
        // Determine if opponent is the original player or not
        const opponentIsOriginal = (chess.Turn === originalTurn);

        // For alpha-beta bounds from original player's perspective:
        // - If opponent is original player: use normal bounds (alpha, beta)
        // - If opponent is not original: flip and negate bounds
        //   Their perspective is inverted: their alpha (best for them) = our -beta (worst for us)
        //   Their beta (worst for them) = our -alpha (best for us)
        let opponentAlpha, opponentBeta;
        if (opponentIsOriginal) {
            opponentAlpha = alpha;
            opponentBeta = beta;
        } else {
            // Flip bounds: opponent's good = our bad
            opponentAlpha = -beta;
            opponentBeta = -alpha;
        }

        const opponentResult = suggestMove(chess, opponentAlpha, opponentBeta, originalTurn);
        if (opponentResult && opponentResult.score !== undefined) {
            // Opponent's score is from their perspective (positive = good for them)
            // We subtract it to flip to our perspective (positive = good for us)
            // This matches brain4's logic exactly: score -= opponentMove.score
            score -= opponentResult.score;
        }
    } else {
        // At max depth: after our move, it's now the opponent's turn
        // Evaluate from opponent's perspective, then subtract to get our perspective
        // This matches the recursive case above
        const opponentEval = evaluatePosition(chess, chess.Turn);
        score -= opponentEval;
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

    console.log("Brain 5 worker thread initialized and ready");

    // Listen for messages from main thread
    parentPort.on("message", (request) => {
        const { requestId, gameState } = request;

        if (!requestId || !gameState) {
            console.error("Worker thread: Invalid request received", request);
            parentPort.postMessage({ requestId: request?.requestId || 0, error: "Invalid request format" });
            return;
        }

        console.log(`Brain 5 is thinking... (request ${requestId})`);
        const startTime = Date.now();

        try {
            depth = 0;
            chess.loadGame(gameState);
            chess.SearchMode = true;
            const move = suggestMove(chess);
            chess.SearchMode = false;

            const duration = Date.now() - startTime;
            console.log(`Brain 5 completed request ${requestId} in ${duration}ms`);

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

