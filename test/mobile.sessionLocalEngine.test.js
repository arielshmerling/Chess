/**
 * Phase 8 mobile LocalEngineMode adapter characterization.
 */
/* eslint-disable */

const assert = require("assert");
const MobileSessionLocalEngine = require("../src/mobile/mobile-session-local-engine");
const { SinglePlayerGame } = require("../src/modules/game/SinglePlayerGame");
const { SinglePlayerMessageProcessor } = require("../src/modules/game/SinglePlayerMessageProcessor");
const { Player } = require("../src/modules/game/Player");
const { validateWebSocketMessage } = require("../src/serverValidations");
const gameService = require("../src/modules/game/service");

describe("mobile session local-engine adapter", function () {
    it("exposes attach helpers without DOM", function () {
        assert.strictEqual(typeof MobileSessionLocalEngine.attach, "function");
        assert.strictEqual(typeof MobileSessionLocalEngine.shouldAttach, "function");
        assert.strictEqual(typeof MobileSessionLocalEngine.sessionApisReady, "function");
        assert.strictEqual(typeof MobileSessionLocalEngine.isMobileGamePage, "function");
        assert.strictEqual(typeof MobileSessionLocalEngine.toServerWhiteViewMove, "function");
    });

    it("shouldAttach only for clientEngine SinglePlayerGame", function () {
        assert.strictEqual(
            MobileSessionLocalEngine.shouldAttach({
                gameType: "SinglePlayerGame",
                clientEngine: true,
            }),
            true,
        );
        assert.strictEqual(
            MobileSessionLocalEngine.shouldAttach({
                gameType: "SinglePlayerGame",
            }),
            false,
        );
        assert.strictEqual(
            MobileSessionLocalEngine.shouldAttach({
                gameType: "OnlineGame",
                clientEngine: true,
            }),
            false,
        );
        assert.strictEqual(
            MobileSessionLocalEngine.shouldAttach({
                gameType: "SinglePlayerGame",
                clientEngine: true,
                watcher: true,
            }),
            false,
        );
    });

    it("toServerWhiteViewMove flips when board is black view", function () {
        const move = { source: { row: 1, col: 2 }, target: { row: 3, col: 4 } };
        const flipped = { source: { row: 6, col: 5 }, target: { row: 4, col: 3 } };
        const game = {
            WhitePlayerView: false,
            flipMove: function () {
                return flipped;
            },
        };
        assert.strictEqual(MobileSessionLocalEngine.toServerWhiteViewMove(move, game), flipped);
        game.WhitePlayerView = true;
        assert.strictEqual(MobileSessionLocalEngine.toServerWhiteViewMove(move, game), move);
    });

    it("applyClassicEngineMove animates with skipFinalSync", async function () {
        const animateOpts = [];
        const prevAnimate = global.animateMove;
        global.animateMove = async function (_move, opts) {
            animateOpts.push(opts || null);
        };
        try {
            const move = {
                source: { row: 1, col: 4 },
                target: { row: 3, col: 4 },
            };
            const game = {
                GameOver: false,
                WhitePlayerView: true,
                makeMove: function () {
                    return move;
                },
            };
            const ok = await MobileSessionLocalEngine.applyClassicEngineMove(move, {
                game: game,
                gameInfo: { id: "g1", userId: "u1", username: "tester" },
                humanIsWhite: true,
            });
            assert.strictEqual(ok, true);
            assert.strictEqual(animateOpts.length, 1);
            assert.deepStrictEqual(animateOpts[0], { skipFinalSync: true });
        } finally {
            global.animateMove = prevAnimate;
        }
    });

    it("shouldAttach requires published window gameInfo.clientEngine", function () {
        assert.strictEqual(
            MobileSessionLocalEngine.shouldAttach({
                gameType: "SinglePlayerGame",
                clientEngine: true,
            }),
            true,
        );
    });
});

describe("SinglePlayerGame clientEngine", function () {
    it("newGame can set clientEngine option", function () {
        const game = gameService.newGame(1, "tester", "aaaaaaaaaaaaaaaaaaaaaaaa", {
            engine: "brain43",
            clientEngine: true,
        });
        assert.strictEqual(game.constructor.name, "SinglePlayerGame");
        assert.strictEqual(game.options.clientEngine, true);
        assert.strictEqual(game.usesClientEngine(), true);
    });

    it("makeBrainMove no-ops when clientEngine", async function () {
        const player = new Player("aaaaaaaaaaaaaaaaaaaaaaaa", "tester");
        const game = new SinglePlayerGame(
            {
                options: { engine: "brain43", difficulty: 3, clientEngine: true },
                playAsBlack: false,
            },
            player,
            "play",
        );
        const result = await game.makeBrainMove(false);
        assert.strictEqual(result, null);
    });

    it("onMoveReceived skips makeBrainMove when clientEngine", async function () {
        const processor = new SinglePlayerMessageProcessor();
        let brainCalls = 0;
        const game = {
            startedOn: Date.now(),
            lastMoveOn: null,
            chessGame: { GameOver: false },
            usesClientEngine: function () {
                return true;
            },
            handleMove: async function () {
                return { valid: true, moveStr: "e4" };
            },
            sendMessage: function () {},
            sendMoveToWatchers: function () {},
            makeBrainMove: function () {
                brainCalls += 1;
            },
        };
        await processor.onMoveReceived(game, {
            gameId: "bbbbbbbbbbbbbbbbbbbbbbbb",
            isWhite: true,
            data: {},
        });
        assert.strictEqual(brainCalls, 0);
    });

    it("validates clientEngineMove cmd schema", function () {
        const result = validateWebSocketMessage({
            type: "cmd",
            info: "clientEngineMove",
            gameId: "bbbbbbbbbbbbbbbbbbbbbbbb",
            userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
            username: "tester",
            isWhite: false,
            moveTime: 100,
            whiteTimer: 100,
            blackTimer: 100,
            data: {
                capturedPiece: null,
                castling: false,
                ennPassant: false,
                hitSquare: null,
                moveStr: "e5",
                moveTime: 100,
                piece: { color: "black", pieceType: 0 },
                promotion: false,
                source: { row: 1, col: 4 },
                target: { row: 3, col: 4 },
                turn: "black",
                valid: true,
                whitePlayerView: true,
            },
        });
        assert.strictEqual(result.ok, true);
    });

    it("process(cmd clientEngineMove) keeps processor this binding", async function () {
        const processor = new SinglePlayerMessageProcessor();
        let called = 0;
        const game = {
            usesClientEngine: function () {
                return true;
            },
            startedOn: null,
            lastMoveOn: null,
            chessGame: { GameOver: false },
            handleMove: async function () {
                called += 1;
                return { valid: true, moveStr: "e5" };
            },
            updateLastMoveTime: function () {},
            sendMoveToWatchers: function () {},
            sendMessage: function () {},
        };
        await processor.process(game, {
            type: "cmd",
            info: "clientEngineMove",
            gameId: "bbbbbbbbbbbbbbbbbbbbbbbb",
            isWhite: false,
            data: { source: { row: 1, col: 4 }, target: { row: 3, col: 4 } },
        });
        assert.strictEqual(called, 1);
    });
});
