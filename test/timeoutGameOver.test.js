"use strict";

/**
 * Timeout / flag-fall must mark the server game over so lobby and disconnect
 * cannot leave a finished game "in progress" / "on hold" and resumable.
 */
const assert = require("assert");
const { OnlineGame } = require("../src/modules/game/OnlineGame");
const { OnlineGameMessageProcessor } = require("../src/modules/game/OnlineGameMessageProcessor");
const { Player } = require("../src/modules/game/Player");
const gameClocks = require("../src/modules/game/gameClocks");
const {
    GameSession,
    OnlineMode,
    OnlineProtocol,
} = require("../src/session");
const { ChessGame } = require("../src/ChessGame");

function openWs(sent) {
    return {
        readyState: 1,
        OPEN: 1,
        on() {},
        off() {},
        send(data) {
            sent.push(JSON.parse(data));
        },
    };
}

function makeOnlineInProgress() {
    const white = new Player("aaaaaaaaaaaaaaaaaaaaaaaa", "white");
    const black = new Player("bbbbbbbbbbbbbbbbbbbbbbbb", "black");
    const game = new OnlineGame({ gameType: "OnlineGame", options: {} }, white, "play");
    game.gameId = "g-timeout";
    game.blackPlayer = black;
    game.chessGame.startNewGame();
    game.chessGame.GameTimeLength = 60;
    game.status = "in progress";
    game.lastStatus = "in progress";
    game.messageProcessor = new OnlineGameMessageProcessor();
    game.moves.push({
        moveStr: "e4",
        whiteTimer: 55,
        blackTimer: 60,
        source: { row: 6, col: 4 },
        target: { row: 4, col: 4 },
    });
    game.lastMoveOn = Date.now() - 5000;
    return game;
}

describe("timeout / flag-fall server game over", function () {
    it("accepts client flag when server clocks were never started (rehydrate)", async function () {
        const game = makeOnlineInProgress();
        const whiteSent = [];
        const blackSent = [];
        game.whitePlayer.channel = openWs(whiteSent);
        game.blackPlayer.channel = openWs(blackSent);
        assert.strictEqual(game._serverClocksActive, undefined);
        game.clockWhiteSec = 0;
        game.clockBlackSec = 60;

        const ok = await gameClocks.tryClientFlagHint(game, "white");
        assert.strictEqual(ok, true);
        assert.strictEqual(game.status, "game over");
        assert.strictEqual(game.chessGame.OutOfTime, "white");
        assert.ok(game.chessGame.GameOver);
        const go = whiteSent.concat(blackSent).find(function (m) {
            return m.info === "game over";
        });
        assert.ok(go);
        assert.strictEqual(go.loser, "white");
        assert.match(String(go.reason || ""), /out of time/i);
    });

    it("accepts flag within grace when a few seconds remain (client tick skew)", async function () {
        const game = makeOnlineInProgress();
        game.whitePlayer.channel = openWs([]);
        game.blackPlayer.channel = openWs([]);
        gameClocks.startTurnClock(game, "white");
        gameClocks.pauseClocks(game);
        game.clockWhiteSec = 1.5;
        game.clockBlackSec = 60;

        const ok = await gameClocks.tryClientFlagHint(game, "white");
        assert.strictEqual(ok, true);
        assert.strictEqual(game.status, "game over");
        assert.strictEqual(game.chessGame.OutOfTime, "white");
    });

    it("OnlineGameMessageProcessor outOfTime ends the game", async function () {
        const game = makeOnlineInProgress();
        game.whitePlayer.channel = openWs([]);
        game.blackPlayer.channel = openWs([]);
        game.clockWhiteSec = 0;
        game.clockBlackSec = 60;
        const proc = new OnlineGameMessageProcessor();
        await proc.reportOutOfTime(game, {
            type: "info",
            info: "outOfTime",
            loser: "white",
            isWhite: false,
            gameId: game.gameId,
        });
        assert.strictEqual(game.status, "game over");
        assert.strictEqual(game.chessGame.OutOfTime, "white");
    });

    it("does not put a timeout-finished game on hold when a seat disconnects", function () {
        const game = makeOnlineInProgress();
        const whiteSent = [];
        game.whitePlayer.channel = openWs(whiteSent);
        game.blackPlayer.channel = openWs([]);
        game.chessGame.OutOfTime = "black";
        assert.strictEqual(game.chessGame.GameOver, true);
        /* Status intentionally still "in progress" — the bug case. */
        assert.strictEqual(game.status, "in progress");
        game.blackPlayer.channel.readyState = 3;
        game.clearChannelIfMatches(game.blackPlayer.channel);
        game.onConnectionClosed();
        assert.strictEqual(game.status, "game over");
        assert.notStrictEqual(game.status, "on hold");
        assert.ok(
            whiteSent.some(function (m) {
                return m.info === "Opponent disconnected";
            }),
        );
    });

    it("ensureServerClocksActive restores from last move and starts the turn clock", function () {
        const game = makeOnlineInProgress();
        game.clockWhiteSec = undefined;
        game.clockBlackSec = undefined;
        gameClocks.ensureServerClocksActive(game);
        assert.strictEqual(game._serverClocksActive, true);
        assert.ok(game._clockRunningFor === "black" || game._clockRunningFor === "white");
        assert.strictEqual(typeof game.clockWhiteSec, "number");
        gameClocks.clearFlagTimer(game);
        gameClocks.pauseClocks(game);
    });

    it("classifies game over with loser for OnlineProtocol", function () {
        const c = OnlineProtocol.classifyInbound({
            type: "info",
            info: "game over",
            loser: "black",
            reason: "out of time",
        });
        assert.strictEqual(c.kind, "gameOverNotice");
        assert.strictEqual(c.payload.loser, "black");
    });
});

describe("OnlineMode timeout confirmation", function () {
    function createMockTransport() {
        const sent = [];
        let messageHandler = null;
        let openHandler = null;
        let closeHandler = null;
        let open = false;
        return {
            sent: sent,
            connect: function () {
                open = true;
                if (typeof openHandler === "function") {
                    openHandler();
                }
            },
            close: function () {
                open = false;
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
        };
    }

    it("reportOutOfTime sends hint but does not end locally until server game over", async function () {
        const transport = createMockTransport();
        const game = new ChessGame();
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
        session.playMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 } },
            { source: "human" },
        );
        assert.strictEqual(game.GameOver, false);
        mode.reportOutOfTime("black");
        assert.strictEqual(game.GameOver, false);
        assert.ok(
            transport.sent.some(function (m) {
                return m.info === "outOfTime" && m.loser === "black";
            }),
        );
        await mode._handleInbound({
            type: "info",
            info: "game over",
            loser: "black",
            reason: "out of time",
        });
        assert.strictEqual(game.GameOver, true);
        assert.strictEqual(game.OutOfTime, "black");
        session.dispose();
    });
});
