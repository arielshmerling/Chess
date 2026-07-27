/**
 * Phase 0 characterization: session contracts, GameFactory, online draw rules, WS schemas.
 * Run: mocha --exit ./test/session.phase0.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { MODE_IDS, getModeCapabilities } = require("../src/session");
const { GameFactory } = require("../src/modules/game/GameFactory");
const { Player } = require("../src/modules/game/Player");
const { OnlineGameMessageProcessor } = require("../src/modules/game/OnlineGameMessageProcessor");
const { validateWebSocketMessage } = require("../src/serverValidations");

describe("session Phase 0 contracts", function () {
    it("exposes stable MODE_IDS", function () {
        assert.strictEqual(MODE_IDS.LOCAL_ENGINE, "localEngine");
        assert.strictEqual(MODE_IDS.ONLINE, "online");
        assert.strictEqual(MODE_IDS.PRACTICE, "practice");
        assert.strictEqual(MODE_IDS.REVIEW, "review");
        assert.strictEqual(MODE_IDS.WATCH, "watch");
        assert.strictEqual(MODE_IDS.POSITION_SETUP, "positionSetup");
        assert.strictEqual(MODE_IDS.CONFIGURATION, "configuration");
    });

    it("localEngine capabilities match single-player Play shell intent", function () {
        const caps = getModeCapabilities(MODE_IDS.LOCAL_ENGINE);
        assert.strictEqual(caps.engine, true);
        assert.strictEqual(caps.network, false);
        assert.strictEqual(caps.resign, true);
        assert.strictEqual(caps.undo, true);
        assert.strictEqual(caps.draw, false);
        assert.strictEqual(caps.chat, false);
    });

    it("online capabilities require network, resign, draw, and rematch", function () {
        const caps = getModeCapabilities(MODE_IDS.ONLINE);
        assert.strictEqual(caps.network, true);
        assert.strictEqual(caps.resign, true);
        assert.strictEqual(caps.engine, false);
        assert.strictEqual(caps.undo, false);
        assert.strictEqual(caps.draw, true);
        assert.strictEqual(caps.rematch, true);
        assert.strictEqual(caps.chat, false);
        assert.strictEqual(caps.watchers, false);
    });

    it("practice capabilities are local self-play (no engine/network)", function () {
        const caps = getModeCapabilities(MODE_IDS.PRACTICE);
        assert.strictEqual(caps.undo, true);
        assert.strictEqual(caps.redo, true);
        assert.strictEqual(caps.resign, true);
        assert.strictEqual(caps.draw, false);
        assert.strictEqual(caps.rematch, true);
        assert.strictEqual(caps.engine, false);
        assert.strictEqual(caps.network, false);
        assert.strictEqual(caps.reviewNav, false);
    });

    it("positionSetup capabilities allow setup only", function () {
        const caps = getModeCapabilities(MODE_IDS.POSITION_SETUP);
        assert.strictEqual(caps.positionSetup, true);
        assert.strictEqual(caps.brainConfig, false);
        assert.strictEqual(caps.engine, false);
        assert.strictEqual(caps.network, false);
        assert.strictEqual(caps.resign, false);
    });

    it("configuration capabilities allow brainConfig only", function () {
        const caps = getModeCapabilities(MODE_IDS.CONFIGURATION);
        assert.strictEqual(caps.brainConfig, true);
        assert.strictEqual(caps.positionSetup, false);
        assert.strictEqual(caps.engine, false);
        assert.strictEqual(caps.network, false);
    });

    it("unknown mode returns all-false capabilities", function () {
        const caps = getModeCapabilities("nope");
        assert.strictEqual(caps.engine, false);
        assert.strictEqual(caps.network, false);
        assert.strictEqual(caps.resign, false);
    });
});

describe("GameFactory characterization", function () {
    const player = new Player("aaaaaaaaaaaaaaaaaaaaaaaa", "tester", true);

    it("creates SinglePlayerGame for type 1", function () {
        const game = GameFactory.createGame({ gameType: 1 }, player, "play");
        assert.strictEqual(game.constructor.name, "SinglePlayerGame");
    });

    it("creates OnlineGame for type 2", function () {
        const game = GameFactory.createGame({ gameType: 2 }, player, "play");
        assert.strictEqual(game.constructor.name, "OnlineGame");
    });

    it("creates PracticeGame for type 3", function () {
        const game = GameFactory.createGame({ gameType: 3 }, player, "play");
        assert.strictEqual(game.constructor.name, "PracticeGame");
    });

    it("accepts string type names", function () {
        assert.strictEqual(
            GameFactory.createGame({ gameType: "OnlineGame" }, player, "play").constructor.name,
            "OnlineGame",
        );
    });

    it("rejects unknown types", function () {
        assert.throws(
            () => GameFactory.createGame({ gameType: 99 }, player, "play"),
            /Unknown game type/,
        );
    });
});

describe("OnlineGameMessageProcessor.drawOfferForward characterization", function () {
    const processor = new OnlineGameMessageProcessor();

    function mockGame(overrides) {
        const sent = [];
        return Object.assign(
            {
                status: "in progress",
                moves: [],
                chessGame: { Turn: "white" },
                sent,
                sendMessageToOpponent(msg) {
                    sent.push({ channel: "opponent", msg });
                },
                sendInfoToWatchers(msg) {
                    sent.push({ channel: "watchers", msg });
                },
            },
            overrides,
        );
    }

    it("does not forward when game is over", function () {
        const game = mockGame({ status: "game over", moves: [{}, {}] });
        processor.drawOfferForward(game, { isWhite: true });
        assert.strictEqual(game.sent.length, 0);
    });

    it("blocks white offer before any move", function () {
        const game = mockGame({ moves: [], chessGame: { Turn: "black" } });
        processor.drawOfferForward(game, { isWhite: true });
        assert.strictEqual(game.sent.length, 0);
    });

    it("blocks white offer on white turn", function () {
        const game = mockGame({ moves: [{}], chessGame: { Turn: "white" } });
        processor.drawOfferForward(game, { isWhite: true });
        assert.strictEqual(game.sent.length, 0);
    });

    it("forwards white offer after a move on black turn (players only, not watchers)", function () {
        const game = mockGame({ moves: [{}], chessGame: { Turn: "black" } });
        const msg = { isWhite: true, info: "offer draw" };
        processor.drawOfferForward(game, msg);
        assert.strictEqual(game.sent.length, 1);
        assert.strictEqual(game.sent[0].channel, "opponent");
    });

    it("requires two moves before black may offer", function () {
        const game = mockGame({ moves: [{}], chessGame: { Turn: "white" } });
        processor.drawOfferForward(game, { isWhite: false });
        assert.strictEqual(game.sent.length, 0);

        game.moves = [{}, {}];
        processor.drawOfferForward(game, { isWhite: false });
        assert.strictEqual(game.sent.length, 1);
        assert.strictEqual(game.sent[0].channel, "opponent");
    });
});

describe("WS message schema characterization", function () {
    const gameId = "bbbbbbbbbbbbbbbbbbbbbbbb";
    const userId = "cccccccccccccccccccccccc";

    it("accepts a minimal chat info payload", function () {
        const result = validateWebSocketMessage({
            gameId,
            type: "info",
            info: "chat",
            data: "hi",
            userId,
            username: "alice",
            isWhite: true,
        });
        assert.strictEqual(result.ok, true);
    });

    it("accepts resign info", function () {
        const result = validateWebSocketMessage({
            gameId,
            type: "info",
            info: "resign",
            userId,
            username: "alice",
            isWhite: true,
        });
        assert.strictEqual(result.ok, true);
    });

    it("rejects unknown info kinds", function () {
        const result = validateWebSocketMessage({
            gameId,
            type: "info",
            info: "not a real info",
            userId,
            username: "alice",
            isWhite: true,
        });
        assert.strictEqual(result.ok, false);
    });

    it("accepts game over info without user fields", function () {
        const result = validateWebSocketMessage({
            gameId,
            type: "info",
            info: "game over",
        });
        assert.strictEqual(result.ok, true);
    });
});
