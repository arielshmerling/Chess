"use strict";

/**
 * Cancelled-before-first-move games must stay cancelled across refresh / WS reconnect.
 */
const assert = require("assert");
const { OnlineGame } = require("../src/modules/game/OnlineGame");
const { OnlineGameMessageProcessor } = require("../src/modules/game/OnlineGameMessageProcessor");
const { Player } = require("../src/modules/game/Player");

function openWs(sent, opts) {
    const state = { readyState: 1 };
    return {
        get readyState() {
            return state.readyState;
        },
        set readyState(v) {
            state.readyState = v;
        },
        OPEN: 1,
        on() {},
        off() {},
        send(data) {
            sent.push(JSON.parse(data));
        },
        close() {
            state.readyState = 3;
            if (opts && typeof opts.onClose === "function") {
                opts.onClose();
            }
        },
    };
}

function makeEstablishingOnlineGame() {
    const white = new Player("aaaaaaaaaaaaaaaaaaaaaaaa", "alice");
    const black = new Player("bbbbbbbbbbbbbbbbbbbbbbbb", "bob");
    const game = new OnlineGame({ gameType: "OnlineGame", options: {} }, white, "play");
    game.gameId = "g-cancel-refresh";
    game.blackPlayer = black;
    game.createdBy = white;
    game.chessGame.startNewGame();
    game.status = "establishing";
    game.messageProcessor = new OnlineGameMessageProcessor();
    return game;
}

describe("cancelled before first move — no resurrection", function () {
    it("applyCancelledNoMoves marks cancelled and notifies the remaining seat", async function () {
        const game = makeEstablishingOnlineGame();
        const blackSent = [];
        game.whitePlayer.channel = openWs([]);
        game.blackPlayer.channel = openWs(blackSent);
        await game.applyCancelledNoMoves("opponentLeftBeforeFirstMove", false);
        assert.strictEqual(game.status, "cancelled");
        assert.ok(
            blackSent.some(function (m) {
                return m.info === "Game cancelled" && m.data === "opponentLeftBeforeFirstMove";
            }),
        );
    });

    it("Black WS init after cancel does not revive the game to in progress", async function () {
        const game = makeEstablishingOnlineGame();
        const blackSent = [];
        game.whitePlayer.channel = openWs([]);
        game.blackPlayer.channel = openWs([]);
        await game.applyCancelledNoMoves("opponentLeftBeforeFirstMove", false);
        assert.strictEqual(game.status, "cancelled");

        let closed = false;
        const reconnectWs = openWs(blackSent, {
            onClose: function () {
                closed = true;
            },
        });
        const ok = game.init(reconnectWs, game.blackPlayer.userId);
        assert.strictEqual(ok, false);
        assert.strictEqual(game.status, "cancelled");
        assert.ok(
            blackSent.some(function (m) {
                return m.info === "Game cancelled";
            }),
        );
        assert.strictEqual(closed, true);
    });

    it("White creator WS init after cancel does not revive the game", async function () {
        const game = makeEstablishingOnlineGame();
        game.whitePlayer.channel = openWs([]);
        game.blackPlayer.channel = openWs([]);
        await game.applyCancelledNoMoves("opponentLeftBeforeFirstMove", true);
        assert.strictEqual(game.status, "cancelled");

        const whiteSent = [];
        const reconnectWs = openWs(whiteSent);
        const ok = game.init(reconnectWs, game.whitePlayer.userId);
        assert.strictEqual(ok, false);
        assert.strictEqual(game.status, "cancelled");
    });

    it("game-over init reattaches without changing status (rematch path)", function () {
        const game = makeEstablishingOnlineGame();
        game.status = "game over";
        game.chessGame.resign("black");
        const ws = openWs([]);
        const ok = game.init(ws, game.blackPlayer.userId);
        assert.strictEqual(ok, true);
        assert.strictEqual(game.status, "game over");
    });
});
