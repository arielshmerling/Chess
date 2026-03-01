
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const { State } = require("./modules/game/model");
const { ChessGame } = require("./ChessGame");
var chess;
var depth = 0;
const DEFAULT_MAX_DEPTH = 4;

exports.Name = "Brain 3.0";

exports.brainNextMoveFunc = async (game, options) => {

    const state = game.GameState;
    const strState = JSON.stringify(state);
    const maxDepth = options?.maxDepth != null ? Math.min(5, Math.max(1, Number(options.maxDepth))) : DEFAULT_MAX_DEPTH;
    const move = await tryFindMatchState(game);
    if (move) {
        // resolve(move);
        return move;
    }
    return new Promise((resolve, reject) => {
        if (isMainThread) {
            const worker = new Worker(__filename, { workerData: { strState, maxDepth } });
            worker.on("message", (move) => {
                console.log(`Worker message received: ${move}`);
                resolve(move);

            });
            worker.on("error", (err) => {
                console.error(err);
                reject();

            });
        }

    });
};

function suggestMove(chess, maxDepth) {
    depth++;
    const moves = allPossibleMoves(chess);
    if (depth > maxDepth) {
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
            return 3;
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
    depth = 0;
    const strState = typeof workerData === "object" && workerData != null && workerData.strState != null
        ? workerData.strState
        : workerData;
    const maxDepth = typeof workerData === "object" && workerData != null && workerData.maxDepth != null
        ? Math.min(5, Math.max(1, Number(workerData.maxDepth)))
        : DEFAULT_MAX_DEPTH;
    chess = new ChessGame();
    chess.loadGame(strState);
    chess.SearchMode = true;
    const move = suggestMove(chess, maxDepth);
    chess.SearchMode = false;
    move.turn = chess.Turn;
    parentPort.postMessage(move);
}