/**
 * OnlineMode cases that wait on real reconnect/grace timers (>1s).
 * Run via: npm run test:heavy
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const { GameSession, OnlineMode } = require("../src/session");

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

describe("OnlineMode (heavy / timer waits)", function () {
    it("schedules auto-reconnect after unexpected transport drop", async function () {
        this.timeout(5000);
        const transport = createMockTransport();
        let connectCount = 0;
        const originalConnect = transport.connect;
        transport.connect = function (url) {
            connectCount += 1;
            return originalConnect.call(transport, url);
        };
        const game = silentGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: { id: "g1", username: "alice", userId: "u1" },
            wsUrl: "ws://test/ws",
        });
        session.attachMode(mode);
        session.start();
        assert.strictEqual(connectCount, 1);
        transport.simulateDisconnect();
        await new Promise(function (resolve) {
            setTimeout(resolve, 1100);
        });
        assert.ok(connectCount >= 2, "expected auto-reconnect attempt");
        mode.detach();
        session.dispose();
    });

    it("starts disconnect countdown after grace and clears on rejoin", async function () {
        this.timeout(5000);
        const transport = createMockTransport();
        const ticks = [];
        let cleared = 0;
        const game = silentGame();
        game.startNewGame();
        const session = GameSession.create({ game: game, humanIsWhite: true });
        const mode = OnlineMode.create({
            transport: transport,
            gameInfo: { id: "g1", username: "alice", userId: "u1" },
            wsUrl: "ws://test/ws",
            onDisconnectCountdown: function (seconds) {
                ticks.push(seconds);
            },
            onDisconnectCountdownClear: function () {
                cleared += 1;
            },
        });
        session.attachMode(mode);
        session.start();
        await mode._handleInbound({
            type: "info",
            info: "Opponent disconnected",
            disconnectedWasWhite: false,
        });
        assert.strictEqual(ticks.length, 0);
        await new Promise(function (resolve) {
            setTimeout(resolve, 1100);
        });
        assert.ok(ticks.length >= 1);
        assert.strictEqual(ticks[0], 60);
        await mode._handleInbound({
            type: "info",
            info: "opponent rejoined",
            rejoinedWasWhite: false,
        });
        assert.ok(cleared >= 1);
        session.dispose();
    });
});
