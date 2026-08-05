"use strict";

/**
 * OnlineGame mid-game disconnect / rejoin / forfeit + rematch processor happy paths.
 */
const assert = require("assert");
const { OnlineGame } = require("../src/modules/game/OnlineGame");
const { OnlineGameMessageProcessor } = require("../src/modules/game/OnlineGameMessageProcessor");
const { Player } = require("../src/modules/game/Player");

function makeOnlineGame() {
    const white = new Player("aaaaaaaaaaaaaaaaaaaaaaaa", "white");
    const black = new Player("bbbbbbbbbbbbbbbbbbbbbbbb", "black");
    const game = new OnlineGame({ gameType: "OnlineGame", options: {} }, white, "play");
    game.gameId = "g-reconnect";
    game.blackPlayer = black;
    game.chessGame.startNewGame();
    game.status = "in progress";
    game.lastStatus = "in progress";
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

describe("OnlineGame mid-game disconnect / rejoin", function () {
    it("puts game on hold and notifies peer when one seat disconnects", function () {
        const game = makeOnlineGame();
        const whiteSent = [];
        game.whitePlayer.channel = openWs(whiteSent);
        const blackWs = openWs([]);
        game.blackPlayer.channel = blackWs;
        blackWs.readyState = 3;
        game.clearChannelIfMatches(blackWs);
        game.onConnectionClosed();
        assert.strictEqual(game.status, "on hold");
        assert.ok(game._rejoinWaitHandle != null);
        const disc = whiteSent.find(function (m) {
            return m.info === "Opponent disconnected";
        });
        assert.ok(disc);
        assert.strictEqual(disc.disconnectedWasWhite, false);
        game.clearRejoinWaitIfAny();
    });

    it("restores in-progress and notifies peer on rejoin after on-hold", function () {
        const game = makeOnlineGame();
        const whiteSent = [];
        game.whitePlayer.channel = openWs(whiteSent);
        game.blackPlayer.channel = null;
        game.status = "on hold";
        game.lastStatus = "in progress";
        game.updateChannel(game.blackPlayer, openWs([]));
        assert.strictEqual(game.status, "in progress");
        const rejoined = whiteSent.find(function (m) {
            return m.info === "opponent rejoined";
        });
        assert.ok(rejoined);
        assert.strictEqual(rejoined.rejoinedWasWhite, false);
    });

    it("forfeits disconnected seat when reconnect deadline expires", async function () {
        this.timeout(5000);
        const game = makeOnlineGame();
        const whiteSent = [];
        game.whitePlayer.channel = openWs(whiteSent);
        game.blackPlayer.channel = null;
        game.chessGame.makeMove({ row: 6, col: 4 }, { row: 4, col: 4 });
        game.moves.push({
            moveTime: 1000,
            whiteTimer: 89000,
            blackTimer: 90000,
        });
        game.status = "on hold";
        game.lastStatus = "in progress";
        game.waitForRejoin(false, 15);
        await new Promise(function (resolve) {
            setTimeout(resolve, 80);
        });
        assert.strictEqual(game.status, "game over");
        const failed = whiteSent.find(function (m) {
            return m.info === "Opponent failed to reconnect";
        });
        assert.ok(failed);
        assert.strictEqual(failed.disconnectedWasWhite, false);
        assert.strictEqual(game.chessGame.GameState.resigned, "black");
    });
});

describe("OnlineGameMessageProcessor rematch flow", function () {
    it("forwards rematch offer when opponent is connected", function () {
        const game = makeOnlineGame();
        game.status = "game over";
        const blackSent = [];
        game.whitePlayer.channel = openWs([]);
        game.blackPlayer.channel = openWs(blackSent);
        const proc = new OnlineGameMessageProcessor();
        proc.rematchOfferForward(game, {
            type: "info",
            info: "offer rematch",
            gameId: game.gameId,
            isWhite: true,
            offererWantsColor: "black",
            timeMinutes: 15,
        });
        assert.ok(game.pendingRematchOffer);
        assert.strictEqual(game.pendingRematchOffer.offererIsWhite, true);
        assert.strictEqual(game.pendingRematchOffer.offererWantsColor, "black");
        assert.strictEqual(game.pendingRematchOffer.timeMinutes, 15);
        assert.strictEqual(blackSent.length, 1);
        assert.strictEqual(blackSent[0].info, "offer rematch");
        assert.strictEqual(blackSent[0].timeMinutes, 15);
    });

    it("clears pending and forwards rematch decline", function () {
        const game = makeOnlineGame();
        game.status = "game over";
        const whiteSent = [];
        game.whitePlayer.channel = openWs(whiteSent);
        game.blackPlayer.channel = openWs([]);
        game.pendingRematchOffer = {
            offererIsWhite: true,
            offererWantsColor: "white",
            timeMinutes: 30,
        };
        const proc = new OnlineGameMessageProcessor();
        proc.rematchOfferDeclined(game, {
            type: "info",
            info: "rematch declined",
            gameId: game.gameId,
            isWhite: false,
        });
        assert.strictEqual(game.pendingRematchOffer, null);
        assert.strictEqual(whiteSent.length, 1);
        assert.strictEqual(whiteSent[0].info, "rematch declined");
    });

    it("rejects rematch accept from the offerer", function () {
        const game = makeOnlineGame();
        game.status = "game over";
        game.pendingRematchOffer = {
            offererIsWhite: true,
            offererWantsColor: "white",
            timeMinutes: 30,
        };
        let created = 0;
        game.createRemtach = function () {
            created += 1;
        };
        const proc = new OnlineGameMessageProcessor();
        proc.rematchOfferAccepted(game, {
            type: "info",
            info: "rematch accepted",
            gameId: game.gameId,
            isWhite: true,
        });
        assert.strictEqual(created, 0);
        assert.ok(game.pendingRematchOffer);
    });

    it("accepts rematch from opponent and passes options to createRemtach", function () {
        const game = makeOnlineGame();
        game.status = "game over";
        game.pendingRematchOffer = {
            offererIsWhite: true,
            offererWantsColor: "black",
            timeMinutes: 25,
        };
        const calls = [];
        game.createRemtach = function (isWhite, cb, options) {
            calls.push({ isWhite: isWhite, options: options });
        };
        const proc = new OnlineGameMessageProcessor();
        proc.rematchOfferAccepted(game, {
            type: "info",
            info: "rematch accepted",
            gameId: game.gameId,
            isWhite: false,
        });
        assert.strictEqual(game.pendingRematchOffer, null);
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].isWhite, false);
        assert.strictEqual(calls[0].options.offererWantsColor, "black");
        assert.strictEqual(calls[0].options.timeMinutes, 25);
    });
});
