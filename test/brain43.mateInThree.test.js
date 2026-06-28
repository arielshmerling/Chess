/**
 * Brain 4.3 finds forced mate in three (Kxf8+ line) using parallel root search.
 * Run: npx mocha ./test/brain43.mateInThree.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const brain43 = require("../src/brain43");
const { getDefaultConfig } = require("../src/modules/game/brainConfigService");

const MATE_IN_THREE_STATE = {
    board: [
        [{ color: "black", pieceType: 4 }, null, null, null, null, null, null, { color: "black", pieceType: 1 }],
        [null, { color: "black", pieceType: 3 }, { color: "black", pieceType: 5 }, { color: "black", pieceType: 0 }, { color: "black", pieceType: 2 }, { color: "white", pieceType: 5 }, { color: "black", pieceType: 0 }, { color: "black", pieceType: 0 }],
        [{ color: "black", pieceType: 0 }, null, { color: "black", pieceType: 2 }, null, null, null, null, null],
        [null, { color: "black", pieceType: 0 }, null, null, null, null, { color: "white", pieceType: 2 }, null],
        [null, null, null, { color: "black", pieceType: 3 }, { color: "white", pieceType: 0 }, null, null, null],
        [null, null, { color: "white", pieceType: 2 }, null, null, null, null, null],
        [{ color: "white", pieceType: 0 }, { color: "white", pieceType: 0 }, { color: "white", pieceType: 0 }, null, null, null, { color: "white", pieceType: 0 }, { color: "white", pieceType: 0 }],
        [null, null, null, null, null, { color: "white", pieceType: 4 }, null, { color: "white", pieceType: 1 }],
    ],
    turn: "white",
    capturedPiecesList: [],
    check: false,
    checkmate: false,
    draw: false,
    drawReason: "",
    resigned: "",
    outOfTime: "",
    whiteKingMoved: true,
    blackKingMoved: true,
    whitePlayerView: true,
    fiftyMovesCounter: 0,
    gameOver: false,
    promoting: false,
    kingsideWhiteRookMoved: true,
    queensideWhiteRookMoved: true,
    kingsideBlackRookMoved: true,
    queensideBlackRookMoved: false,
};

/** Kf7xf8+ Rxf8 Qxf8+ Ne7g8 Ng5f7# in engine notation (Kf7 shown as Qf7). */
const MATE_LINE = ["Qf7f8", "Ra8f8", "Rf1f8", "Ne7g8", "Ng5f7"];

function loadPosition() {
    const game = new ChessGame();
    game.loadGame(JSON.stringify(MATE_IN_THREE_STATE));
    return game;
}

function allMoves(game) {
    let moves = [];
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = game.GameState.board[i][j];
            if (!piece || piece.color !== game.Turn) {
                continue;
            }
            const groups = game.possibleMoves(game.square(i, j));
            for (let k = 0; k < groups.length; k++) {
                const group = groups[k];
                if (Array.isArray(group)) {
                    moves = moves.concat(group);
                } else {
                    moves.push(group);
                }
            }
        }
    }
    return moves;
}

describe("Brain 4.3 mate in three", () => {
    it("reference line delivers checkmate", () => {
        const game = loadPosition();
        for (const notation of MATE_LINE) {
            const move = allMoves(game).find((m) => game.getSimpleNotation(m) === notation);
            assert.ok(move, `missing move ${notation}`);
            game.makeMove(move.source, move.target);
            if (move.promotion) {
                game.completePromotion(move);
            }
        }
        assert.strictEqual(game.Checkmate, true);
    });

    it("finds Kxf8+ at depth 5 (sequential root search, same as Brain 4.2)", async function () {
        this.timeout(120000);
        const game = loadPosition();
        const move = await brain43.brainNextMoveFunc(game, {
            maxDepth: 5,
            config: getDefaultConfig("brain43"),
            pliesPlayed: 40,
        });
        assert.strictEqual(game.getSimpleNotation(move), "Qf7f8");
    });
});
