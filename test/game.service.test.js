/**
 * modules/game/service factory helpers.
 */
"use strict";

const assert = require("assert");
const gameService = require("../src/modules/game/service");

describe("game service", function () {
    it("newGame applies defaults and timeMinutes", function () {
        const g = gameService.newGame(1, "alice", "uid-1", {});
        assert.ok(g);
        assert.strictEqual(g.options.engine, "brain43");
        assert.strictEqual(g.options.difficulty, 3);
        assert.strictEqual(g.options.mouse, "drag");
        assert.strictEqual(g.options.clientEngine, false);
        assert.strictEqual(g.chessGame.GameTimeLength, 90 * 60);

        const g2 = gameService.newGame(1, "bob", "uid-2", {
            color: "black",
            engine: "brain41",
            difficulty: 2,
            mouse: "double",
            showAvailableMoves: false,
            timeMinutes: 30,
            allowUndo: false,
            friendly: false,
            clientEngine: true,
            isPrivate: true,
            invitedUserId: 99,
        });
        assert.strictEqual(g2.options.engine, "brain41");
        assert.strictEqual(g2.options.clientEngine, true);
        assert.strictEqual(g2.chessGame.GameTimeLength, 30 * 60);
        assert.ok(g2.playAsBlack || g2.blackPlayer);
    });

    it("createReviewGame joins black and sets review metadata", function () {
        const game = gameService.createReviewGame(
            "uid",
            "reviewer",
            {
                gameType: "SinglePlayerGame",
                whitePlayer: "W",
                blackPlayer: "B",
                reason: "checkmate",
                result: "1-0",
                timeMinutes: 45,
                moves: [],
            },
            "review",
        );
        assert.ok(game.whitePlayer);
        assert.ok(game.blackPlayer);
        assert.strictEqual(game.reviewReason, "checkmate");
        assert.strictEqual(game.reviewResult, "1-0");
        assert.strictEqual(game.chessGame.GameTimeLength, 45 * 60);
    });

    it("joinAsViewer watches the game", function () {
        const game = gameService.newGame(1, "alice", "uid-1", { clientEngine: true });
        let watched = null;
        game.watch = function (p) {
            watched = p;
        };
        gameService.joinAsViewer(game, "v1", "viewer");
        assert.strictEqual(watched.userName, "viewer");
    });

    it("createServerChessGame builds a plain server game shell", function () {
        const g = gameService.createServerChessGame(
            "gid",
            "alice",
            "uid",
            "SinglePlayerGame",
            "play",
            null,
            "White",
            "Black",
            { id: "w" },
            { id: "b" },
        );
        assert.strictEqual(g.gameId, "gid");
        assert.strictEqual(g.gameType, "SinglePlayerGame");
        assert.ok(g.chessGame);
        assert.strictEqual(g.turn, "white");
        assert.ok(/^\d{2}:\d{2}:\d{2}$/.test(g.createOn));
    });
});
