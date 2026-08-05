const assert = require("assert");
const { describe, it } = require("mocha");

const SpServerSync = require("../src/session/spServerSync");
const { ChessGame } = require("../src/ChessGame");
const { GameBase } = require("../src/modules/game/GameBase");
const { Player } = require("../src/modules/game/Player");
const { SinglePlayerMessageProcessor } = require("../src/modules/game/SinglePlayerMessageProcessor");
const WsTransport = require("../src/session/wsTransport");
const protocol = require("../src/session/onlineProtocol");

describe("spServerSync toServerMovePayload", function () {
    it("does not flip human moves on a black-view board (server will flip)", function () {
        const game = new ChessGame();
        game.startNewGame(false);
        const move = {
            valid: true,
            source: { row: 6, col: 3 },
            target: { row: 4, col: 3 },
            piece: { color: "black", pieceType: 0 },
            promotion: false,
            ennPassant: false,
            capturedPiece: null,
            hitSquare: null,
            turn: "black",
            castling: false,
            whitePlayerView: false,
            moveStr: "e5",
            moveTime: 100,
        };
        const out = SpServerSync.toServerMovePayload(move, {
            source: "human",
            whitePlayerView: false,
            flipMove: game.flipMove.bind(game),
        });
        assert.strictEqual(out.source.row, 6);
        assert.strictEqual(out.source.col, 3);
        assert.strictEqual(out.valid, true);
    });

    it("flips engine moves from black-view to white-view", function () {
        const game = new ChessGame();
        game.startNewGame(false);
        const blackViewMove = {
            valid: true,
            source: { row: 1, col: 3 },
            target: { row: 3, col: 3 },
            piece: { color: "white", pieceType: 0 },
            promotion: false,
            ennPassant: false,
            capturedPiece: null,
            hitSquare: null,
            turn: "white",
            castling: false,
            whitePlayerView: false,
            moveStr: "e4",
            moveTime: 100,
        };
        const out = SpServerSync.toServerMovePayload(blackViewMove, {
            source: "engine",
            whitePlayerView: false,
            flipMove: game.flipMove.bind(game),
        });
        assert.strictEqual(out.source.row, 6);
        assert.strictEqual(out.source.col, 4);
        assert.strictEqual(out.target.row, 4);
        assert.strictEqual(out.target.col, 4);
    });
});

describe("spServerSync connect waits for connected ack", function () {
    it("resolves after connected info", async function () {
        class FakeWebSocket {
            constructor() {
                this.readyState = 0;
                this.sent = [];
                setTimeout(() => {
                    this.readyState = 1;
                    if (this.onopen) {
                        this.onopen();
                    }
                    setTimeout(() => {
                        if (this.onmessage) {
                            this.onmessage({
                                data: JSON.stringify({
                                    type: "info",
                                    info: "connected",
                                    gameId: "6a6d7ae1b3a538b4f8cbd7d7",
                                }),
                            });
                        }
                    }, 5);
                }, 0);
            }
            send(data) {
                this.sent.push(data);
            }
            close() {
                this.readyState = 3;
                if (this.onclose) {
                    this.onclose();
                }
            }
        }

        const transport = WsTransport.create({ WebSocket: FakeWebSocket });
        let ready = false;
        const connect = function () {
            return new Promise(function (resolve, reject) {
                let settled = false;
                function finishOk() {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    ready = true;
                    resolve();
                }
                transport.onMessage(function (msg) {
                    if (msg && msg.type === "info" && msg.info === "connected") {
                        finishOk();
                    }
                });
                transport.onOpen(function () {
                    transport.send(
                        protocol.buildConnectMessage({
                            username: "tester",
                            isWhite: true,
                            gameId: "6a6d7ae1b3a538b4f8cbd7d7",
                            userId: "69ac2cc393c4f39bea834f00",
                            watcher: false,
                        }),
                    );
                });
                transport.onError(reject);
                transport.connect("ws://localhost/ws");
            });
        };

        assert.strictEqual(ready, false);
        await connect();
        assert.strictEqual(ready, true);
    });
});

describe("GameBase connected ack", function () {
    it("sends connected info after init", function () {
        const sent = [];
        const ws = {
            readyState: 1,
            OPEN: 1,
            on() {},
            off() {},
            send(data) {
                sent.push(JSON.parse(data));
            },
        };
        const game = new GameBase(
            { gameType: 1, options: {} },
            new Player("69ac2cc393c4f39bea834f00", "tester"),
            "play",
        );
        game.messageProcessor = new SinglePlayerMessageProcessor();
        game.init(ws, "69ac2cc393c4f39bea834f00");
        assert.strictEqual(sent.length, 1);
        assert.strictEqual(sent[0].type, "info");
        assert.strictEqual(sent[0].info, "connected");
        assert.strictEqual(sent[0].moveCount, 0);
    });
});

describe("Play SP mirror orientation vs handleMove", function () {
    it("accepts black human ply when sent in player view", async function () {
        const human = new Player("69ac2cc393c4f39bea834f00", "tester");
        const game = new GameBase(
            { gameType: 1, options: { clientEngine: true } },
            human,
            "play",
        );
        game.whitePlayer = new Player(null, "Brain");
        game.blackPlayer = human;
        game.messageProcessor = new SinglePlayerMessageProcessor();
        game.chessGame.startNewGame(true);
        game.options = { clientEngine: true };

        const e4 = await game.handleMove(
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
                moveTime: 100,
            },
            "brain",
        );
        assert.notStrictEqual(e4.valid, false);

        const client = new ChessGame();
        client.startNewGame(false);
        client.makeMove({ row: 1, col: 3 }, { row: 3, col: 3 });
        const humanMove = client.makeMove({ row: 6, col: 3 }, { row: 4, col: 3 });
        humanMove.moveTime = 100;
        const payload = SpServerSync.toServerMovePayload(humanMove, {
            source: "human",
            whitePlayerView: false,
            flipMove: client.flipMove.bind(client),
        });
        const applied = await game.handleMove(false, payload, "player");
        assert.notStrictEqual(applied.valid, false);
        assert.ok(String(applied.moveStr).indexOf("e5") !== -1);
    });

    it("rejects double-flipped black human ply (old Play bug)", async function () {
        const human = new Player("69ac2cc393c4f39bea834f00", "tester");
        const game = new GameBase(
            { gameType: 1, options: { clientEngine: true } },
            human,
            "play",
        );
        game.whitePlayer = new Player(null, "Brain");
        game.blackPlayer = human;
        game.messageProcessor = new SinglePlayerMessageProcessor();
        game.chessGame.startNewGame(true);
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
                moveTime: 100,
            },
            "brain",
        );

        const client = new ChessGame();
        client.startNewGame(false);
        client.makeMove({ row: 1, col: 3 }, { row: 3, col: 3 });
        const humanMove = client.makeMove({ row: 6, col: 3 }, { row: 4, col: 3 });
        humanMove.moveTime = 100;
        /* Old bug: always flip before send, then server flips again for black player. */
        const wronglyFlipped = client.flipMove(humanMove);
        const applied = await game.handleMove(false, wronglyFlipped, "player");
        assert.ok(applied.valid === false || String(applied.moveStr).indexOf("e5") === -1);
    });
});
