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

    it("maps opponent resigned to local resign of the opponent", function () {
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

        mode._handleInbound({
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

    it("accepts an inbound draw and ends the game", function () {
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
        mode._handleInbound({
            type: "info",
            info: "draw accepted",
            isWhite: false,
        });
        assert.strictEqual(game.GameOver, true);
        assert.ok(game.GameState.draw);
        session.dispose();
    });

    it("offerRematch requires game over and notifies on rematch accepted", function () {
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

        mode._handleInbound({
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
});
