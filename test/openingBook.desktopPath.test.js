/**
 * Desktop rebuilds ChessGame from GameState only; moves must be passed for line-book prefix.
 * Run: npx mocha ./test/openingBook.desktopPath.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const { movePrefixFromGame } = require("../src/openingBookLines");
const { normalizeMovesForBook } = require("../src/desktop/desktopBrainService");

function simulateDesktopBrainGame(gameState, moves) {
    const chessGame = new ChessGame(true);
    chessGame.loadGame(JSON.stringify(gameState));
    const bookMoves = normalizeMovesForBook(moves);
    if (bookMoves.length > 0) {
        chessGame.loadMoves(bookMoves);
    }
    return chessGame;
}

describe("opening book desktop path", () => {
    it("restores move prefix when GameState is loaded without history", async function () {
        this.timeout(30000);
        const brain43 = require("../src/brain43");
        await brain43.whenOpeningBookReady();

        const upright = new ChessGame();
        upright.startNewGame(true);
        const e4 = upright.convertPGNMove({ moveStr: "e4", color: "white" });
        upright.makeMove(e4.source, e4.target);

        const desktopGame = simulateDesktopBrainGame(
            upright.GameState,
            upright.Moves.map((m) => ({ moveStr: m.moveStr })),
        );

        assert.strictEqual(movePrefixFromGame(desktopGame), "e4");

        const move = await brain43.brainNextMoveFunc(desktopGame, {
            pliesPlayed: desktopGame.Moves.length,
            thinkingTimeMs: 500,
        });
        assert.strictEqual(move.searchDepthReached, 0, "should hit book on move 2");
        brain43.shutdownWorkers && brain43.shutdownWorkers();
    });
});
