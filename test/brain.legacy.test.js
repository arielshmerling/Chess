/**
 * Legacy Brain v1.7 nextMove coverage (stub Mongo State lookups).
 */
"use strict";

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const { State } = require("../src/modules/game/model");
const { Brain } = require("../src/brain");

describe("legacy Brain v1.7", function () {
    this.timeout(10000);

    let origFind;

    beforeEach(function () {
        origFind = State.find;
        State.find = async function () {
            return {
                async *[Symbol.asyncIterator]() {
                    /* empty */
                },
            };
        };
    });

    afterEach(function () {
        State.find = origFind;
    });

    it("Version and nextMove return a legal ply", async function () {
        const brain = new Brain();
        assert.ok(String(brain.Version).includes("Brain"));
        brain.MAX_DEPTH = 1;
        const game = new ChessGame(true);
        game.startNewGame(true);
        const move = await brain.nextMove(game);
        assert.ok(move && move.source && move.target);
        brain.cancel();
    });
});
