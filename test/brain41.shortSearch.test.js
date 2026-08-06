/**
 * Short brain41 search to exercise search/eval paths meaningfully.
 */
"use strict";

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const brain41 = require("../src/brain41");

describe("brain41 short search", function () {
    this.timeout(20000);

    after(function () {
        if (typeof brain41.abortActiveSearch === "function") {
            brain41.abortActiveSearch();
        }
    });

    it("returns a legal opening move at low depth", async function () {
        const game = new ChessGame(true);
        game.startNewGame(true);
        const move = await brain41.brainNextMoveFunc(game, {
            maxDepth: 1,
            thinkingTimeMs: 200,
        });
        assert.ok(move);
        assert.ok(move.source);
        assert.ok(move.target);
        const applied = game.makeMove(move.source, move.target);
        assert.ok(applied);
    });

    it("abortActiveSearch is safe while idle", function () {
        brain41.abortActiveSearch();
    });
});
