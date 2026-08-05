"use strict";

const assert = require("assert");
const { OnlineGame } = require("../src/modules/game/OnlineGame");
const { Player } = require("../src/modules/game/Player");
const { GameBase } = require("../src/modules/game/GameBase");

describe("OnlineGame opponent channel forwarding", function () {
    function makeOnlineGame() {
        const white = new Player("aaaaaaaaaaaaaaaaaaaaaaaa", "white");
        const black = new Player("bbbbbbbbbbbbbbbbbbbbbbbb", "black");
        const game = new OnlineGame(
            { gameType: "OnlineGame", options: {} },
            white,
            "play",
        );
        game.gameId = "g1";
        game.blackPlayer = black;
        game.chessGame.startNewGame();
        return game;
    }

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

    function closedWs() {
        return {
            readyState: 3,
            OPEN: 1,
            on() {},
            off() {},
            send() {
                throw new Error("should not send on closed socket");
            },
        };
    }

    it("does not send to a closed opponent channel", function () {
        const game = makeOnlineGame();
        const whiteSent = [];
        game.whitePlayer.channel = openWs(whiteSent);
        game.blackPlayer.channel = closedWs();
        const move = game.chessGame.makeMove({ row: 6, col: 4 }, { row: 4, col: 4 });
        const ok = game.sendMoveToOpponent(game.gameId, true, move);
        assert.strictEqual(ok, false);
        assert.strictEqual(whiteSent.length, 0);
    });

    it("sends when opponent channel is open", function () {
        const game = makeOnlineGame();
        const blackSent = [];
        game.whitePlayer.channel = openWs([]);
        game.blackPlayer.channel = openWs(blackSent);
        const move = game.chessGame.makeMove({ row: 6, col: 4 }, { row: 4, col: 4 });
        const ok = game.sendMoveToOpponent(game.gameId, true, move);
        assert.strictEqual(ok, true);
        assert.strictEqual(blackSent.length, 1);
        assert.strictEqual(blackSent[0].type, "move");
    });

    it("clears seat channel when that socket closes", function () {
        const game = makeOnlineGame();
        const handlers = {};
        const ws = {
            readyState: 1,
            OPEN: 1,
            on(ev, fn) {
                handlers[ev] = fn;
            },
            off() {},
            send() {},
        };
        assert.strictEqual(game.init(ws, game.whitePlayer.userId), true);
        assert.strictEqual(game.whitePlayer.channel, ws);
        ws.readyState = 3;
        handlers.close();
        assert.strictEqual(game.whitePlayer.channel, null);
    });

    it("announces rejoin when previous channel was cleared to null", function () {
        const game = makeOnlineGame();
        const whiteSent = [];
        game.whitePlayer.channel = openWs(whiteSent);
        game.blackPlayer.channel = null;
        game.status = "on hold";
        game.lastStatus = "in progress";
        const newBlack = openWs([]);
        game.updateChannel(game.blackPlayer, newBlack);
        assert.strictEqual(game.status, "in progress");
        assert.strictEqual(game.blackPlayer.channel, newBlack);
        const rejoined = whiteSent.find(function (m) {
            return m.info === "opponent rejoined";
        });
        assert.ok(rejoined);
        assert.strictEqual(rejoined.rejoinedWasWhite, false);
    });
});
