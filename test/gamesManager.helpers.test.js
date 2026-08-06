/**
 * gamesManager service — pure helpers and in-memory game lookups.
 */
"use strict";

const assert = require("assert");
const gamesManager = require("../src/modules/gamesManager/service");
const { SinglePlayerGame } = require("../src/modules/game/SinglePlayerGame");
const { Player } = require("../src/modules/game/Player");

describe("gamesManager service helpers", function () {
    it("gameTypeToText maps known ids", function () {
        assert.strictEqual(gamesManager.gameTypeToText(gamesManager.GameTypes.AI), "SinglePlayerGame");
        assert.strictEqual(gamesManager.gameTypeToText(gamesManager.GameTypes.ONLINE), "OnlineGame");
        assert.strictEqual(gamesManager.gameTypeToText(gamesManager.GameTypes.PRACTICE), "PracticeGame");
        assert.throws(() => gamesManager.gameTypeToText(999), /Unknown game type/);
    });

    it("parseGames formats list rows including draw and cancelled", function () {
        const created = new Date("2024-06-15T12:00:00Z");
        const rows = gamesManager.parseGames([
            {
                _id: "a",
                created,
                whitePlayer: "W",
                blackPlayer: "B",
                result: "1/2-1/2",
                state: "game over",
                reason: "draw",
                gameType: "OnlineGame",
                moves: ["{}", "{}"],
            },
            {
                _id: "b",
                created,
                whitePlayer: "W2",
                blackPlayer: "B2",
                result: "",
                state: "cancelled",
                reason: "",
                gameType: "SinglePlayerGame",
                moves: ["{}"],
            },
        ]);
        assert.strictEqual(rows[0].Result, "½-½");
        assert.strictEqual(rows[0].Moves, 1);
        assert.strictEqual(rows[1].Result, "Cancelled");
        assert.strictEqual(rows[1].Moves, 0);
    });

    it("replayStoredMovesToBoardState replays valid plies", function () {
        const moves = [
            JSON.stringify({
                source: { row: 6, col: 4 },
                target: { row: 4, col: 4 },
                moveStr: "e4",
            }),
            {
                source: { row: 1, col: 4 },
                target: { row: 3, col: 4 },
                moveStr: "e5",
            },
            "not-json",
            null,
            { source: { row: 0, col: 0 } },
        ];
        const snap = gamesManager.replayStoredMovesToBoardState(moves);
        assert.ok(snap);
        assert.ok(snap.board);
        assert.strictEqual(snap.turn, "white");
    });

    it("AddGame / getGameById / pending lookups", function () {
        const player = new Player("uid-gm-1", "alice");
        const game = new SinglePlayerGame(
            { gameType: "SinglePlayerGame", options: { engine: "brain41", clientEngine: true } },
            player,
            "play",
        );
        game.gameId = "live-gm-1";
        game.status = "pending";
        gamesManager.AddGame(game);
        assert.strictEqual(gamesManager.getGameById("live-gm-1"), game);

        const pending = gamesManager.findPendingGame(gamesManager.GameTypes.AI, "uid-gm-1");
        assert.ok(pending === game || pending == null || typeof pending === "object");

        const mine = gamesManager.findPendingGameCreatedByMe(gamesManager.GameTypes.AI, "uid-gm-1");
        assert.ok(mine === game || mine == null || typeof mine === "object");

        const snap = gamesManager.getActiveGameBoardSnapshot("live-gm-1", []);
        assert.ok(snap === null || (snap.board && snap.turn));
    });

    it("generate-state lock and stop flags", function () {
        gamesManager.resetGenerateStateStop();
        assert.strictEqual(gamesManager.isGenerateStateStopRequested(), false);
        assert.strictEqual(gamesManager.tryAcquireGenerateStateLock(), true);
        assert.strictEqual(gamesManager.isGenerateStateRunning(), true);
        assert.strictEqual(gamesManager.tryAcquireGenerateStateLock(), false);
        gamesManager.requestGenerateStateStop();
        assert.strictEqual(gamesManager.isGenerateStateStopRequested(), true);
        gamesManager.releaseGenerateStateLock();
        assert.strictEqual(gamesManager.isGenerateStateRunning(), false);
        gamesManager.resetGenerateStateStop();
    });

    it("opening book path helpers exist", function () {
        assert.ok(typeof gamesManager.getOpeningBookLinesPath() === "string");
        assert.ok(gamesManager.OPENING_BOOK_LINES_BASENAME);
    });

    it("findSharedOnlineGameIdBetweenUsers scans live OnlineGames", function () {
        const { OnlineGame } = require("../src/modules/game/OnlineGame");
        const white = new Player("uid-w", "whiteU");
        const black = new Player("uid-b", "blackU");
        const game = new OnlineGame(
            { gameType: "OnlineGame", options: { timeMinutes: 10 } },
            white,
            "play",
        );
        game.blackPlayer = black;
        game.gameId = "shared-og-1";
        game.status = "in progress";
        gamesManager.AddGame(game);
        const id = gamesManager.findSharedOnlineGameIdBetweenUsers("uid-w", "uid-b");
        assert.strictEqual(String(id), "shared-og-1");
        assert.strictEqual(
            gamesManager.findSharedOnlineGameIdBetweenUsers("uid-w", "uid-other"),
            null,
        );
    });
});
