/**
 * Midgame brain42/43 searches (bypass opening book) for search-path coverage.
 */
"use strict";

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const brain42 = require("../src/brain42");
const brain43 = require("../src/brain43");

function playSan(game, san) {
    const turn = game.Turn;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = game.GameState.board[row][col];
            if (!piece || piece.color !== turn) {
                continue;
            }
            const source = game.square(row, col);
            const options = game.possibleMoves(source);
            for (let i = 0; i < options.length; i++) {
                const move = options[i];
                game.makeMove(move.source, move.target);
                if (move.promotion && move.selectedPiece != null) {
                    game.completePromotion(move);
                }
                const notation = game.Moves[game.Moves.length - 1].moveStr;
                if (notation === san || notation.replace(/[+#]/g, "") === san.replace(/[+#]/g, "")) {
                    return;
                }
                game.undo();
            }
        }
    }
    throw new Error(`SAN not found: ${san}`);
}

function midgame() {
    const moves = [
        "e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4", "Nxd4", "Qxd4", "Nf6", "Kd2", "Ng4",
    ];
    const game = new ChessGame(true);
    game.startNewGame(true);
    for (let i = 0; i < moves.length; i++) {
        playSan(game, moves[i]);
    }
    return game;
}

describe("brain42/43 midgame search coverage", function () {
    this.timeout(45000);

    after(function () {
        brain42.abortActiveSearch();
        brain43.abortActiveSearch();
        if (typeof brain42.shutdownWorkers === "function") {
            brain42.shutdownWorkers();
        }
        if (typeof brain43.shutdownWorkers === "function") {
            brain43.shutdownWorkers();
        }
    });

    it("brain42 searches a midgame position", async function () {
        await brain42.whenOpeningBookReady();
        const game = midgame();
        const move = await brain42.brainNextMoveFunc(game, {
            maxDepth: 3,
            thinkingTimeMs: 1500,
        });
        assert.ok(move && move.source && move.target);
        assert.ok(move.searchDepthReached == null || move.searchDepthReached >= 0);
    });

    it("brain43 searches a midgame position", async function () {
        await brain43.whenOpeningBookReady();
        const game = midgame();
        const move = await brain43.brainNextMoveFunc(game, {
            maxDepth: 3,
            thinkingTimeMs: 1500,
        });
        assert.ok(move && move.source && move.target);
    });
});
