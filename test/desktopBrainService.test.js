/**
 * desktopBrainService helpers and computeMove edges (stubbed brain).
 */
"use strict";

const assert = require("assert");
const path = require("path");
const { ChessGame } = require("../src/ChessGame");

const svcPath = require.resolve("../src/desktop/desktopBrainService");
const brain41Path = require.resolve("../src/brain41");

describe("desktopBrainService", function () {
    let svc;
    let brain41;
    let origNext;

    beforeEach(function () {
        delete require.cache[svcPath];
        svc = require(svcPath);
        brain41 = require(brain41Path);
        origNext = brain41.brainNextMoveFunc;
    });

    afterEach(function () {
        brain41.brainNextMoveFunc = origNext;
        delete require.cache[svcPath];
    });

    it("normalizeMovesForBook keeps SAN-bearing plies", function () {
        assert.deepStrictEqual(svc.normalizeMovesForBook(null), []);
        const out = svc.normalizeMovesForBook([
            { moveStr: "e4" },
            JSON.stringify({ moveStr: "e5", source: { row: 1, col: 4 } }),
            "Nf3",
            "{bad",
            { foo: 1 },
            { moveStr: "   " },
        ]);
        assert.strictEqual(out.length, 4);
        assert.strictEqual(out[0].moveStr, "e4");
        assert.strictEqual(out[2].moveStr, "Nf3");
        assert.strictEqual(out[3].moveStr, "{bad");
    });

    it("computeMove rejects missing state and returns null when over", async function () {
        await assert.rejects(() => svc.computeMove({}), /Missing game state/);
        const game = new ChessGame(true);
        game.startNewGame(true);
        game.resign("White");
        const state = JSON.parse(game.SavedGameState);
        const move = await svc.computeMove({ gameState: state, engine: "brain41" });
        assert.strictEqual(move, null);
    });

    it("computeMove uses brain and supports abort", async function () {
        this.timeout(10000);
        brain41.brainNextMoveFunc = async function () {
            return {
                source: { row: 6, col: 4 },
                target: { row: 4, col: 4 },
                valid: true,
            };
        };
        const game = new ChessGame(true);
        game.startNewGame(true);
        const state = JSON.parse(game.SavedGameState);
        const move = await svc.computeMove({
            gameState: state,
            engine: "brain41",
            thinkingTimeSeconds: 2,
            moves: [{ moveStr: "e4" }],
        });
        assert.ok(move);
        assert.ok(move.source);

        svc.abortSearch();
        brain41.brainNextMoveFunc = async function () {
            throw new svc.SearchAbortedError();
        };
        /* After abortSearch, next computeMove resets the flag at start */
        brain41.brainNextMoveFunc = async function () {
            return {
                source: { row: 6, col: 4 },
                target: { row: 4, col: 4 },
            };
        };
        const again = await svc.computeMove({ gameState: state, engine: "brain41" });
        assert.ok(again);
    });

    it("evaluatePosition rejects unsupported engines", async function () {
        const game = new ChessGame(true);
        game.startNewGame(true);
        await assert.rejects(
            () =>
                svc.evaluatePosition({
                    gameState: JSON.parse(game.SavedGameState),
                    engine: "brain41",
                }),
            /not supported/,
        );
    });
});
