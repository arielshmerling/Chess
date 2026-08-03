/**
 * Engine registry + UCI backend routing tests.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
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

    it("accepts STOCKFISH_PATH with a custom filename and strips quotes", function () {
        const def = registry.getEngine("stockfish");
        const cmd = registry.resolveUciCommand(def, {
            STOCKFISH_PATH: '"C:\\Engines\\stockfish-windows-x86-64-avx2.exe"',
        });
        assert.strictEqual(cmd, "C:\\Engines\\stockfish-windows-x86-64-avx2.exe");
    });

    it("uses stockfish.exe PATH fallback on win32 when env unset", function () {
        const def = registry.getEngine("stockfish");
        const original = process.platform;
        Object.defineProperty(process, "platform", { value: "win32" });
        try {
            const cmd = registry.resolveUciCommand(def, {
                USERPROFILE: path.join(__dirname, "no-such-user-profile-for-stockfish"),
                LOCALAPPDATA: path.join(__dirname, "no-such-local-appdata-for-stockfish"),
            });
            assert.ok(cmd === "stockfish.exe" || /stockfish\.exe$/i.test(cmd) || /stockfish$/i.test(cmd));
            if (!cmd.includes("/") && !cmd.includes("\\")) {
                assert.strictEqual(cmd, "stockfish.exe");
            }
        } finally {
            Object.defineProperty(process, "platform", { value: original });
        }
    });

    it("discovers stockfish under SHMERLING_USER_DATA/engines", function () {
        const dir = path.join(__dirname, "fixtures", "fake-stockfish-home", "engines");
        fs.mkdirSync(dir, { recursive: true });
        const fake = path.join(dir, process.platform === "win32" ? "stockfish.exe" : "stockfish");
        fs.writeFileSync(fake, "#!/bin/sh\nexit 0\n");
        try {
            fs.chmodSync(fake, 0o755);
        } catch {
            /* windows */
        }
        try {
            const found = registry.findExistingCandidate(
                { SHMERLING_USER_DATA: path.join(__dirname, "fixtures", "fake-stockfish-home") },
                "stockfish",
            );
            assert.strictEqual(found, fake);
        } finally {
            try {
                fs.unlinkSync(fake);
            } catch {
                /* ignore */
            }
        }
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

    it("abortSearch stops both brain and UCI backends", function () {
        assert.strictEqual(typeof engineService.abortSearch, "function");
        engineService.abortSearch();
    });
});
