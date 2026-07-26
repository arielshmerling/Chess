/**
 * Phase 2: GameSession + LocalEngineMode characterization.
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const {
    GameSession,
    LocalEngineMode,
    ReviewMode,
    MODE_IDS,
    getModeCapabilities,
} = require("../src/session");

function silentGame() {
    const game = new ChessGame();
    /* Avoid ChessGame constructor noise in mocha output when present. */
    return game;
}

describe("session GameSession (Phase 2)", function () {
    it("start emits boardChanged then turnChanged then statusChanged", function () {
        const game = silentGame();
        const session = GameSession.create({
            game: game,
            humanIsWhite: true,
            meta: { engine: "brain43" },
        });
        const order = [];
        session.on("boardChanged", function () {
            order.push("boardChanged");
        });
        session.on("turnChanged", function (turn) {
            order.push("turnChanged:" + turn);
        });
        session.on("statusChanged", function (status) {
            order.push("statusChanged:" + status);
        });

        session.start({ humanIsWhite: true });

        assert.deepStrictEqual(order.slice(0, 3), [
            "boardChanged",
            "turnChanged:white",
            "statusChanged:inProgress",
        ]);
        assert.strictEqual(session.isHumanTurn(), true);
        assert.strictEqual(session.isAiTurn(), false);
        session.dispose();
    });

    it("playMove emits moveApplied before board/turn updates", function () {
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        session.start();
        const order = [];
        session.on("moveApplied", function () {
            order.push("moveApplied");
        });
        session.on("boardChanged", function () {
            order.push("boardChanged");
        });
        session.on("turnChanged", function (turn) {
            order.push("turnChanged:" + turn);
        });

        const executed = session.playMove({
            source: { row: 6, col: 4 },
            target: { row: 4, col: 4 },
        });

        assert.ok(executed);
        assert.deepStrictEqual(order.slice(0, 3), [
            "moveApplied",
            "boardChanged",
            "turnChanged:black",
        ]);
        assert.strictEqual(session.isAiTurn(), true);
        session.dispose();
    });

    it("applyMove mutates ChessGame without emitting moveApplied", function () {
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        session.start();
        const applied = [];
        session.on("moveApplied", function () {
            applied.push(1);
        });
        const before = game.Moves.length;
        const executed = session.applyMove({ row: 6, col: 4 }, { row: 4, col: 4 });
        assert.ok(executed);
        assert.strictEqual(game.Moves.length, before + 1);
        assert.deepStrictEqual(applied, []);
        session.dispose();
    });

    it("humanMoveApplied does not call makeMove again", function () {
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        session.start();
        const before = game.Moves.length;
        /* Board path: applyMove then humanMoveApplied after paint. */
        const executed = session.applyMove({ row: 6, col: 4 }, { row: 4, col: 4 });
        assert.strictEqual(game.Moves.length, before + 1);

        const moves = [];
        session.on("moveApplied", function (m) {
            moves.push(m);
        });
        session.humanMoveApplied(executed);
        assert.strictEqual(game.Moves.length, before + 1);
        assert.strictEqual(moves.length, 1);
        session.dispose();
    });

    it("humanMoveApplied emits boardChanged after moveApplied", function () {
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        session.start();
        const executed = session.applyMove({ row: 6, col: 4 }, { row: 4, col: 4 });
        const order = [];
        session.on("moveApplied", function () {
            order.push("moveApplied");
        });
        session.on("boardChanged", function () {
            order.push("boardChanged");
        });
        session.humanMoveApplied(executed);
        assert.deepStrictEqual(order.slice(0, 2), ["moveApplied", "boardChanged"]);
        session.dispose();
    });

    it("emits clocksUpdated after turnChanged when a clocks port is provided", function () {
        const game = silentGame();
        const turns = [];
        const session = GameSession.create({
            game: game,
            humanIsWhite: true,
            clocks: {
                onTurn: function (turn) {
                    turns.push(turn);
                },
                get: function () {
                    return { white: 60, black: 60 };
                },
            },
        });
        const order = [];
        session.on("turnChanged", function () {
            order.push("turnChanged");
        });
        session.on("clocksUpdated", function (snap) {
            order.push("clocksUpdated");
            assert.strictEqual(snap.white, 60);
        });
        session.start();
        assert.ok(order.indexOf("turnChanged") < order.indexOf("clocksUpdated"));
        assert.deepStrictEqual(turns, ["white"]);
        session.playMove({
            source: { row: 6, col: 4 },
            target: { row: 4, col: 4 },
        });
        assert.ok(turns.indexOf("black") !== -1);
        session.dispose();
    });

    it("resign emits gameOver", function () {
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        session.start();
        let over = null;
        session.on("gameOver", function (payload) {
            over = payload;
        });
        session.resign("White");
        assert.ok(over);
        assert.strictEqual(over.kind, "resign");
        assert.ok(game.GameOver);
        session.dispose();
    });

    it("undoPair and redoPair emit undone/redone and restore turns", function () {
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        session.start();
        session.playMove({
            source: { row: 6, col: 4 },
            target: { row: 4, col: 4 },
        });
        session.playMove({
            source: { row: 1, col: 4 },
            target: { row: 3, col: 4 },
        });
        assert.ok(game.Moves.length >= 2);

        let undone = false;
        let redone = false;
        session.on("undone", function () {
            undone = true;
        });
        session.on("redone", function () {
            redone = true;
        });

        assert.ok(session.undo());
        assert.ok(undone);
        assert.strictEqual(session.isHumanTurn(), true);

        assert.ok(session.redo());
        assert.ok(redone);
        assert.strictEqual(session.isHumanTurn(), true);
        session.dispose();
    });

    it("selectPromotion completes a pending promotion and emits moveApplied", function () {
        const completed = [];
        const fakeGame = {
            GameOver: false,
            Turn: "white",
            GameState: { turn: "white", promoting: true },
            KNIGHT: 2,
            QUEEN: 5,
            LastMove: { promotion: true, source: { row: 1, col: 0 }, target: { row: 0, col: 0 } },
            Moves: [],
            completePromotion: function (move) {
                completed.push(move.selectedPiece);
                move.promotion = false;
                this.GameState = { turn: "black", promoting: false };
                this.Turn = "black";
                this.LastMove = move;
            },
        };
        const session = GameSession.create({ game: fakeGame, humanIsWhite: true });
        session.load({ active: true });
        const applied = [];
        session.on("moveApplied", function (move, info) {
            applied.push(info.source);
        });
        assert.ok(session.selectPromotion(5));
        assert.deepStrictEqual(completed, [5]);
        assert.deepStrictEqual(applied, ["promotion"]);
        assert.ok(!session.selectPromotion(5));
        session.dispose();
    });

    it("flagTimeout emits gameOver timeout", function () {
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        session.start();
        let over = null;
        session.on("gameOver", function (payload) {
            over = payload;
        });
        assert.ok(session.flagTimeout("white"));
        assert.ok(over);
        assert.strictEqual(over.kind, "timeout");
        assert.strictEqual(over.loser, "white");
        assert.ok(game.GameOver);
        session.dispose();
    });
});

describe("session LocalEngineMode (Phase 2)", function () {
    it("exposes localEngine capabilities", function () {
        const mode = LocalEngineMode.create({});
        assert.strictEqual(mode.id, MODE_IDS.LOCAL_ENGINE);
        const caps = mode.capabilities();
        assert.strictEqual(caps.engine, true);
        assert.strictEqual(caps.network, false);
        assert.deepStrictEqual(caps, getModeCapabilities(MODE_IDS.LOCAL_ENGINE));
    });

    it("after a human move, requests the engine and applies the reply", async function () {
        const game = silentGame();
        const engineCalls = [];
        const fakeEngine = {
            computeMove: async function (args) {
                engineCalls.push(args);
                /* Reply with a legal black move: e7-e5 */
                return {
                    source: { row: 1, col: 4 },
                    target: { row: 3, col: 4 },
                    piece: { color: "black", pieceType: 1 },
                };
            },
            abortSearch: function () {},
        };

        const session = GameSession.create({
            game: game,
            humanIsWhite: true,
            engine: fakeEngine,
            meta: { engine: "brain43", thinkingTimeSeconds: 2 },
        });
        const mode = LocalEngineMode.create({});
        session.attachMode(mode);

        const order = [];
        session.on("moveApplied", function (_m, info) {
            order.push("move:" + (info && info.source));
        });
        session.on("turnChanged", function (turn) {
            order.push("turn:" + turn);
        });

        session.start();
        /* Wait for onStarted maybeRunEngine — human is white so it should no-op. */
        await new Promise(function (r) {
            setImmediate(r);
        });
        assert.strictEqual(engineCalls.length, 0);

        session.playMove({
            source: { row: 6, col: 4 },
            target: { row: 4, col: 4 },
        });

        /* LocalEngineMode schedules maybeRunEngine on Promise.resolve(). */
        await new Promise(function (r) {
            setImmediate(r);
        });
        await new Promise(function (r) {
            setImmediate(r);
        });

        assert.strictEqual(engineCalls.length, 1);
        assert.ok(order.indexOf("move:human") !== -1 || order.indexOf("move:session") !== -1);
        assert.ok(order.indexOf("move:engine") !== -1);
        assert.ok(game.Moves.length >= 2);
        assert.strictEqual(session.isHumanTurn(), true);
        session.dispose();
    });

    it("uses applyEngineMove hook when provided (shell animation path)", async function () {
        const game = silentGame();
        let applied = null;
        const fakeEngine = {
            computeMove: async function () {
                return {
                    source: { row: 1, col: 4 },
                    target: { row: 3, col: 4 },
                };
            },
        };
        const session = GameSession.create({
            game: game,
            humanIsWhite: true,
            engine: fakeEngine,
            meta: { engine: "brain43" },
        });
        const mode = LocalEngineMode.create({
            applyEngineMove: async function (move) {
                applied = move;
                session.playMove(move, { source: "engine" });
                return true;
            },
        });
        session.attachMode(mode);
        session.start();
        session.playMove({
            source: { row: 6, col: 4 },
            target: { row: 4, col: 4 },
        });
        await new Promise(function (r) {
            setImmediate(r);
        });
        await new Promise(function (r) {
            setImmediate(r);
        });
        assert.ok(applied);
        assert.strictEqual(applied.source.row, 1);
        session.dispose();
    });
});

describe("session ReviewMode (Phase 2)", function () {
    it("exposes review capabilities", function () {
        const mode = ReviewMode.create({});
        assert.strictEqual(mode.id, MODE_IDS.REVIEW);
        const caps = mode.capabilities();
        assert.strictEqual(caps.reviewNav, true);
        assert.strictEqual(caps.engine, false);
        assert.strictEqual(caps.undo, false);
        assert.deepStrictEqual(caps, getModeCapabilities(MODE_IDS.REVIEW));
    });

    it("loadNavigation and setPly emit reviewPlyChanged", function () {
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = ReviewMode.create({});
        session.attachMode(mode);
        const events = [];
        session.on("reviewPlyChanged", function (nav, meta) {
            events.push({ ply: nav.plyIndex, reason: meta && meta.reason, count: nav.moveCount });
        });
        mode.loadNavigation({
            moves: [
                { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
                { source: { row: 1, col: 4 }, target: { row: 3, col: 4 } },
            ],
            finalStateStr: "{}",
            originStateStr: "{}",
        });
        assert.strictEqual(mode.getNavState().plyIndex, 2);
        assert.strictEqual(mode.setPly(0), 0);
        assert.strictEqual(mode.getNavState().plyIndex, 0);
        assert.strictEqual(mode.getNavState().branchPly, 0);
        assert.ok(events.length >= 2);
        assert.strictEqual(events[0].reason, "load");
        assert.strictEqual(events[events.length - 1].ply, 0);
        session.dispose();
    });
});
