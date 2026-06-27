/**
 * Incremental FIDE rules coverage for ChessGame.js
 *
 * Phases (add one file section per phase):
 *   Phase 1 — Basic piece movement & capture (Articles 3.1–3.3, 3.9)
 *   Phase 2 — Promotion & pinned-piece constraints (Articles 3.7, 3.7.4)
 *   Phase 3 — Special moves edge cases (Articles 3.7.1–3.7.3, 3.8)
 *   Phase 4 — Check / checkmate / stalemate nuances (Articles 3.9, 5.1–5.2)
 *   Phase 5 — Draw rules refinements (Articles 5.2, 9.3)
 *   Phase 6 — Game termination (Articles 6.9, 9.6)
 */
/* eslint-disable */

const { ChessGame } = require("../src/ChessGame");
const assert = require("assert");

const PAWN = 0;
const KING = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;

function piece(color, pieceType) {
    return { color, pieceType };
}

function emptyBoard(pieces, overrides = {}) {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (const { row, col, color, pieceType } of pieces) {
        board[row][col] = piece(color, pieceType);
    }
    return JSON.stringify({
        board,
        turn: "white",
        capturedPiecesList: [],
        check: false,
        checkmate: false,
        draw: false,
        drawReason: "",
        resigned: "",
        outOfTime: "",
        whiteKingMoved: true,
        blackKingMoved: true,
        whitePlayerView: true,
        fiftyMovesCounter: 0,
        promoting: false,
        queensideWhiteRookMoved: true,
        queensideBlackRookMoved: true,
        kingsideWhiteRookMoved: true,
        kingsideBlackRookMoved: true,
        ...overrides,
    });
}

describe("FIDE rules — Phase 1: basic piece movement & capture", () => {
    /** @type {ChessGame} */
    let game;

    beforeEach(() => {
        game = new ChessGame(true);
    });

    describe("Knight (Article 3.2 — moves to one of the squares nearest to its stand)", () => {
        it("allows all eight L-shaped jumps from the centre", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: KNIGHT },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            const source = { row: 4, col: 4 };
            const expected = [
                { row: 6, col: 5 }, { row: 6, col: 3 },
                { row: 2, col: 5 }, { row: 2, col: 3 },
                { row: 5, col: 6 }, { row: 5, col: 2 },
                { row: 3, col: 6 }, { row: 3, col: 2 },
            ];
            for (const target of expected) {
                const move = game.validateMove(source, target, "white");
                assert.equal(move.valid, true, `Ne4 -> ${target.row},${target.col} should be legal`);
            }
        });

        it("jumps over occupied squares (not blocked like sliding pieces)", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: KNIGHT },
                { row: 5, col: 4, color: "white", pieceType: PAWN },
                { row: 5, col: 5, color: "black", pieceType: PAWN },
                { row: 5, col: 3, color: "black", pieceType: PAWN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            assert.equal(
                game.validateMove({ row: 4, col: 4 }, { row: 6, col: 5 }, "white").valid,
                true,
                "Knight should jump over the pawn on e5"
            );
        });

        it("rejects non-L-shaped destinations", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: KNIGHT },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            const invalidTargets = [
                { row: 5, col: 5 }, { row: 4, col: 6 }, { row: 6, col: 4 }, { row: 2, col: 2 },
            ];
            for (const target of invalidTargets) {
                const move = game.validateMove({ row: 4, col: 4 }, target, "white");
                assert.equal(move.valid, false, `Ne4 -> ${target.row},${target.col} should be illegal`);
                assert.equal(move.reason, game.Reasons.PIECE_MOVE_ILLEGAL);
            }
        });
    });

    describe("Queen (Article 3.2 — any number of squares along rank, file, or diagonal)", () => {
        it("moves like a rook along a rank", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: QUEEN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            assert.equal(game.validateMove({ row: 4, col: 4 }, { row: 4, col: 7 }, "white").valid, true);
        });

        it("moves like a bishop along a diagonal", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: QUEEN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            assert.equal(game.validateMove({ row: 4, col: 4 }, { row: 1, col: 1 }, "white").valid, true);
        });

        it("cannot leap over a blocker on a file", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: QUEEN },
                { row: 2, col: 4, color: "white", pieceType: PAWN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            assert.equal(
                game.validateMove({ row: 4, col: 4 }, { row: 0, col: 4 }, "white").valid,
                false,
                "Queen cannot pass through a friendly pawn"
            );
        });
    });

    describe("Capture rules (Article 3.1 — captures by moving to opponent's square)", () => {
        it("cannot capture a friendly piece with a rook", () => {
            game.loadGame(emptyBoard([
                { row: 7, col: 0, color: "white", pieceType: ROOK },
                { row: 4, col: 0, color: "white", pieceType: PAWN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            const move = game.validateMove({ row: 7, col: 0 }, { row: 4, col: 0 }, "white");
            assert.equal(move.valid, false);
            assert.equal(move.reason, game.Reasons.PIECE_MOVE_ILLEGAL);
        });

        it("cannot capture a friendly piece with a knight", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: KNIGHT },
                { row: 3, col: 6, color: "white", pieceType: BISHOP },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            assert.equal(
                game.validateMove({ row: 4, col: 4 }, { row: 3, col: 6 }, "white").valid,
                false
            );
        });

        it("captures an opponent piece when the move is otherwise legal", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: KNIGHT },
                { row: 3, col: 6, color: "black", pieceType: BISHOP },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            const move = game.makeMove({ row: 4, col: 4 }, { row: 3, col: 6 });
            assert.equal(move.valid, true);
            assert.equal(move.capturedPiece.pieceType, BISHOP);
            assert.equal(game.GameState.board[3][6].pieceType, KNIGHT);
        });
    });

    describe("King proximity (Article 3.9 — kings must never stand on adjacent squares)", () => {
        it("rejects a king move that would place kings adjacent", () => {
            game.loadGame(emptyBoard([
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 5, col: 5, color: "black", pieceType: KING },
            ], { turn: "white", whiteKingMoved: false, blackKingMoved: false }));
            const move = game.validateMove({ row: 7, col: 4 }, { row: 6, col: 4 }, "white");
            assert.equal(move.valid, false, "Ke2 is illegal when black king is on f3");
            assert.equal(move.reason, game.Reasons.PIECE_MOVE_ILLEGAL);
        });

        it("allows a king move that keeps at least one square between kings", () => {
            game.loadGame(emptyBoard([
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 5, col: 5, color: "black", pieceType: KING },
            ], { turn: "white", whiteKingMoved: false, blackKingMoved: false }));
            assert.equal(
                game.validateMove({ row: 7, col: 4 }, { row: 6, col: 3 }, "white").valid,
                true,
                "Kd2 keeps distance from the black king on f3"
            );
        });

        it("rejects capturing the opposing king (kings never occupy the same square)", () => {
            game.loadGame(emptyBoard([
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 6, col: 5, color: "black", pieceType: KING },
            ], { turn: "white" }));
            assert.equal(
                game.validateMove({ row: 7, col: 4 }, { row: 6, col: 5 }, "white").valid,
                false
            );
        });
    });

    describe("Pawn blocking (Article 3.2 — pawn moves forward, cannot pass through)", () => {
        it("cannot advance one square when blocked by a friendly piece", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: PAWN },
                { row: 3, col: 4, color: "white", pieceType: PAWN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            assert.equal(
                game.validateMove({ row: 4, col: 4 }, { row: 3, col: 4 }, "white").valid,
                false
            );
        });

        it("cannot advance one square when blocked by an opponent piece (must capture diagonally)", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: PAWN },
                { row: 3, col: 4, color: "black", pieceType: PAWN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            assert.equal(
                game.validateMove({ row: 4, col: 4 }, { row: 3, col: 4 }, "white").valid,
                false,
                "Straight push into enemy pawn is illegal; only diagonal capture is allowed"
            );
        });
    });
});

describe("FIDE rules — Phase 2: promotion & pinned pieces", () => {
    /** @type {ChessGame} */
    let game;

    beforeEach(() => {
        game = new ChessGame(true);
    });

    describe("Promotion (Article 3.7 — pawn reaching furthest rank)", () => {
        it("sets promoting flag and keeps the turn until a piece is chosen", () => {
            game.loadGame(emptyBoard([
                { row: 1, col: 4, color: "white", pieceType: PAWN },
                { row: 0, col: 0, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            const move = game.makeMove({ row: 1, col: 4 }, { row: 0, col: 4 });
            assert.equal(move.promotion, true);
            assert.equal(game.GameState.promoting, true);
            assert.equal(game.Turn, "white", "Turn waits until promotion is completed");
            assert.equal(game.GameState.board[0][4].pieceType, PAWN, "Pawn stays until promotion choice");
        });

        it("blocks all other moves while promotion is pending", () => {
            game.loadGame(emptyBoard([
                { row: 1, col: 4, color: "white", pieceType: PAWN },
                { row: 4, col: 4, color: "white", pieceType: KNIGHT },
                { row: 0, col: 0, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            game.makeMove({ row: 1, col: 4 }, { row: 0, col: 4 });
            const blocked = game.validateMove({ row: 4, col: 4 }, { row: 2, col: 3 }, "white");
            assert.equal(blocked.valid, false);
            assert.equal(blocked.reason, game.Reasons.PROMOTION_IN_PROGRESS);
        });

        it("offers four promotion choices in possibleMoves", () => {
            game.loadGame(emptyBoard([
                { row: 1, col: 4, color: "white", pieceType: PAWN },
                { row: 0, col: 0, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            const options = game.possibleMoves({ row: 1, col: 4 });
            const promotions = options.filter((m) => m.target.row === 0 && m.target.col === 4);
            assert.equal(promotions.length, 4);
            const pieces = promotions.map((m) => m.selectedPiece).sort();
            assert.deepEqual(pieces, [KNIGHT, BISHOP, ROOK, QUEEN].sort());
        });

        for (const [name, selectedPiece] of [
            ["queen", QUEEN],
            ["rook", ROOK],
            ["bishop", BISHOP],
            ["knight", KNIGHT],
        ]) {
            it(`completePromotion replaces the pawn with a ${name}`, () => {
                game.loadGame(emptyBoard([
                    { row: 1, col: 4, color: "white", pieceType: PAWN },
                    { row: 0, col: 0, color: "black", pieceType: KING },
                    { row: 7, col: 4, color: "white", pieceType: KING },
                ]));
                const move = game.makeMove({ row: 1, col: 4 }, { row: 0, col: 4 });
                move.selectedPiece = selectedPiece;
                game.completePromotion(move);
                assert.equal(game.GameState.promoting, false);
                assert.equal(game.GameState.board[0][4].pieceType, selectedPiece);
                assert.equal(game.GameState.board[0][4].color, "white");
                assert.equal(game.Turn, "black");
            });
        }

        it("supports promotion by capture on the last rank (exd8=Q)", () => {
            game.loadGame(emptyBoard([
                { row: 1, col: 4, color: "white", pieceType: PAWN },
                { row: 0, col: 3, color: "black", pieceType: ROOK },
                { row: 0, col: 0, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            const move = game.makeMove({ row: 1, col: 4 }, { row: 0, col: 3 });
            assert.equal(move.promotion, true);
            assert.equal(move.capturedPiece.pieceType, ROOK);
            move.selectedPiece = QUEEN;
            game.completePromotion(move);
            assert.equal(game.GameState.board[0][3].pieceType, QUEEN);
            assert.equal(game.GameState.board[0][3].color, "white");
        });

        it("allows black to promote on rank 1 (row 7)", () => {
            game.loadGame(emptyBoard([
                { row: 6, col: 4, color: "black", pieceType: PAWN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 0, color: "white", pieceType: KING },
            ], { turn: "black" }));
            const move = game.makeMove({ row: 6, col: 4 }, { row: 7, col: 4 });
            assert.equal(move.promotion, true);
            assert.equal(game.GameState.promoting, true);
            assert.equal(game.Turn, "black");
            move.selectedPiece = ROOK;
            game.completePromotion(move);
            assert.equal(game.GameState.board[7][4].pieceType, ROOK);
            assert.equal(game.Turn, "white");
        });
    });

    describe("Pinned pieces (Article 3.7.4 — cannot expose own king)", () => {
        it("rejects moving a rook off the pin line (file pin)", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: QUEEN },
                { row: 6, col: 4, color: "white", pieceType: ROOK },
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 0, col: 0, color: "black", pieceType: KING },
            ]));
            const move = game.validateMove({ row: 6, col: 4 }, { row: 6, col: 3 }, "white");
            assert.equal(move.valid, false, "Re2-d2 exposes the king to the queen on e8");
        });

        it("allows moving a pinned rook along the pin line", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: QUEEN },
                { row: 6, col: 4, color: "white", pieceType: ROOK },
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 0, col: 0, color: "black", pieceType: KING },
            ]));
            const move = game.validateMove({ row: 6, col: 4 }, { row: 2, col: 4 }, "white");
            assert.equal(move.valid, true, "Re2-e6 stays on the e-file and still shields the king");
        });

        it("rejects any knight move when the knight is pinned to the king", () => {
            game.loadGame(emptyBoard([
                { row: 3, col: 0, color: "black", pieceType: BISHOP },
                { row: 6, col: 3, color: "white", pieceType: KNIGHT },
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 0, col: 4, color: "black", pieceType: KING },
            ]));
            const targets = [
                { row: 4, col: 2 }, { row: 4, col: 4 }, { row: 5, col: 1 }, { row: 5, col: 5 },
                { row: 7, col: 1 }, { row: 7, col: 5 },
            ];
            for (const target of targets) {
                const move = game.validateMove({ row: 6, col: 3 }, target, "white");
                assert.equal(move.valid, false, `Nd2 -> ${target.row},${target.col} should be illegal when pinned`);
            }
        });

        it("allows a pinned bishop to move along the pin diagonal", () => {
            game.loadGame(emptyBoard([
                { row: 3, col: 0, color: "black", pieceType: QUEEN },
                { row: 6, col: 3, color: "white", pieceType: BISHOP },
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 0, col: 4, color: "black", pieceType: KING },
            ]));
            assert.equal(
                game.validateMove({ row: 6, col: 3 }, { row: 5, col: 2 }, "white").valid,
                true,
                "Bd2-c3 stays on the a5-e1 diagonal"
            );
        });

        it("rejects moving a pinned bishop off the pin diagonal", () => {
            game.loadGame(emptyBoard([
                { row: 3, col: 0, color: "black", pieceType: QUEEN },
                { row: 6, col: 3, color: "white", pieceType: BISHOP },
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 0, col: 4, color: "black", pieceType: KING },
            ]));
            assert.equal(
                game.validateMove({ row: 6, col: 3 }, { row: 5, col: 4 }, "white").valid,
                false,
                "Bd2-e3 leaves the pin diagonal and exposes the king"
            );
        });

        it("allows capturing the pinning piece when that removes the threat", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "black", pieceType: ROOK },
                { row: 6, col: 4, color: "white", pieceType: ROOK },
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 0, col: 0, color: "black", pieceType: KING },
            ]));
            const move = game.validateMove({ row: 6, col: 4 }, { row: 4, col: 4 }, "white");
            assert.equal(move.valid, true, "Re2xe4 captures the pinning rook");
        });
    });
});

function play(game, source, target) {
    const move = game.validateMove(source, target, game.Turn);
    assert.equal(move.valid, true, move.reason || "move should be valid");
    return game.makeMove(source, target);
}

describe("FIDE rules — Phase 3: special moves edge cases", () => {
    /** @type {ChessGame} */
    let game;

    beforeEach(() => {
        game = new ChessGame(true);
    });

    describe("En passant (Articles 3.7.3 — capture as part of pawn advance)", () => {
        it("can give direct check when the landing square attacks the king", () => {
            game.loadGame(emptyBoard([
                { row: 1, col: 6, color: "black", pieceType: KING },
                { row: 3, col: 5, color: "black", pieceType: PAWN },
                { row: 3, col: 4, color: "white", pieceType: PAWN },
                { row: 7, col: 7, color: "white", pieceType: KING },
            ], {
                turn: "white",
                lastMove: {
                    valid: true,
                    source: { row: 1, col: 5 },
                    target: { row: 3, col: 5 },
                    piece: { color: "black", pieceType: PAWN },
                    promotion: false,
                    ennPassant: false,
                    capturedPiece: null,
                    hitSquare: null,
                    turn: "black",
                    castling: false,
                    whitePlayerView: true,
                },
            }));
            const ep = game.makeMove({ row: 3, col: 4 }, { row: 2, col: 5 });
            assert.equal(ep.ennPassant, true);
            assert.equal(ep.check, true, "exf6 en passant should give check on Kg7");
            assert.equal(game.Check, true);
            assert.equal(game.GameState.board[3][5], null, "Captured pawn removed from f5");
            assert.equal(game.GameState.board[2][5].pieceType, PAWN);
        });

        it("records the captured pawn in capturedPiecesList", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 0, color: "black", pieceType: KING },
                { row: 3, col: 0, color: "black", pieceType: PAWN },
                { row: 3, col: 1, color: "white", pieceType: PAWN },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], {
                turn: "white",
                lastMove: {
                    valid: true,
                    source: { row: 1, col: 0 },
                    target: { row: 3, col: 0 },
                    piece: { color: "black", pieceType: PAWN },
                    promotion: false,
                    ennPassant: false,
                    capturedPiece: null,
                    hitSquare: null,
                    turn: "black",
                    castling: false,
                    whitePlayerView: true,
                },
            }));
            const ep = game.makeMove({ row: 3, col: 1 }, { row: 2, col: 0 });
            assert.equal(ep.ennPassant, true);
            assert.equal(ep.hitSquare.row, 3);
            assert.equal(ep.hitSquare.col, 0);
            assert.equal(game.GameState.board[3][0], null);
            assert.ok(
                game.GameState.capturedPiecesList.some((p) => p.pieceType === PAWN && p.color === "black")
            );
        });

        it("is only available immediately after the opponent's double pawn push", () => {
            game.startNewGame(true);
            play(game, { row: 6, col: 4 }, { row: 4, col: 4 });
            play(game, { row: 1, col: 4 }, { row: 2, col: 4 });
            play(game, { row: 4, col: 4 }, { row: 3, col: 4 });
            play(game, { row: 1, col: 3 }, { row: 3, col: 3 });
            assert.equal(
                game.validateMove({ row: 3, col: 4 }, { row: 2, col: 3 }, "white").valid,
                true,
                "En passant available on the next move"
            );
            play(game, { row: 7, col: 6 }, { row: 5, col: 7 });
            play(game, { row: 0, col: 6 }, { row: 2, col: 7 });
            assert.equal(
                game.validateMove({ row: 3, col: 4 }, { row: 2, col: 3 }, "white").valid,
                false,
                "En passant expires after both sides make other moves"
            );
        });

        it("is not available after the opponent moves a different pawn without double push", () => {
            game.startNewGame(true);
            play(game, { row: 6, col: 4 }, { row: 4, col: 4 });
            play(game, { row: 1, col: 3 }, { row: 2, col: 3 });
            assert.equal(
                game.validateMove({ row: 4, col: 4 }, { row: 3, col: 3 }, "white").valid,
                false,
                "No en passant when black pawn only advanced one square"
            );
        });
    });

    describe("Castling (Article 3.8 — king and rook move together)", () => {
        function castlingSetup(overrides = {}) {
            return emptyBoard([
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 7, col: 7, color: "white", pieceType: ROOK },
                { row: 7, col: 0, color: "white", pieceType: ROOK },
                { row: 0, col: 0, color: "black", pieceType: KING },
                ...(overrides.extraPieces || []),
            ], {
                turn: "white",
                whiteKingMoved: false,
                blackKingMoved: false,
                queensideWhiteRookMoved: false,
                kingsideWhiteRookMoved: false,
                queensideBlackRookMoved: false,
                kingsideBlackRookMoved: false,
                ...overrides,
            });
        }

        it("kingside: king ends on g1 and rook on f1 (O-O)", () => {
            game.loadGame(castlingSetup());
            const move = game.makeMove({ row: 7, col: 4 }, { row: 7, col: 6 });
            assert.equal(move.castling, true);
            assert.equal(move.kingsideCastling, true);
            assert.equal(game.GameState.board[7][6].pieceType, KING);
            assert.equal(game.GameState.board[7][5].pieceType, ROOK);
            assert.equal(game.GameState.board[7][4], null, "e1 vacated");
            assert.equal(game.GameState.board[7][7], null, "h1 vacated");
        });

        it("queenside: king ends on c1 and rook on d1 (O-O-O)", () => {
            game.loadGame(castlingSetup());
            const move = game.makeMove({ row: 7, col: 4 }, { row: 7, col: 2 });
            assert.equal(move.castling, true);
            assert.equal(move.kingsideCastling, false);
            assert.equal(game.GameState.board[7][2].pieceType, KING);
            assert.equal(game.GameState.board[7][3].pieceType, ROOK);
            assert.equal(game.GameState.board[7][4], null, "e1 vacated");
            assert.equal(game.GameState.board[7][0], null, "a1 vacated");
        });

        it("black kingside: king on g8 and rook on f8", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 0, col: 7, color: "black", pieceType: ROOK },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], {
                turn: "black",
                whiteKingMoved: true,
                blackKingMoved: false,
                kingsideBlackRookMoved: false,
            }));
            const move = game.makeMove({ row: 0, col: 4 }, { row: 0, col: 6 });
            assert.equal(move.castling, true);
            assert.equal(game.GameState.board[0][6].pieceType, KING);
            assert.equal(game.GameState.board[0][5].pieceType, ROOK);
            assert.equal(game.GameState.board[0][4], null);
            assert.equal(game.GameState.board[0][7], null);
        });

        it("forfeits castling rights for the king after castling", () => {
            game.loadGame(castlingSetup());
            game.makeMove({ row: 7, col: 4 }, { row: 7, col: 6 });
            assert.equal(game.GameState.whiteKingMoved, true);
            assert.equal(game.Turn, "black");

            const g = new ChessGame(true);
            g.loadGame(castlingSetup({ whiteKingMoved: true }));
            assert.equal(
                g.validateMove({ row: 7, col: 4 }, { row: 7, col: 6 }, "white").valid,
                false,
                "Cannot kingside castle once the king has moved"
            );
        });
    });
});
