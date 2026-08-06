/**
 * Phase 3: OnlineProtocol, WsTransport (mock), OnlineMode.
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const {
    GameSession,
    OnlineMode,
    OnlineProtocol,
    WsTransport,
    MODE_IDS,
    getModeCapabilities,
} = require("../src/session");

function silentGame() {
    return new ChessGame();
}

function createMockTransport() {
    const sent = [];
    let messageHandler = null;
    let openHandler = null;
    let closeHandler = null;
    let open = false;
    let lastUrl = null;

    return {
        sent: sent,
        connect: function (url) {
            lastUrl = url;
            open = true;
            if (typeof openHandler === "function") {
                openHandler();
            }
        },
        close: function () {
            open = false;
            /* Match real WsTransport.close: intentional close does not fire onClose. */
        },
        simulateDisconnect: function () {
            open = false;
            if (typeof closeHandler === "function") {
                closeHandler();
            }
        },
        send: function (message) {
            sent.push(message);
        },
        onMessage: function (handler) {
            messageHandler = handler;
        },
        onOpen: function (handler) {
            openHandler = handler;
        },
        onClose: function (handler) {
            closeHandler = handler;
        },
        onError: function () {},
        isOpen: function () {
            return open;
        },
        push: function (message) {
            if (typeof messageHandler === "function") {
                messageHandler(message);
            }
        },
        lastUrl: function () {
            return lastUrl;
        },
    };
}

describe("session OnlineProtocol (Phase 3)", function () {
    it("builds connection and move messages", function () {
        const connect = OnlineProtocol.buildConnectMessage({
            username: "alice",
            isWhite: true,
            gameId: "g1",
            creatorId: "c1",
            userId: "u1",
        });
        assert.strictEqual(connect.type, "connection");
        assert.strictEqual(connect.data.gameId, "g1");
        assert.strictEqual(connect.data.isWhite, true);

        const move = OnlineProtocol.buildMoveMessage({
            move: { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            gameId: "g1",
            username: "alice",
            isWhite: true,
        });
        assert.strictEqual(move.type, "move");
        assert.strictEqual(move.isWhite, true);
    });

    it("classifies inbound infos used by Phase 3 OnlineMode", function () {
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "opponent joined",
            }).kind,
            "opponentJoined",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "Opponent resigned",
                isWhite: false,
            }).kind,
            "opponentResigned",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "Opponent disconnected",
            }).kind,
            "opponentDisconnected",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "opponent rejoined",
            }).kind,
            "opponentRejoined",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "Opponent failed to reconnect",
            }).kind,
            "opponentFailedReconnect",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "offer draw",
            }).kind,
            "offerDraw",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "draw accepted",
            }).kind,
            "drawAccepted",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "draw declined",
            }).kind,
            "drawDeclined",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "offer rematch",
            }).kind,
            "offerRematch",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "rematch accepted",
            }).kind,
            "rematchAccepted",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "rematch declined",
            }).kind,
            "rematchDeclined",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({ type: "move", data: {} }).kind,
            "move",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "clockSync",
                whiteTimer: 1,
                blackTimer: 2,
            }).kind,
            "clockSync",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "chat",
                data: "hi",
            }).kind,
            "chat",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "connected",
                moveCount: 2,
            }).kind,
            "connected",
        );
    });

    it("merges clock snapshots from moveTime and explicit timers", function () {
        const fromMove = OnlineProtocol.mergeClockSnapshot(
            { white: 100, black: 90 },
            { moveTime: 88 },
            true,
        );
        assert.deepStrictEqual(fromMove, { white: 88, black: 90 });

        const fromSync = OnlineProtocol.mergeClockSnapshot(null, {
            whiteTimer: 50,
            blackTimer: 40,
        });
        assert.deepStrictEqual(fromSync, { white: 50, black: 40 });
    });
});

describe("session WsTransport (Phase 3)", function () {
    it("defaultWsUrl picks ws/wss from location", function () {
        assert.strictEqual(
            WsTransport.defaultWsUrl({ protocol: "https:", host: "ex.test" }),
            "wss://ex.test/ws",
        );
        assert.strictEqual(
            WsTransport.defaultWsUrl({ protocol: "http:", host: "ex.test" }),
            "ws://ex.test/ws",
        );
    });

    it("queues sends until open then flushes", function () {
        let instance = null;
        function FakeWS(url, protocol) {
            this.url = url;
            this.protocol = protocol;
            this.readyState = 0;
            this.sent = [];
            instance = this;
        }
        FakeWS.prototype.send = function (data) {
            this.sent.push(data);
        };
        FakeWS.prototype.close = function () {
            this.readyState = 3;
        };

        const transport = WsTransport.create({ WebSocket: FakeWS });
        transport.connect("ws://test/ws");
        assert.ok(instance);
        assert.strictEqual(instance.protocol, "protocolOne");
        transport.send({ type: "ping" });
        assert.strictEqual(instance.sent.length, 0);
        instance.readyState = 1;
        instance.onopen();
        assert.strictEqual(instance.sent.length, 1);
        assert.deepStrictEqual(JSON.parse(instance.sent[0]), { type: "ping" });
        transport.close();
    });

    it("errors instead of queuing when socket is closed", function () {
        let instance = null;
        const errors = [];
        function FakeWS() {
            this.readyState = 1;
            this.sent = [];
            instance = this;
        }
        FakeWS.prototype.send = function (data) {
            this.sent.push(data);
        };
        FakeWS.prototype.close = function () {
            this.readyState = 3;
        };

        const transport = WsTransport.create({ WebSocket: FakeWS });
        transport.onError(function (err) {
            errors.push(err);
        });
        transport.connect("ws://test/ws");
        instance.readyState = 1;
        instance.onopen();
        instance.readyState = 3;
        const ok = transport.send({ type: "move" });
        assert.strictEqual(ok, false);
        assert.strictEqual(instance.sent.length, 0);
        assert.strictEqual(errors.length, 1);
        assert.match(String(errors[0].message), /not open/i);
    });

    it("intentional close does not invoke onClose handler", function () {
        let instance = null;
        let closed = 0;
        function FakeWS() {
            this.readyState = 1;
            instance = this;
        }
        FakeWS.prototype.send = function () {};
        FakeWS.prototype.close = function () {
            this.readyState = 3;
            if (typeof this.onclose === "function") {
                this.onclose();
            }
        };

        const transport = WsTransport.create({ WebSocket: FakeWS });
        transport.onClose(function () {
            closed += 1;
        });
        transport.connect("ws://test/ws");
        instance.readyState = 1;
        instance.onopen();
        transport.close();
        assert.strictEqual(closed, 0);
    });

    it("unexpected socket close invokes onClose handler", function () {
        let instance = null;
        let closed = 0;
        function FakeWS() {
            this.readyState = 1;
            instance = this;
        }
        FakeWS.prototype.send = function () {};
        FakeWS.prototype.close = function () {
            this.readyState = 3;
        };

        const transport = WsTransport.create({ WebSocket: FakeWS });
        transport.onClose(function () {
            closed += 1;
        });
        transport.connect("ws://test/ws");
        instance.readyState = 1;
        instance.onopen();
        instance.onclose();
        assert.strictEqual(closed, 1);
        assert.strictEqual(transport.isOpen(), false);
    });
});

describe("session OnlineMode (Phase 3)", function () {
    it("exposes online mode id and Phase 4 capabilities", function () {
        const transport = createMockTransport();
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: { id: "g1", username: "a", userId: "u" },
            wsUrl: "ws://test/ws",
        });
        assert.strictEqual(mode.id, MODE_IDS.ONLINE);
        assert.strictEqual(mode.capabilities().network, true);
        assert.strictEqual(mode.capabilities().draw, true);
        assert.strictEqual(mode.capabilities().rematch, true);
        assert.deepStrictEqual(
            mode.capabilities(),
            getModeCapabilities(MODE_IDS.ONLINE),
        );
    });

    it("connects and sends connection handshake on start", function () {
        const transport = createMockTransport();
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "game-1",
                username: "alice",
                userId: "u1",
                creatorId: "u1",
            },
            humanIsWhite: true,
            wsUrl: "ws://test/ws",
        });
        session.attachMode(mode);
        session.start({ humanIsWhite: true });

        assert.strictEqual(transport.lastUrl(), "ws://test/ws");
        assert.ok(transport.sent.length >= 1);
        const connect = transport.sent.find(function (m) {
            return m.type === "connection";
        });
        assert.ok(connect);
        assert.strictEqual(connect.data.gameId, "game-1");
        assert.strictEqual(connect.data.isWhite, true);
        session.dispose();
    });

    it("sends human moves over the transport after local playMove", function () {
        const transport = createMockTransport();
        let clocks = { white: 500, black: 500 };
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "game-1",
                username: "alice",
                userId: "u1",
                creatorId: "u1",
                blackPlayerName: "bob",
            },
            humanIsWhite: true,
            wsUrl: "ws://test/ws",
            getClocks: function () {
                return clocks;
            },
        });
        session.attachMode(mode);
        session.start();
        transport.sent.length = 0;

        session.playMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            { source: "human" },
        );

        const moveMsg = transport.sent.find(function (m) {
            return m.type === "move";
        });
        assert.ok(moveMsg);
        assert.strictEqual(moveMsg.isWhite, true);
        assert.strictEqual(moveMsg.data.moveTime, 500);
        session.dispose();
    });

    it("applies remote moves without echoing them back", async function () {
        const transport = createMockTransport();
        const remoteApplied = [];
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "game-1",
                username: "alice",
                userId: "u1",
                creatorId: "u1",
                blackPlayerName: "bob",
            },
            humanIsWhite: true,
            wsUrl: "ws://test/ws",
            getClocks: function () {
                return { white: 100, black: 100 };
            },
            applyRemoteMove: async function (move) {
                remoteApplied.push(move);
                session.playMove(move, { source: "network" });
                return true;
            },
        });
        session.attachMode(mode);
        session.start();
        session.playMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            { source: "human" },
        );
        transport.sent.length = 0;

        await mode._handleInbound({
            type: "move",
            data: { source: { row: 1, col: 4 }, target: { row: 3, col: 4 } },
            isWhite: false,
        });

        assert.strictEqual(remoteApplied.length, 1);
        const echoed = transport.sent.filter(function (m) {
            return m.type === "move";
        });
        assert.strictEqual(echoed.length, 0);
        session.dispose();
    });

    it("requestResign with no moves calls cancelBeforeMove", async function () {
        const transport = createMockTransport();
        const cancelled = [];
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "game-1",
                username: "alice",
                userId: "u1",
                creatorId: "u1",
            },
            humanIsWhite: true,
            wsUrl: "ws://test/ws",
            cancelBeforeMove: async function (id) {
                cancelled.push(id);
            },
        });
        session.attachMode(mode);
        session.start();

        const over = [];
        session.on("gameOver", function (p) {
            over.push(p);
        });
        await mode.requestResign();

        assert.deepStrictEqual(cancelled, ["game-1"]);
        assert.strictEqual(over[0] && over[0].kind, "cancelled");
        session.dispose();
    });

    it("requestResign after a move sends resign info and ends the game", async function () {
        const transport = createMockTransport();
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "game-1",
                username: "alice",
                userId: "u1",
                creatorId: "u1",
                blackPlayerName: "bob",
            },
            humanIsWhite: true,
            wsUrl: "ws://test/ws",
            getClocks: function () {
                return { white: 40, black: 50 };
            },
        });
        session.attachMode(mode);
        session.start();
        session.playMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            { source: "human" },
        );
        transport.sent.length = 0;

        await mode.requestResign();

        const resignMsg = transport.sent.find(function (m) {
            return m.type === "info" && m.info === "resign";
        });
        assert.ok(resignMsg);
        assert.strictEqual(resignMsg.isWhite, true);
        assert.strictEqual(game.GameOver, true);
        session.dispose();
    });

    it("maps opponent resigned to local resign of the opponent", async function () {
        const transport = createMockTransport();
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "game-1",
                username: "alice",
                userId: "u1",
                creatorId: "u1",
                blackPlayerName: "bob",
            },
            humanIsWhite: true,
            wsUrl: "ws://test/ws",
        });
        session.attachMode(mode);
        session.start();
        session.playMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            { source: "human" },
        );

        await mode._handleInbound({
            type: "info",
            info: "Opponent resigned",
            isWhite: false,
        });

        assert.strictEqual(game.GameOver, true);
        assert.ok(game.GameState && game.GameState.resigned);
        session.dispose();
    });

    it("canOfferDraw only after a human move on the opponent turn", function () {
        const transport = createMockTransport();
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "game-1",
                username: "alice",
                userId: "u1",
                creatorId: "u1",
                blackPlayerName: "bob",
            },
            humanIsWhite: true,
            wsUrl: "ws://test/ws",
        });
        session.attachMode(mode);
        session.start();
        assert.strictEqual(mode.canOfferDraw(), false);
        session.playMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            { source: "human" },
        );
        assert.strictEqual(mode.canOfferDraw(), true);
        assert.ok(mode.offerDraw());
        const drawMsg = transport.sent.find(function (m) {
            return m.type === "info" && m.info === "offer draw";
        });
        assert.ok(drawMsg);
        session.dispose();
    });

    it("accepts an inbound draw and ends the game", async function () {
        const transport = createMockTransport();
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "game-1",
                username: "alice",
                userId: "u1",
                creatorId: "u1",
                blackPlayerName: "bob",
            },
            humanIsWhite: true,
            wsUrl: "ws://test/ws",
        });
        session.attachMode(mode);
        session.start();
        session.playMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            { source: "human" },
        );
        await mode._handleInbound({
            type: "info",
            info: "draw accepted",
            isWhite: false,
        });
        assert.strictEqual(game.GameOver, true);
        assert.ok(game.GameState.draw);
        session.dispose();
    });

    it("offerRematch requires game over and notifies on rematch accepted", async function () {
        const transport = createMockTransport();
        const rematches = [];
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "game-1",
                username: "alice",
                userId: "u1",
                creatorId: "u1",
                blackPlayerName: "bob",
            },
            humanIsWhite: true,
            wsUrl: "ws://test/ws",
            onRematchAccepted: function (p) {
                rematches.push(p.gameId);
            },
        });
        session.attachMode(mode);
        session.start();
        assert.strictEqual(mode.offerRematch(), false);
        session.playMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            { source: "human" },
        );
        session.resign("White");
        transport.sent.length = 0;
        assert.ok(mode.offerRematch());
        const offer = transport.sent.find(function (m) {
            return m.info === "offer rematch";
        });
        assert.ok(offer);
        assert.strictEqual(offer.offererWantsColor, undefined);

        transport.sent.length = 0;
        assert.ok(mode.offerRematch("black"));
        const offerWithColor = transport.sent.find(function (m) {
            return m.info === "offer rematch";
        });
        assert.ok(offerWithColor);
        assert.strictEqual(offerWithColor.offererWantsColor, "black");

        transport.sent.length = 0;
        assert.ok(mode.offerRematch("white", 45));
        const offerWithTime = transport.sent.find(function (m) {
            return m.info === "offer rematch";
        });
        assert.ok(offerWithTime);
        assert.strictEqual(offerWithTime.offererWantsColor, "white");
        assert.strictEqual(offerWithTime.timeMinutes, 45);

        await mode._handleInbound({
            type: "info",
            info: "rematch accepted",
            gameId: "game-2",
        });
        assert.deepStrictEqual(rematches, ["game-2"]);
        session.dispose();
    });

    it("classifies draw and rematch infos", function () {
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "offer draw",
            }).kind,
            "offerDraw",
        );
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "rematch accepted",
                gameId: "x",
            }).kind,
            "rematchAccepted",
        );
    });

    it("watcher mode uses WATCH capabilities and blocks resign/draw/rematch", async function () {
        const transport = createMockTransport();
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "game-1",
                username: "spectator",
                userId: "u9",
                creatorId: "u1",
                whitePlayerName: "alice",
                blackPlayerName: "bob",
            },
            humanIsWhite: true,
            watcher: true,
            wsUrl: "ws://test/ws",
        });
        session.attachMode(mode);
        session.start();
        assert.strictEqual(mode.id, "watch");
        const caps = mode.capabilities();
        assert.strictEqual(caps.resign, false);
        assert.strictEqual(caps.draw, false);
        assert.strictEqual(caps.rematch, false);
        assert.strictEqual(caps.watchers, true);
        assert.strictEqual(caps.network, true);
        assert.strictEqual(caps.chat, false);
        assert.strictEqual(mode.offerDraw(), false);
        assert.strictEqual(mode.offerRematch(), false);
        const ok = await mode.requestResign();
        assert.strictEqual(ok, false);
        const connect = transport.sent.find(function (m) {
            return m.type === "watch" || m.type === "connection";
        });
        assert.ok(connect);
        assert.strictEqual(connect.type, "watch");

        let drawOffers = 0;
        let rematchOffers = 0;
        const mode2 = OnlineMode.create({
            transport: createMockTransport(),
            gameInfo: {
                id: "game-1",
                username: "spectator",
                userId: "u9",
                creatorId: "u1",
                whitePlayerName: "alice",
                blackPlayerName: "bob",
            },
            humanIsWhite: true,
            watcher: true,
            wsUrl: "ws://test/ws",
            onDrawOffered: function () {
                drawOffers += 1;
            },
            onRematchOffered: function () {
                rematchOffers += 1;
            },
        });
        const session2 = GameSession.create({ game: silentGame(), humanIsWhite: true });
        session2.attachMode(mode2);
        session2.start();
        mode2._handleInbound({ type: "info", info: "offer draw", isWhite: true });
        mode2._handleInbound({ type: "info", info: "offer rematch", isWhite: true });
        mode2._handleInbound({ type: "info", info: "draw declined", isWhite: true });
        await mode2._handleInbound({ type: "info", info: "rematch declined", isWhite: true });
        assert.strictEqual(drawOffers, 0);
        assert.strictEqual(rematchOffers, 0);
        session2.dispose();
        session.dispose();
    });

    it("serializes concurrent remote moves so later plies wait for earlier ones", async function () {
        const transport = createMockTransport();
        const order = [];
        let gate = null;
        const gatePromise = new Promise(function (resolve) {
            gate = resolve;
        });
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "game-1",
                username: "alice",
                userId: "u1",
                creatorId: "u1",
                blackPlayerName: "bob",
            },
            humanIsWhite: true,
            watcher: true,
            wsUrl: "ws://test/ws",
            applyRemoteMove: async function (move) {
                order.push("start:" + move.moveStr);
                if (move.moveStr === "e4") {
                    await gatePromise;
                }
                session.playMove(move, { source: "network" });
                order.push("done:" + move.moveStr);
                return true;
            },
        });
        session.attachMode(mode);
        session.start();

        const first = mode._handleInbound({
            type: "move",
            data: {
                source: { row: 6, col: 4 },
                target: { row: 4, col: 4 },
                moveStr: "e4",
            },
            isWhite: true,
        });
        const second = mode._handleInbound({
            type: "move",
            data: {
                source: { row: 1, col: 4 },
                target: { row: 3, col: 4 },
                moveStr: "e5",
            },
            isWhite: false,
        });
        await Promise.resolve();
        assert.deepStrictEqual(order, ["start:e4"]);
        gate();
        await first;
        await second;
        assert.deepStrictEqual(order, ["start:e4", "done:e4", "start:e5", "done:e5"]);
        session.dispose();
    });

    it("watcher forfeit resigns the disconnected seat, not the other", async function () {
        const statuses = [];
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: createMockTransport(),
            gameInfo: {
                id: "game-1",
                username: "spectator",
                userId: "u9",
                creatorId: "u1",
                whitePlayerName: "alice",
                blackPlayerName: "bob",
            },
            humanIsWhite: true,
            watcher: true,
            wsUrl: "ws://test/ws",
            onStatus: function (msg) {
                statuses.push(msg);
            },
        });
        session.attachMode(mode);
        session.start();
        session.playMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            { source: "network" },
        );
        await mode._handleInbound({
            type: "info",
            info: "Opponent failed to reconnect",
            disconnectedWasWhite: true,
        });
        assert.strictEqual(game.GameOver, true);
        assert.strictEqual(game.GameState.resigned, "white");
        assert.ok(
            statuses.some(function (s) {
                return /alice failed to reconnect/i.test(s) && /bob wins/i.test(s);
            }),
        );
        session.dispose();
    });

    it("sends chat info and ignores send for watchers", function () {
        const transport = createMockTransport();
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: { id: "g1", username: "alice", userId: "u1" },
            humanIsWhite: true,
            wsUrl: "ws://test/ws",
        });
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        session.attachMode(mode);
        session.start({ humanIsWhite: true });
        transport.push({ type: "info", info: "connected" });
        assert.strictEqual(mode.sendChat("  hello  "), true);
        const chat = transport.sent.find(function (m) {
            return m.info === "chat";
        });
        assert.ok(chat);
        assert.strictEqual(chat.data, "hello");
        session.dispose();

        const watcher = OnlineMode.create({
            transport: createMockTransport(),
            gameInfo: { id: "g1", username: "spec", userId: "u9" },
            watcher: true,
            wsUrl: "ws://test/ws",
        });
        assert.strictEqual(watcher.sendChat("nope"), false);
    });

    it("invokes onChatMessage for inbound chat", async function () {
        const transport = createMockTransport();
        let seen = null;
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: { id: "g1", username: "alice", userId: "u1" },
            humanIsWhite: true,
            wsUrl: "ws://test/ws",
            onChatMessage: function (payload) {
                seen = payload;
            },
        });
        await mode._handleInbound({
            type: "info",
            info: "chat",
            username: "bob",
            data: "hi",
            userId: "u2",
        });
        assert.ok(seen);
        assert.strictEqual(seen.data, "hi");
        assert.strictEqual(seen.username, "bob");
    });

    it("ignores inbound chat for watchers", async function () {
        let seen = null;
        const mode = OnlineMode.create({
            transport: createMockTransport(),
            gameInfo: { id: "g1", username: "spec", userId: "u9" },
            watcher: true,
            wsUrl: "ws://test/ws",
            onChatMessage: function (payload) {
                seen = payload;
            },
        });
        await mode._handleInbound({
            type: "info",
            info: "chat",
            username: "alice",
            data: "secret",
            userId: "u1",
        });
        assert.strictEqual(seen, null);
    });

    it("notifies on transport drop and restores on reconnect", function () {
        const transport = createMockTransport();
        const statuses = [];
        let lost = 0;
        let restored = 0;
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: {
                id: "g1",
                username: "alice",
                userId: "u1",
                blackPlayerName: "bob",
            },
            wsUrl: "ws://test/ws",
            onStatus: function (message, kind) {
                statuses.push({ message: message, kind: kind });
            },
            onConnectionLost: function () {
                lost += 1;
            },
            onConnectionRestored: function () {
                restored += 1;
            },
        });
        session.attachMode(mode);
        session.start();
        assert.strictEqual(mode.isConnected(), true);
        transport.simulateDisconnect();
        assert.strictEqual(mode.isConnected(), false);
        assert.strictEqual(lost, 1);
        assert.ok(
            statuses.some(function (s) {
                return s.kind === "error";
            }),
        );
        transport.connect("ws://test/ws");
        assert.strictEqual(mode.isConnected(), true);
        assert.strictEqual(restored, 1);
        mode.detach();
        session.dispose();
    });

    it("disables rematch after post-game opponent disconnect", async function () {
        const transport = createMockTransport();
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: { id: "g1", username: "alice", userId: "u1" },
            wsUrl: "ws://test/ws",
        });
        session.attachMode(mode);
        session.start();
        transport.push({ type: "info", info: "connected" });
        session.playMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            { source: "human" },
        );
        session.resign("White");
        assert.strictEqual(mode.canOfferRematch(), true);
        await mode._handleInbound({
            type: "info",
            info: "Opponent disconnected",
            disconnectedWasWhite: false,
        });
        assert.strictEqual(mode.canOfferRematch(), false);
        assert.strictEqual(mode.offerRematch(), false);
        session.dispose();
    });

    it("sends rematch offer / accept / decline infos", function () {
        const transport = createMockTransport();
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: { id: "g1", username: "alice", userId: "u1" },
            wsUrl: "ws://test/ws",
        });
        session.attachMode(mode);
        session.start();
        transport.push({ type: "info", info: "connected" });
        session.playMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            { source: "human" },
        );
        session.resign("White");
        assert.strictEqual(mode.offerRematch("black", 12), true);
        const offer = transport.sent.find(function (m) {
            return m.info === "offer rematch";
        });
        assert.ok(offer);
        assert.strictEqual(offer.offererWantsColor, "black");
        assert.strictEqual(offer.timeMinutes, 12);

        transport.sent.length = 0;
        assert.strictEqual(mode.acceptRematchOffer("white", 20), true);
        const accept = transport.sent.find(function (m) {
            return m.info === "rematch accepted";
        });
        assert.ok(accept);
        assert.strictEqual(accept.offererWantsColor, "white");
        assert.strictEqual(accept.timeMinutes, 20);

        transport.sent.length = 0;
        assert.strictEqual(mode.declineRematchOffer(), true);
        assert.ok(
            transport.sent.some(function (m) {
                return m.info === "rematch declined";
            }),
        );
        session.dispose();
    });

    it("sends draw accept and decline infos", function () {
        const transport = createMockTransport();
        const game = silentGame();
        game.startNewGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: { id: "g1", username: "alice", userId: "u1" },
            wsUrl: "ws://test/ws",
        });
        session.attachMode(mode);
        session.start();
        transport.push({ type: "info", info: "connected" });
        assert.strictEqual(mode.acceptDrawOffer(), true);
        assert.ok(
            transport.sent.some(function (m) {
                return m.info === "draw accepted";
            }),
        );
        transport.sent.length = 0;
        assert.strictEqual(mode.declineDrawOffer(), true);
        assert.ok(
            transport.sent.some(function (m) {
                return m.info === "draw declined";
            }),
        );
        session.dispose();
    });

    it("emits drawOffered and rematch offer hooks for inbound offers", async function () {
        const transport = createMockTransport();
        let drawPayload = null;
        let rematchPayload = null;
        const game = silentGame();
        game.startNewGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        session.on("drawOffered", function (p) {
            drawPayload = p;
        });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: { id: "g1", username: "alice", userId: "u1" },
            wsUrl: "ws://test/ws",
            onRematchOffered: function (p) {
                rematchPayload = p;
            },
        });
        session.attachMode(mode);
        session.start();
        await mode._handleInbound({
            type: "info",
            info: "offer draw",
            isWhite: false,
        });
        assert.ok(drawPayload);
        await mode._handleInbound({
            type: "info",
            info: "offer rematch",
            isWhite: false,
            offererWantsColor: "white",
            timeMinutes: 15,
        });
        assert.ok(rematchPayload);
        assert.strictEqual(rematchPayload.timeMinutes, 15);
        session.dispose();
    });
});
