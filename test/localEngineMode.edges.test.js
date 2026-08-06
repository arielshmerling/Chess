/**
 * LocalEngineMode resign / abort / canRun / error branches.
 */
"use strict";

const assert = require("assert");
const LocalEngineMode = require("../src/session/localEngineMode");
const GameSession = require("../src/session/gameSession");
const { ChessGame } = require("../src/ChessGame");

function silentGame() {
    const game = new ChessGame();
    game.startNewGame(true);
    return game;
}

describe("LocalEngineMode edge branches", function () {
    it("aborts search and respects canRun=false", async function () {
        let aborted = 0;
        const fakeEngine = {
            computeMove: async function () {
                return {
                    source: { row: 1, col: 4 },
                    target: { row: 3, col: 4 },
                };
            },
            abortSearch() {
                aborted += 1;
            },
        };
        const session = GameSession.create({
            game: silentGame(),
            humanIsWhite: true,
            engine: fakeEngine,
            meta: { engine: "brain43" },
        });
        const mode = LocalEngineMode.create({
            canRun: () => false,
            autoRunOnAttach: false,
        });
        session.attachMode(mode);
        session.start();
        session.playMove({ source: { row: 6, col: 4 }, target: { row: 4, col: 4 } });
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        mode.abort();
        assert.ok(aborted >= 1);
        mode.detach();
        session.dispose();
    });

    it("immediate resign decision path", async function () {
        let resigned = null;
        const game = silentGame();
        const fakeEngine = {
            computeMove: async function () {
                return {
                    opponentMateDetected: true,
                    opponentMateIn: 2,
                    source: { row: 1, col: 4 },
                    target: { row: 3, col: 4 },
                };
            },
        };
        const session = GameSession.create({
            game,
            humanIsWhite: true,
            engine: fakeEngine,
            meta: { engine: "brain43" },
        });
        session.resign = function (side) {
            resigned = side;
        };
        const mode = LocalEngineMode.create({
            immediateResign: () => true,
            autoRunOnAttach: false,
        });
        session.attachMode(mode);
        session.start();
        session.playMove({ source: { row: 6, col: 4 }, target: { row: 4, col: 4 } });
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setTimeout(r, 30));
        assert.strictEqual(resigned, "Black");
        mode.onGameOver();
        session.dispose();
    });

    it("reports engine compute errors", async function () {
        const statuses = [];
        const fakeEngine = {
            computeMove: async function () {
                throw new Error("boom");
            },
        };
        const session = GameSession.create({
            game: silentGame(),
            humanIsWhite: true,
            engine: fakeEngine,
            meta: { engine: "brain43" },
        });
        const mode = LocalEngineMode.create({
            autoRunOnAttach: false,
            onStatus(msg, kind) {
                statuses.push({ msg, kind });
            },
        });
        session.attachMode(mode);
        session.start();
        session.playMove({ source: { row: 6, col: 4 }, target: { row: 4, col: 4 } });
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setTimeout(r, 20));
        assert.ok(statuses.some((s) => s.kind === "error"));
        session.dispose();
    });
});
