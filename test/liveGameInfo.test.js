"use strict";

const assert = require("assert");
const { resolveLiveGameInfoFlags } = require("../src/modules/game/liveGameInfo");
const { OnlineGame } = require("../src/modules/game/OnlineGame");
const { Player } = require("../src/modules/game/Player");
const gameClocks = require("../src/modules/game/gameClocks");

describe("liveGameInfo flags (refresh /gameInfo)", function () {
    it("exposes game over when chess is finished even if status lagged", function () {
        const flags = resolveLiveGameInfoFlags({
            status: "in progress",
            chessGame: { GameOver: true },
        });
        assert.strictEqual(flags.status, "game over");
        assert.strictEqual(flags.includeBoard, true);
    });

    it("keeps cancelled as cancelled even if chess flags look finished", function () {
        const flags = resolveLiveGameInfoFlags({
            status: "cancelled",
            chessGame: { GameOver: true },
        });
        assert.strictEqual(flags.status, "cancelled");
        assert.strictEqual(flags.includeBoard, false);
    });

    it("does not treat lastStatus-style lag as live board for cancelled", function () {
        /* Cancelled must not include board via stale lastStatus — only status matters. */
        const flags = resolveLiveGameInfoFlags({
            status: "cancelled",
            lastStatus: "in progress",
            chessGame: { GameOver: false },
        });
        assert.strictEqual(flags.status, "cancelled");
        assert.strictEqual(flags.includeBoard, false);
    });

    it("includes board for explicit game over", function () {
        const flags = resolveLiveGameInfoFlags({
            status: "game over",
            chessGame: { GameOver: true },
        });
        assert.strictEqual(flags.status, "game over");
        assert.strictEqual(flags.includeBoard, true);
    });
});

describe("game over refresh — server stays finished", function () {
    function makeGame() {
        const white = new Player("aaaaaaaaaaaaaaaaaaaaaaaa", "alice");
        const black = new Player("bbbbbbbbbbbbbbbbbbbbbbbb", "bob");
        const game = new OnlineGame({ gameType: "OnlineGame", options: {} }, white, "play");
        game.gameId = "g-finished-refresh";
        game.blackPlayer = black;
        game.createdBy = white;
        game.chessGame.startNewGame();
        game.status = "in progress";
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
            close() {},
        };
    }

    it("after timeout, Black reconnect init does not revive to in progress", async function () {
        const game = makeGame();
        game.whitePlayer.channel = openWs([]);
        game.blackPlayer.channel = openWs([]);
        gameClocks.startTurnClock(game, "white");
        gameClocks.pauseClocks(game);
        game.clockWhiteSec = 0;
        game.clockBlackSec = 60;
        const okFlag = await gameClocks.tryClientFlagHint(game, "white");
        assert.strictEqual(okFlag, true);
        assert.strictEqual(game.status, "game over");

        const flags = resolveLiveGameInfoFlags(game);
        assert.strictEqual(flags.status, "game over");
        assert.strictEqual(flags.includeBoard, true);

        const ok = game.init(openWs([]), game.blackPlayer.userId);
        assert.strictEqual(ok, true);
        assert.strictEqual(game.status, "game over");
    });
});
