/**
 * SinglePlayerMessageProcessor info/command/move paths with a fake game.
 */
"use strict";

const assert = require("assert");
const { SinglePlayerMessageProcessor } = require("../src/modules/game/SinglePlayerMessageProcessor");
const gameClocks = require("../src/modules/game/gameClocks");

function fakeGame(overrides) {
    const sent = [];
    const watchers = [];
    const g = {
        gameId: "g1",
        moves: [],
        startedOn: null,
        lastMoveOn: null,
        chessGame: { GameOver: false },
        sendMessage(msg) {
            sent.push(msg);
        },
        sendInfoToWatchers(msg) {
            watchers.push(msg);
        },
        sendMoveToWatchers() {},
        sendClockSyncToWatchers() {},
        updateLastMoveTime() {},
        async resign() {},
        async draw(_by, cb) {
            if (cb) {
                cb();
            }
        },
        async handleMove() {
            return { valid: true, moveStr: "e4" };
        },
        makeBrainMove() {},
        usesClientEngine() {
            return true;
        },
        load() {},
        createRemtach(_isWhite, cb) {
            const ng = {
                gameId: "g2",
                whitePlayer: { channel: {}, userId: "u" },
                blackPlayer: { channel: {}, userId: null },
                sendMessage(m) {
                    sent.push(m);
                },
                init() {},
            };
            cb(ng);
        },
        closeGame() {},
        ...overrides,
    };
    g._sent = sent;
    g._watchers = watchers;
    return g;
}

describe("SinglePlayerMessageProcessor", function () {
    const proc = new SinglePlayerMessageProcessor();

    it("handles rematch offer and early draw decline", async function () {
        const game = fakeGame({ moves: new Array(4).fill({}) });
        await proc.onInfoReceived(game, { info: "offer rematch", isWhite: true });
        assert.ok(game._sent.some((m) => m.info === "offer rematch"));

        await proc.onInfoReceived(game, { info: "offer draw", isWhite: true, gameId: "g1" });
        assert.ok(game._sent.some((m) => m.info === "draw declined"));
        assert.ok(game._watchers.some((m) => m.info === "draw declined"));
    });

    it("accepts draw after 10 full moves", async function () {
        const game = fakeGame({ moves: new Array(20).fill({}) });
        await proc.onInfoReceived(game, { info: "offer draw", isWhite: false, gameId: "g1" });
        assert.ok(game._sent.some((m) => m.info === "draw accepted"));
    });

    it("resigns with optional clock snapshot", async function () {
        let snap;
        const game = fakeGame({
            async resign(_side, opts) {
                snap = opts;
            },
        });
        await proc.onInfoReceived(game, {
            info: "resign",
            isWhite: true,
            whiteTimer: 10,
            blackTimer: 20,
            moveTime: 3,
        });
        assert.ok(snap && snap.resignClockSnapshot);
        assert.strictEqual(snap.resignClockSnapshot.whiteTimer, 10);
    });

    it("move accepted and clockSync forward timers", async function () {
        let clockArgs = null;
        const game = fakeGame({
            moves: [{}],
            sendClockSyncToWatchers(w, b) {
                clockArgs = [w, b];
            },
        });
        await proc.onInfoReceived(game, {
            info: "move accepted",
            moveTime: 1,
            whiteTimer: 5,
            blackTimer: 6,
        });
        assert.deepStrictEqual(clockArgs, [5, 6]);
        await proc.onInfoReceived(game, { info: "clockSync", whiteTimer: 1, blackTimer: 2 });
        assert.deepStrictEqual(clockArgs, [1, 2]);
    });

    it("outOfTime delegates to tryClientFlagHint", async function () {
        const orig = gameClocks.tryClientFlagHint;
        let seen = null;
        gameClocks.tryClientFlagHint = async (g, loser) => {
            seen = { g, loser };
        };
        try {
            const game = fakeGame();
            await proc.onInfoReceived(game, { info: "outOfTime", loser: "black" });
            assert.strictEqual(seen.loser, "black");
            await proc.onInfoReceived(game, { info: "outOfTime", loser: "nope" });
        } finally {
            gameClocks.tryClientFlagHint = orig;
        }
    });

    it("setState and clientEngineMove commands", async function () {
        let loaded = null;
        const game = fakeGame({
            status: "waiting",
            load(s) {
                loaded = s;
            },
            async handleMove() {
                return { valid: true };
            },
        });
        proc.onCommandReceived(game, { info: "setState", data: { turn: "white" } });
        assert.deepStrictEqual(loaded, { turn: "white" });
        await proc.onCommandReceived(game, {
            info: "clientEngineMove",
            isWhite: true,
            data: { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            gameId: "g1",
            moveTime: 2,
            whiteTimer: 9,
            blackTimer: 8,
        });
        assert.ok(game.startedOn);
    });

    it("rejects setState while the SP game is in progress", function () {
        let loaded = null;
        const game = fakeGame({
            status: "in progress",
            load(s) {
                loaded = s;
            },
        });
        proc.onCommandReceived(game, { info: "setState", data: { turn: "black" } });
        assert.strictEqual(loaded, null);
    });

    it("clockSync prefers server clocks when present", async function () {
        let clockArgs = null;
        const game = fakeGame({
            clockWhiteSec: 40,
            clockBlackSec: 50,
            sendClockSyncToWatchers(w, b) {
                clockArgs = [w, b];
            },
        });
        await proc.onInfoReceived(game, { info: "clockSync", whiteTimer: 1, blackTimer: 2 });
        assert.deepStrictEqual(clockArgs, [40, 50]);
    });

    it("onMoveReceived validates and may request brain", async function () {
        let brain = 0;
        const game = fakeGame({
            usesClientEngine() {
                return false;
            },
            makeBrainMove() {
                brain += 1;
            },
        });
        await proc.onMoveReceived(game, {
            isWhite: true,
            data: {},
            gameId: "g1",
        });
        assert.ok(game._sent.some((m) => m.info === "move validated successfully"));
        assert.strictEqual(brain, 1);

        game.handleMove = async () => ({ valid: false });
        await proc.onMoveReceived(game, { isWhite: true, data: {}, gameId: "g1" });
        assert.ok(game._sent.some((m) => m.info === "move validation failed"));
    });

    it("rematch accepted creates a new game", async function () {
        const game = fakeGame();
        await proc.onInfoReceived(game, { info: "rematch accepted", isWhite: true });
        assert.ok(game._sent.some((m) => m.gameId === "g2"));
    });
});
