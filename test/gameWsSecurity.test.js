"use strict";

const assert = require("assert");
const {
    resolvePlayerSeat,
    seatForChannel,
    applySocketMessageIdentity,
} = require("../src/modules/game/gameSeat");
const gameClocks = require("../src/modules/game/gameClocks");
const { GameBase } = require("../src/modules/game/GameBase");
const { Player } = require("../src/modules/game/Player");
const { OnlineGameMessageProcessor } = require("../src/modules/game/OnlineGameMessageProcessor");
const { SinglePlayerMessageProcessor } = require("../src/modules/game/SinglePlayerMessageProcessor");

describe("gameSeat (C1/C2 helpers)", function () {
    it("resolves white and black by userId allowlist", function () {
        const game = {
            whitePlayer: { userId: "aaa" },
            blackPlayer: { userId: "bbb" },
        };
        assert.strictEqual(resolvePlayerSeat(game, "aaa"), "white");
        assert.strictEqual(resolvePlayerSeat(game, "bbb"), "black");
        assert.strictEqual(resolvePlayerSeat(game, "ccc"), null);
    });

    it("does not default unknown ids to black", function () {
        const game = {
            whitePlayer: { userId: "aaa" },
            blackPlayer: null,
        };
        assert.strictEqual(resolvePlayerSeat(game, "stranger"), null);
    });

    it("prefers white when same user owns both seats (practice)", function () {
        const game = {
            whitePlayer: { userId: "same" },
            blackPlayer: { userId: "same" },
        };
        assert.strictEqual(resolvePlayerSeat(game, "same"), "white");
    });

    it("overwrites isWhite from socket seat", function () {
        const game = {};
        const msg = { type: "move", isWhite: true, data: {} };
        assert.strictEqual(applySocketMessageIdentity(game, msg, "black"), true);
        assert.strictEqual(msg.isWhite, false);
    });

    it("overwrites chat userId and username from the seated player", function () {
        const game = {
            whitePlayer: { userId: "uid-w", userName: "WhitePlayer" },
            blackPlayer: { userId: "uid-b", userName: "BlackPlayer" },
        };
        const msg = {
            type: "info",
            info: "chat",
            userId: "forged-id",
            username: "Impostor",
            isWhite: true,
            data: "hi",
        };
        assert.strictEqual(applySocketMessageIdentity(game, msg, "black"), true);
        assert.strictEqual(msg.isWhite, false);
        assert.strictEqual(msg.userId, "uid-b");
        assert.strictEqual(msg.username, "BlackPlayer");
    });

    it("maps clientEngineMove to the AI side", function () {
        const game = {};
        const msg = { type: "cmd", info: "clientEngineMove", isWhite: false, data: {} };
        assert.strictEqual(applySocketMessageIdentity(game, msg, "black"), true);
        assert.strictEqual(msg.isWhite, true);
    });

    it("allows practice to keep client isWhite", function () {
        const game = { allowsClientChosenSide: () => true };
        const msg = { type: "move", isWhite: false };
        assert.strictEqual(applySocketMessageIdentity(game, msg, "white"), true);
        assert.strictEqual(msg.isWhite, false);
    });

    it("seatForChannel matches white first", function () {
        const ws = {};
        const game = {
            whitePlayer: { channel: ws },
            blackPlayer: { channel: ws },
        };
        assert.strictEqual(seatForChannel(game, ws), "white");
    });
});

describe("GameBase.init seat allowlist (C2)", function () {
    function mockWs() {
        return {
            readyState: 1,
            OPEN: 1,
            handlers: {},
            on(ev, fn) {
                this.handlers[ev] = fn;
            },
            off() {},
            close() {
                this.closed = true;
            },
            send() {},
        };
    }

    it("rejects unknown userId and closes socket", function () {
        const white = new Player("69ac2cc393c4f39bea834f00", "w");
        const game = new GameBase({ gameType: 1, options: {} }, white, "play");
        game.blackPlayer = new Player("69ac2cc393c4f39bea834f01", "b");
        game.messageProcessor = new SinglePlayerMessageProcessor();
        const ws = mockWs();
        const ok = game.init(ws, "69ac2cc393c4f39bea834f99");
        assert.strictEqual(ok, false);
        assert.strictEqual(ws.closed, true);
        assert.strictEqual(game.whitePlayer.channel, undefined);
    });

    it("attaches black only when userId matches black", function () {
        const white = new Player("69ac2cc393c4f39bea834f00", "w");
        const game = new GameBase({ gameType: 1, options: {} }, white, "play");
        game.blackPlayer = new Player("69ac2cc393c4f39bea834f01", "b");
        game.messageProcessor = new SinglePlayerMessageProcessor();
        const ws = mockWs();
        assert.strictEqual(game.init(ws, "69ac2cc393c4f39bea834f01"), true);
        assert.strictEqual(game.blackPlayer.channel, ws);
        assert.notStrictEqual(game.whitePlayer.channel, ws);
    });
});

describe("socket-derived isWhite (C3)", function () {
    it("forces move side from channel, ignoring client isWhite", async function () {
        const white = new Player("69ac2cc393c4f39bea834f00", "w");
        const black = new Player("69ac2cc393c4f39bea834f01", "b");
        const game = new GameBase({ gameType: 2, options: {} }, white, "play");
        game.blackPlayer = black;
        game.messageProcessor = new OnlineGameMessageProcessor();
        game.chessGame.startNewGame(true);
        game.chessGame.GameTimeLength = 60;

        const moves = [];
        const orig = game.handleMove.bind(game);
        game.handleMove = async function (isWhite, data, origin) {
            moves.push({ isWhite, origin });
            return orig(isWhite, data, origin);
        };

        const ws = {
            readyState: 1,
            OPEN: 1,
            on(ev, fn) {
                if (ev === "message") {
                    this._onMessage = fn;
                }
            },
            off() {},
            send() {},
        };
        game.init(ws, black.userId);

        const forgedWhiteMove = {
            type: "move",
            gameId: game.gameId,
            username: "b",
            isWhite: true,
            data: {
                valid: true,
                source: { row: 1, col: 4 },
                target: { row: 3, col: 4 },
                piece: { color: "black", pieceType: 0 },
                promotion: false,
                ennPassant: false,
                capturedPiece: null,
                hitSquare: null,
                turn: "black",
                castling: false,
                whitePlayerView: false,
                moveStr: "e5",
                moveTime: 50,
            },
        };
        /* White must move first — seed e4 as brain so black is to move. */
        await game.handleMove(
            true,
            {
                valid: true,
                source: { row: 6, col: 4 },
                target: { row: 4, col: 4 },
                piece: { color: "white", pieceType: 0 },
                promotion: false,
                ennPassant: false,
                capturedPiece: null,
                hitSquare: null,
                turn: "white",
                castling: false,
                whitePlayerView: true,
                moveStr: "e4",
                moveTime: 50,
            },
            "brain",
        );
        moves.length = 0;

        await new Promise((resolve) => {
            ws._onMessage(JSON.stringify(forgedWhiteMove));
            setImmediate(resolve);
        });
        /* Allow async onMessageReceived to finish */
        await new Promise((r) => setImmediate(r));

        assert.ok(moves.length >= 1);
        assert.strictEqual(moves[0].isWhite, false);
    });
});

describe("server clocks / outOfTime", function () {
    afterEach(function () {
        /* no-op; timers unref'd */
    });

    it("rejects client flag hint while time remains", async function () {
        const white = new Player("69ac2cc393c4f39bea834f00", "w");
        const game = new GameBase({ gameType: 1, options: {} }, white, "play");
        game.messageProcessor = new SinglePlayerMessageProcessor();
        game.chessGame.GameTimeLength = 120;
        game.status = "in progress";
        gameClocks.startTurnClock(game, "white");

        const ok = await gameClocks.tryClientFlagHint(game, "white");
        assert.strictEqual(ok, false);
        assert.notStrictEqual(game.status, "game over");
        gameClocks.clearFlagTimer(game);
    });

    it("accepts flag hint when remaining is within grace", async function () {
        const white = new Player("69ac2cc393c4f39bea834f00", "w");
        const game = new GameBase({ gameType: 1, options: {} }, white, "play");
        game.messageProcessor = new SinglePlayerMessageProcessor();
        game.chessGame.startNewGame(true);
        game.chessGame.GameTimeLength = 60;
        game.status = "in progress";
        gameClocks.startTurnClock(game, "white");
        gameClocks.pauseClocks(game);
        game.clockWhiteSec = 0;
        game.clockBlackSec = 60;

        const ok = await gameClocks.tryClientFlagHint(game, "white");
        assert.strictEqual(ok, true);
        assert.strictEqual(game.status, "game over");
        assert.strictEqual(game.chessGame.OutOfTime, "white");
    });

    it("server timer flags when clock expires", async function () {
        this.timeout(3000);
        const white = new Player("69ac2cc393c4f39bea834f00", "w");
        const game = new GameBase({ gameType: 1, options: {} }, white, "play");
        game.messageProcessor = new SinglePlayerMessageProcessor();
        game.chessGame.startNewGame(true);
        game.chessGame.GameTimeLength = 1;
        game.status = "in progress";
        gameClocks.ensureClocks(game);
        game.clockWhiteSec = 0.05;
        game.clockBlackSec = 60;
        gameClocks.startTurnClock(game, "white");

        await new Promise((r) => setTimeout(r, 200));
        assert.strictEqual(game.status, "game over");
        assert.strictEqual(game.chessGame.OutOfTime, "white");
    });
});
