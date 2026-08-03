/**
 * Engine registry + UCI backend routing tests.
 */
"use strict";

const assert = require("assert");
const path = require("path");
const { ChessGame } = require("../src/ChessGame");
const registry = require("../src/engines/registry");
const uciBackend = require("../src/engines/uci/uciBackend");
const engineService = require("../src/engines/engineService");

describe("engines registry", function () {
    it("lists Play brains and stockfish", function () {
        const ids = registry.playEngineIds();
        assert.ok(ids.includes("brain43"));
        assert.ok(ids.includes("stockfish"));
        assert.ok(!ids.includes("crafty"));
        assert.strictEqual(registry.getEngine("stockfish").backend, "uci");
    });

    it("resolves STOCKFISH_PATH from env", function () {
        const def = registry.getEngine("stockfish");
        const cmd = registry.resolveUciCommand(def, { STOCKFISH_PATH: "/opt/stockfish" });
        assert.strictEqual(cmd, "/opt/stockfish");
    });
});

describe("engines uciBackend", function () {
    this.timeout(15000);

    const wrapper = path.join(__dirname, "fixtures", "fake-uci-engine-wrapper.sh");

    beforeEach(function () {
        uciBackend.clearAvailabilityCache();
        uciBackend.disposeAll();
        process.env.STOCKFISH_PATH = wrapper;
    });

    afterEach(function () {
        uciBackend.disposeAll();
        uciBackend.clearAvailabilityCache();
        delete process.env.STOCKFISH_PATH;
        delete process.env.FAKE_UCI_ASSERT_SKILL;
    });

    it("probes availability using STOCKFISH_PATH", async function () {
        const ok = await uciBackend.probeAvailability("stockfish", {
            env: { STOCKFISH_PATH: wrapper },
            force: true,
            timeoutMs: 5000,
        });
        assert.strictEqual(ok.available, true);

        const resultMissing = await uciBackend.probeAvailability("stockfish", {
            env: { STOCKFISH_PATH: "/no/such/stockfish-binary" },
            force: true,
            timeoutMs: 1500,
        });
        assert.strictEqual(resultMissing.available, false);
    });

    it("computeMove returns a validated move via fake UCI", async function () {
        const game = new ChessGame(true);
        game.startNewGame(true);
        game.makeMove({ row: 6, col: 4 }, { row: 4, col: 4 });

        const move = await uciBackend.computeMove({
            gameState: game.GameState,
            engine: "stockfish",
            thinkingTimeSeconds: 1,
            pliesPlayed: 1,
        });
        assert.ok(move);
        assert.ok(move.source);
        assert.ok(move.target);
        assert.strictEqual(move.source.row, 1);
        assert.strictEqual(move.source.col, 4);
        assert.strictEqual(move.target.row, 3);
        assert.strictEqual(move.target.col, 4);
    });

    it("computeMove applies skillLevel to the UCI process", async function () {
        process.env.FAKE_UCI_ASSERT_SKILL = "3";
        const game = new ChessGame(true);
        game.startNewGame(true);
        game.makeMove({ row: 6, col: 4 }, { row: 4, col: 4 });

        const move = await uciBackend.computeMove({
            gameState: game.GameState,
            engine: "stockfish",
            thinkingTimeSeconds: 1,
            skillLevel: 3,
            pliesPlayed: 1,
        });
        assert.ok(move);
        assert.ok(move.source);
        delete process.env.FAKE_UCI_ASSERT_SKILL;
    });
});

describe("engines engineService routing", function () {
    it("rejects evaluatePosition for UCI engines", async function () {
        await assert.rejects(
            () => engineService.evaluatePosition({ gameState: {}, engine: "stockfish" }),
            /not supported/,
        );
    });
});
