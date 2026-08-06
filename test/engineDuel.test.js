/**
 * Engine duel service unit checks (no Mongo / live engines required).
 */
"use strict";

const assert = require("assert");
const { EngineDuelGame } = require("../src/modules/game/EngineDuelGame");
const { Player } = require("../src/modules/game/Player");
const { engineLabel } = require("../src/modules/game/engineDuelService");
const { GameFactory } = require("../src/modules/game/GameFactory");

describe("engine duel", function () {
    it("engineLabel uses registry fallback", function () {
        assert.strictEqual(engineLabel("brain43"), "Brain 4.3");
        assert.strictEqual(engineLabel("stockfish"), "Stockfish");
    });

    it("EngineDuelGame has two AI seats and rejects player init", function () {
        const admin = new Player("admin-id", "AdminUser");
        const game = new EngineDuelGame(
            {
                options: {
                    whiteEngine: "brain43",
                    blackEngine: "stockfish",
                    whiteLabel: "Brain 4.3",
                    blackLabel: "Stockfish",
                    difficulty: 2,
                    timeMinutes: 30,
                },
            },
            admin,
            "play",
        );
        assert.strictEqual(game.constructor.name, "EngineDuelGame");
        assert.strictEqual(game.whitePlayer.userId, null);
        assert.strictEqual(game.blackPlayer.userId, null);
        assert.strictEqual(game.whitePlayer.userName, "Brain 4.3");
        assert.strictEqual(game.blackPlayer.userName, "Stockfish");
        assert.strictEqual(game.createdBy.userName, "AdminUser");
        assert.strictEqual(game.init(), false);

        game.startServerClocks = () => {};
        const events = [];
        game.raiseEvent = async (ev, payload) => {
            events.push({ ev, payload });
        };
        game.startDuelBoard();
        assert.strictEqual(game.status, "in progress");
        assert.ok(events.length >= 1);
        game.requestAbort();
        assert.strictEqual(game.isAbortRequested(), true);
    });

    it("defaults engine seat labels when omitted", function () {
        const game = new EngineDuelGame({ options: {} }, new Player("a", "A"), "play");
        assert.strictEqual(game.whitePlayer.userName, "White engine");
        assert.strictEqual(game.blackPlayer.userName, "Black engine");
    });

    it("message processor no-ops processMessage", async function () {
        const game = new EngineDuelGame({ options: {} }, new Player("a", "A"), "play");
        await game.messageProcessor.processMessage();
    });

    it("GameFactory creates EngineDuelGame", function () {
        const admin = new Player("a", "A");
        const game = GameFactory.createGame(
            {
                gameType: "EngineDuelGame",
                options: {
                    whiteLabel: "W",
                    blackLabel: "B",
                },
            },
            admin,
            "play",
        );
        assert.strictEqual(game.constructor.name, "EngineDuelGame");
    });
});
