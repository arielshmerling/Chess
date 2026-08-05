"use strict";

const assert = require("assert");
const { OnlineGame } = require("../src/modules/game/OnlineGame");
const { OnlineGameMessageProcessor } = require("../src/modules/game/OnlineGameMessageProcessor");
const { Player } = require("../src/modules/game/Player");
const OnlineProtocol = require("../src/session/onlineProtocol");

describe("rematch when peer left after game over", function () {
    function makeFinishedOnlineGame() {
        const white = new Player("aaaaaaaaaaaaaaaaaaaaaaaa", "white");
        const black = new Player("bbbbbbbbbbbbbbbbbbbbbbbb", "black");
        const game = new OnlineGame(
            { gameType: "OnlineGame", options: {} },
            white,
            "play",
        );
        game.gameId = "g-rematch";
        game.blackPlayer = black;
        game.status = "game over";
        game.chessGame.startNewGame();
        game.chessGame.resign("Black");
        game.messageProcessor = new OnlineGameMessageProcessor();
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

    it("notifies remaining player and cancels pending rematch on post-game disconnect", function () {
        const game = makeFinishedOnlineGame();
        const whiteSent = [];
        game.whitePlayer.channel = openWs(whiteSent);
        game.blackPlayer.channel = openWs([]);
        game.pendingRematchOffer = {
            offererIsWhite: true,
            offererWantsColor: "white",
            timeMinutes: 30,
        };
        game.blackPlayer.channel.readyState = 3;
        game.clearChannelIfMatches(game.blackPlayer.channel);
        game.onConnectionClosed();
        assert.strictEqual(game.pendingRematchOffer, null);
        const infos = whiteSent.map(function (m) {
            return m.info;
        });
        assert.ok(infos.indexOf("rematch unavailable") !== -1);
        assert.ok(infos.indexOf("Opponent disconnected") !== -1);
    });

    it("rejects rematch offer when opponent channel is closed", function () {
        const game = makeFinishedOnlineGame();
        const whiteSent = [];
        game.whitePlayer.channel = openWs(whiteSent);
        game.blackPlayer.channel = null;
        const proc = new OnlineGameMessageProcessor();
        proc.rematchOfferForward(game, {
            type: "info",
            info: "offer rematch",
            gameId: game.gameId,
            isWhite: true,
            timeMinutes: 10,
        });
        assert.strictEqual(game.pendingRematchOffer, null);
        assert.strictEqual(whiteSent.length, 1);
        assert.strictEqual(whiteSent[0].info, "rematch unavailable");
    });

    it("classifies rematch unavailable", function () {
        assert.strictEqual(
            OnlineProtocol.classifyInbound({
                type: "info",
                info: "rematch unavailable",
            }).kind,
            "rematchUnavailable",
        );
    });
});
