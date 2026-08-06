/**
 * Mobile adapters — attach / sync paths with stubbed session globals.
 */
"use strict";

const assert = require("assert");
const MobileSessionReview = require("../src/mobile/mobile-session-review");
const MobileSessionLocalEngine = require("../src/mobile/mobile-session-local-engine");
const MobileSessionOnline = require("../src/mobile/mobile-session-online");
const GameSession = require("../src/session/gameSession");
const ReviewMode = require("../src/session/reviewMode");
const LocalEngineMode = require("../src/session/localEngineMode");
const { ChessGame } = require("../src/ChessGame");

describe("mobile session review attach", function () {
    afterEach(function () {
        delete global.ShmerlingGameSession;
        delete global.ShmerlingReviewMode;
        delete global.document;
        delete global.location;
        delete global.movePause;
        delete global.showMoveForReview;
        delete global.syncReviewClocksForCurrentPly;
        delete global.togglePlayPause;
        delete global.moveIndex;
    });

    it("isMobileReviewPage and sessionApisReady", function () {
        delete global.ShmerlingGameSession;
        delete global.ShmerlingReviewMode;
        /* Dual-export session modules may still expose globals from prior requires. */
        const ready = MobileSessionReview.sessionApisReady();
        assert.strictEqual(typeof ready, "boolean");
        global.location = { pathname: "/mobile-review" };
        assert.strictEqual(MobileSessionReview.isMobileReviewPage(), true);
        global.location = { pathname: "/other" };
        global.document = {
            getElementById(id) {
                if (id === "main") {
                    return { getAttribute: () => "true" };
                }
                return null;
            },
        };
        assert.strictEqual(MobileSessionReview.isMobileReviewPage(), true);
    });

    it("syncClassicBoardToPly replays and updates selection", function () {
        const calls = [];
        global.movePause = () => calls.push("pause");
        global.showMoveForReview = (m) => calls.push(m.moveStr);
        global.syncReviewClocksForCurrentPly = () => calls.push("clocks");
        global.togglePlayPause = () => calls.push("toggle");
        const cells = {
            td_move1: { classList: { add() {}, remove() {} } },
            td_move2: { classList: { add() {}, remove() {} } },
        };
        global.document = {
            querySelectorAll() {
                return {
                    forEach(fn) {
                        Object.values(cells).forEach(fn);
                    },
                };
            },
            getElementById(id) {
                return cells[id] || null;
            },
        };
        const game = {
            startNewGame() {
                calls.push("start");
            },
            isResultMove(m) {
                return m && m.moveStr === "1-0";
            },
        };
        MobileSessionReview.syncClassicBoardToPly(2, {
            game,
            gameMoves: {
                moves: [{ moveStr: "e4" }, { moveStr: "e5" }, { moveStr: "1-0" }],
            },
            currentPlayerIsWhite: true,
        });
        assert.ok(calls.includes("pause"));
        assert.ok(calls.includes("e4"));
        assert.ok(calls.includes("e5"));
        assert.strictEqual(global.moveIndex, 2);
    });

    it("attach wires review mode and dispose", function () {
        global.ShmerlingGameSession = GameSession;
        global.ShmerlingReviewMode = ReviewMode;
        const game = new ChessGame();
        game.startNewGame(true);
        const handle = MobileSessionReview.attach({
            game,
            gameMoves: { moves: [{ moveStr: "e4" }, { moveStr: "e5" }] },
            currentPlayerIsWhite: true,
        });
        assert.ok(handle);
        assert.ok(handle.session);
        assert.ok(handle.reviewMode);
        handle.dispose();
    });

    it("attach returns null without APIs or moves", function () {
        assert.strictEqual(MobileSessionReview.attach({}), null);
        global.ShmerlingGameSession = GameSession;
        global.ShmerlingReviewMode = ReviewMode;
        assert.strictEqual(MobileSessionReview.attach({ game: {} }), null);
    });
});

describe("mobile session local-engine attach", function () {
    afterEach(function () {
        delete global.ShmerlingGameSession;
        delete global.ShmerlingLocalEngineMode;
        delete global.ShmerlingCreateEnginePort;
        delete global.__SHMERLING_AFTER_HUMAN_MOVE__;
        delete global.sendMove;
        delete global.location;
        delete global.document;
    });

    it("isMobileGamePage detects shell", function () {
        global.document = {
            body: { classList: { contains: (c) => c === "mobile-game-shell" } },
            getElementById: () => ({ classList: { contains: () => true } }),
        };
        global.location = { pathname: "/mobile-game" };
        assert.strictEqual(MobileSessionLocalEngine.isMobileGamePage(), true);
        global.location = { pathname: "/mobile-review" };
        assert.strictEqual(MobileSessionLocalEngine.isMobileGamePage(), false);
    });

    it("attach binds session and wraps sendMove", async function () {
        global.ShmerlingGameSession = GameSession;
        global.ShmerlingLocalEngineMode = LocalEngineMode;
        global.ShmerlingCreateEnginePort = {
            create() {
                return {
                    computeMove: async () => null,
                    abortSearch() {},
                };
            },
        };
        let sendCalls = 0;
        global.sendMove = async function () {
            sendCalls += 1;
            return true;
        };
        const game = new ChessGame();
        game.startNewGame(true);
        const handle = MobileSessionLocalEngine.attach({
            game,
            gameInfo: {
                gameType: "SinglePlayerGame",
                clientEngine: true,
                engine: "brain41",
                difficulty: 2,
                id: "g1",
            },
            currentPlayerIsWhite: true,
        });
        assert.ok(handle);
        assert.ok(global.__SHMERLING_AFTER_HUMAN_MOVE__);
        await global.sendMove({});
        assert.strictEqual(sendCalls, 1);
        handle.dispose();
        assert.ok(!global.__SHMERLING_AFTER_HUMAN_MOVE__);
    });

    it("movePayloadForServer fills timers", function () {
        const out = MobileSessionLocalEngine.movePayloadForServer(
            { source: { row: 1, col: 1 }, target: { row: 2, col: 2 } },
            { moveTime: 3, whiteTimer: 10, blackTimer: 9 },
        );
        assert.strictEqual(out.moveTime, 3);
        assert.strictEqual(out.whiteTimer, 10);
    });

    it("applyClassicEngineMove handles promotion and server sync", async function () {
        const sent = [];
        global.animateMove = async () => {};
        global.switchClocks = () => {};
        global.sendMessage = async (m) => sent.push(m);
        global.whiteTimer = 50;
        global.blackTimer = 40;
        const move = {
            source: { row: 1, col: 0 },
            target: { row: 0, col: 0 },
            promotion: true,
            selectedPiece: 5,
        };
        const game = {
            GameOver: false,
            WhitePlayerView: true,
            makeMove() {
                return { ...move, promotion: true };
            },
            completePromotion() {},
        };
        const ok = await MobileSessionLocalEngine.applyClassicEngineMove(move, {
            game,
            gameInfo: { id: "g1", userId: "u", username: "a" },
            humanIsWhite: true,
        });
        assert.strictEqual(ok, true);
        assert.ok(sent.some((m) => m.info === "clientEngineMove"));
    });
});

describe("mobile session online helpers", function () {
    it("shouldAttach for OnlineGame (non-review)", function () {
        assert.strictEqual(
            MobileSessionOnline.shouldAttach({
                gameType: "OnlineGame",
                mode: "play",
            }),
            true,
        );
        assert.strictEqual(
            MobileSessionOnline.shouldAttach({
                gameType: "OnlineGame",
                mode: "review",
            }),
            false,
        );
        assert.strictEqual(
            MobileSessionOnline.shouldAttach({
                gameType: "SinglePlayerGame",
            }),
            false,
        );
        assert.strictEqual(
            MobileSessionOnline.isWatcherSession({ watcher: true }),
            true,
        );
    });

    it("sessionApisReady is false without globals", function () {
        assert.strictEqual(MobileSessionOnline.sessionApisReady(), false);
    });

    it("read/writeClassicClocks and applyClassicRemoteMove", async function () {
        global.whiteTimer = 1;
        global.blackTimer = 2;
        assert.deepStrictEqual(MobileSessionOnline.readClassicClocks(), { white: 1, black: 2 });

        const texts = {};
        global.document = {
            getElementById(id) {
                if (!texts[id]) {
                    texts[id] = { innerText: "" };
                }
                return texts[id];
            },
        };
        global.timerToText = (n) => String(n);
        global.switchClocks = () => {};
        global.game = { GameOver: false };
        MobileSessionOnline.writeClassicClocks({ white: 30, black: 20 });
        assert.strictEqual(global.whiteTimer, 30);
        assert.strictEqual(global.blackTimer, 20);

        global.animateMove = async () => {};
        global.moveAccepted = async () => {};
        global.adjustIncomingNetworkMoveForBoardView = (m) => m;
        const game = {
            GameOver: false,
            makeMove() {
                return { moveStr: "e5" };
            },
        };
        const ok = await MobileSessionOnline.applyClassicRemoteMove(
            { source: { row: 1, col: 4 }, target: { row: 3, col: 4 } },
            { game, gameInfo: { id: "g" } },
        );
        assert.strictEqual(ok, true);
        assert.ok(global.lastMove);
    });

    it("attach online mode with stubbed transport", function () {
        const OnlineMode = require("../src/session/onlineMode");
        const WsTransport = require("../src/session/wsTransport");
        global.ShmerlingGameSession = GameSession;
        global.ShmerlingOnlineMode = OnlineMode;
        global.ShmerlingWsTransport = WsTransport;

        function FakeWebSocket() {
            this.readyState = 1;
            this.sent = [];
        }
        FakeWebSocket.prototype.send = function () {};
        FakeWebSocket.prototype.close = function () {
            this.readyState = 3;
        };
        const origCreate = WsTransport.create;
        WsTransport.create = function (opts) {
            return origCreate(Object.assign({}, opts, { WebSocket: FakeWebSocket }));
        };

        try {
            const game = new ChessGame();
            game.startNewGame(true);
            const handle = MobileSessionOnline.attach({
                game,
                gameInfo: {
                    gameType: "OnlineGame",
                    id: "og1",
                    username: "alice",
                    userId: "u1",
                    creatorId: "u1",
                    whitePlayerName: "alice",
                    blackPlayerName: "bob",
                },
                currentPlayerIsWhite: true,
            });
            assert.ok(handle);
            assert.ok(handle.session);
            assert.ok(handle.onlineMode);
            handle.dispose();
        } finally {
            WsTransport.create = origCreate;
            delete global.ShmerlingOnlineMode;
            delete global.ShmerlingWsTransport;
            delete global.ShmerlingGameSession;
        }
    });
});
