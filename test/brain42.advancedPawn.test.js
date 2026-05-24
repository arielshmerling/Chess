/**
 * Brain 4.2 stacked advanced-pawn bonus.
 * Run: npx mocha ./test/brain42.advancedPawn.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");

function emptyStateBase(turn) {
    const board = {};
    for (let row = 0; row < 8; row++) {
        board[row] = Array(8).fill(null);
    }
    return {
        board,
        turn,
        whitePlayerView: true,
        capturedPiecesList: [],
        promoting: false,
    };
}

function loadWhitePawn(game, row, col) {
    const s = emptyStateBase("white");
    const P = 0;
    s.board[row][col] = { color: "white", pieceType: P };
    game.loadGame(JSON.stringify(s));
}

describe("Brain 4.2 advanced pawn bonus stacking", () => {
    const brain42 = require("../src/brain42");
    const se = { pawnAdvancedBonus: 0.2, doublePawnPenalty: 0 };

    it("white rank 5 (row 3) gets 20% of pawn value", () => {
        const game = new ChessGame(true);
        loadWhitePawn(game, 3, 1);
        const frac = brain42.getAdvancedPawnBonusFraction(3, "white", 0.2);
        assert.strictEqual(frac, 0.2);
        const bonus = brain42.getAdvancedPawnBonusForColor(game, "white", se);
        assert.ok(Math.abs(bonus - 0.2) < 1e-9);
    });

    it("white rank 6 (row 2) gets 40% of pawn value", () => {
        const game = new ChessGame(true);
        loadWhitePawn(game, 2, 1);
        assert.strictEqual(brain42.getAdvancedPawnBonusFraction(2, "white", 0.2), 0.4);
        assert.ok(Math.abs(brain42.getAdvancedPawnBonusForColor(game, "white", se) - 0.4) < 1e-9);
    });

    it("white rank 7 (row 1) gets 60% of pawn value", () => {
        const game = new ChessGame(true);
        loadWhitePawn(game, 1, 1);
        assert.ok(Math.abs(brain42.getAdvancedPawnBonusFraction(1, "white", 0.2) - 0.6) < 1e-9);
        assert.ok(Math.abs(brain42.getAdvancedPawnBonusForColor(game, "white", se) - 0.6) < 1e-9);
    });

    it("black rank 4/3/2 (rows 4/5/6) get 20%, 40%, 60% each", () => {
        const P = 0;
        let game = new ChessGame(true);
        const s4 = emptyStateBase("black");
        s4.board[4][1] = { color: "black", pieceType: P };
        game.loadGame(JSON.stringify(s4));
        assert.ok(Math.abs(brain42.getAdvancedPawnBonusForColor(game, "black", se) - 0.2) < 1e-9);

        game = new ChessGame(true);
        const s5 = emptyStateBase("black");
        s5.board[5][1] = { color: "black", pieceType: P };
        game.loadGame(JSON.stringify(s5));
        assert.ok(Math.abs(brain42.getAdvancedPawnBonusForColor(game, "black", se) - 0.4) < 1e-9);

        game = new ChessGame(true);
        const s6 = emptyStateBase("black");
        s6.board[6][1] = { color: "black", pieceType: P };
        game.loadGame(JSON.stringify(s6));
        assert.ok(Math.abs(brain42.getAdvancedPawnBonusForColor(game, "black", se) - 0.6) < 1e-9);
    });
});
