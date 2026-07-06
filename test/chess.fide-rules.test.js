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

        it("rejects a diagonal pawn move to an empty square when the enemy pawn stepped one square onto the en-passant rank", () => {
            // Regression: a white pawn already on the en-passant rank (e5) with a black pawn one
            // square ahead (f6). Black plays the single step f6-f5, landing beside the white pawn.
            // #validatePawnMove used to accept e5-f6 as en passant (it omitted the double-step
            // check that #ennPassantDone enforces), but the capture was never executed, so the
            // pawn slid diagonally onto an empty square without taking anything — an illegal move.
            game.loadGame(emptyBoard([
                { row: 0, col: 0, color: "black", pieceType: KING },
                { row: 2, col: 5, color: "black", pieceType: PAWN }, // f6
                { row: 3, col: 4, color: "white", pieceType: PAWN }, // e5
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { turn: "black" }));

            play(game, { row: 2, col: 5 }, { row: 3, col: 5 }); // f6-f5 (single step)

            assert.equal(
                game.validateMove({ row: 3, col: 4 }, { row: 2, col: 5 }, "white").valid,
                false,
                "e5-f6 must be illegal: black's f-pawn advanced one square, not two"
            );

            const flat = [];
            for (const group of game.possibleMoves(game.square(3, 4))) {
                if (Array.isArray(group)) flat.push(...group);
                else flat.push(group);
            }
            assert.ok(
                !flat.some((m) => m.target.row === 2 && m.target.col === 5),
                "e5 pawn must not be offered the diagonal f6 square"
            );
            assert.ok(
                flat.some((m) => m.target.row === 2 && m.target.col === 4),
                "e5 pawn should still be able to advance to e6"
            );
        });

        it("still allows a genuine en passant when the capturing pawn is on the en-passant rank", () => {
            // Same geometry as the regression case, but this time black makes the legal double
            // push f7-f5, so white e5xf6 en passant must be legal and must remove the f5 pawn.
            game.loadGame(emptyBoard([
                { row: 0, col: 0, color: "black", pieceType: KING },
                { row: 1, col: 5, color: "black", pieceType: PAWN }, // f7
                { row: 3, col: 4, color: "white", pieceType: PAWN }, // e5
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { turn: "black" }));

            play(game, { row: 1, col: 5 }, { row: 3, col: 5 }); // f7-f5 (double step)

            const ep = game.makeMove({ row: 3, col: 4 }, { row: 2, col: 5 }); // e5 x f6 e.p.
            assert.equal(ep.ennPassant, true, "double push allows en passant");
            assert.equal(game.GameState.board[3][5], null, "captured f5 pawn is removed");
            assert.equal(game.GameState.board[2][5].pieceType, PAWN, "white pawn lands on f6");
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

describe("FIDE rules — Phase 4: check, checkmate & stalemate", () => {
    /** @type {ChessGame} */
    let game;

    beforeEach(() => {
        game = new ChessGame(true);
    });

    /** Count legal moves for every piece of the side to move. */
    function countLegalMoves(g) {
        let total = 0;
        const color = g.Turn;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = g.GameState.board[r][c];
                if (piece && piece.color === color) {
                    total += g.possibleMoves({ row: r, col: c }).length;
                }
            }
        }
        return total;
    }

    /** Assert every legal move belongs to the king. */
    function assertOnlyKingCanMove(g, color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = g.GameState.board[r][c];
                if (!piece || piece.color !== color) {
                    continue;
                }
                const moves = g.possibleMoves({ row: r, col: c });
                if (piece.pieceType === KING) {
                    continue;
                }
                assert.equal(
                    moves.length,
                    0,
                    `Piece at ${r},${c} should have no legal moves in double check`
                );
            }
        }
        const kingPos = findKing(g, color);
        assert.ok(kingPos, "King should exist");
        assert.ok(
            g.possibleMoves(kingPos).length > 0,
            "King should have at least one legal move when not checkmated"
        );
    }

    function findKing(g, color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = g.GameState.board[r][c];
                if (piece && piece.color === color && piece.pieceType === KING) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }

    /** Pre-mate position: Bc4 delivers discovered checkmate (from existing reveal-check test). */
    const discoveredMateSetup = emptyBoard([
        { row: 2, col: 0, color: "white", pieceType: QUEEN },
        { row: 2, col: 1, color: "black", pieceType: KNIGHT },
        { row: 3, col: 2, color: "black", pieceType: PAWN },
        { row: 3, col: 4, color: "white", pieceType: PAWN },
        { row: 3, col: 6, color: "black", pieceType: PAWN },
        { row: 4, col: 1, color: "black", pieceType: KING },
        { row: 4, col: 3, color: "white", pieceType: PAWN },
        { row: 4, col: 4, color: "white", pieceType: KNIGHT },
        { row: 6, col: 0, color: "white", pieceType: PAWN },
        { row: 6, col: 1, color: "white", pieceType: BISHOP },
        { row: 6, col: 4, color: "white", pieceType: BISHOP },
        { row: 6, col: 5, color: "white", pieceType: PAWN },
        { row: 6, col: 6, color: "white", pieceType: PAWN },
        { row: 6, col: 7, color: "white", pieceType: PAWN },
        { row: 7, col: 1, color: "white", pieceType: ROOK },
        { row: 7, col: 4, color: "white", pieceType: KING },
        { row: 7, col: 7, color: "white", pieceType: ROOK },
    ], { turn: "white", blackKingMoved: true });

    function deliverDiscoveredMate(g) {
        g.loadGame(discoveredMateSetup);
        return g.makeMove({ row: 6, col: 1 }, { row: 5, col: 2 });
    }

    describe("Double check (Article 3.9 — only the king may move)", () => {
        it("rejects non-king moves when the king is in double check", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 0, col: 3, color: "white", pieceType: QUEEN },
                { row: 2, col: 2, color: "white", pieceType: BISHOP },
                { row: 2, col: 5, color: "black", pieceType: KNIGHT },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { turn: "black", check: true }));
            assert.equal(game.Check, true);
            assertOnlyKingCanMove(game, "black");
            assert.equal(
                game.validateMove({ row: 2, col: 5 }, { row: 4, col: 4 }, "black").valid,
                false,
                "Knight cannot move out of double check"
            );
        });

        it("allows the king to move to a safe square when doubly checked", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 0, col: 3, color: "white", pieceType: QUEEN },
                { row: 2, col: 2, color: "white", pieceType: BISHOP },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { turn: "black" }));
            game.evaluate();
            const kingPos = findKing(game, "black");
            const kingMoves = game.possibleMoves(kingPos);
            assert.ok(kingMoves.length > 0, "King should have at least one escape from double check");
            assert.ok(
                kingMoves.every((m) => m.piece.pieceType === KING),
                "Every legal move should be a king move"
            );
        });
    });

    describe("Checkmate (Article 5.1.1 — king in check with no legal move)", () => {
        it("detects discovered checkmate after the mating move", () => {
            const move = deliverDiscoveredMate(game);
            assert.equal(move.checkmate, true);
            assert.equal(game.Checkmate, true);
            const result = game.evaluate();
            assert.equal(result.check, true);
            assert.equal(result.checkmate, true);
            assert.equal(countLegalMoves(game), 0);
        });

        it("declares game over and rejects further moves", () => {
            deliverDiscoveredMate(game);
            const move = game.validateMove({ row: 4, col: 1 }, { row: 3, col: 1 }, "black");
            assert.equal(move.valid, false);
            assert.equal(move.reason, game.Reasons.GAME_OVER);
        });
    });

    describe("Stalemate (Article 5.2.2 — not in check, no legal move)", () => {
        it("detects stalemate when the king is not attacked", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 0, color: "black", pieceType: KING },
                { row: 1, col: 2, color: "white", pieceType: QUEEN },
                { row: 3, col: 1, color: "white", pieceType: KING },
            ], { turn: "black" }));
            const result = game.evaluate();
            assert.equal(result.check, false);
            assert.equal(result.checkmate, false);
            assert.equal(result.draw, true);
            assert.equal(result.drawReason, "Stalemate");
            assert.equal(countLegalMoves(game), 0);
        });

        it("does not confuse stalemate with checkmate", () => {
            const stalemate = emptyBoard([
                { row: 0, col: 0, color: "black", pieceType: KING },
                { row: 1, col: 2, color: "white", pieceType: QUEEN },
                { row: 3, col: 1, color: "white", pieceType: KING },
            ], { turn: "black" });

            game.loadGame(stalemate);
            const staleResult = game.evaluate();
            assert.equal(staleResult.draw, true);
            assert.equal(staleResult.checkmate, false);

            deliverDiscoveredMate(game);
            const mateResult = game.evaluate();
            assert.equal(mateResult.checkmate, true);
            assert.equal(mateResult.draw, false);
        });
    });

    describe("evaluate() (recompute game status without playing a move)", () => {
        it("recomputes check when the loaded state flag is stale", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 4, col: 4, color: "white", pieceType: QUEEN },
                { row: 7, col: 0, color: "white", pieceType: KING },
            ], { turn: "black", check: false }));
            const result = game.evaluate();
            assert.equal(result.check, true);
            assert.equal(game.Check, true);
        });

        it("recomputes stalemate when draw flags were not set on load", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 0, color: "black", pieceType: KING },
                { row: 1, col: 2, color: "white", pieceType: QUEEN },
                { row: 3, col: 1, color: "white", pieceType: KING },
            ], { turn: "black", draw: false, check: false }));
            const result = game.evaluate();
            assert.equal(result.draw, true);
            assert.equal(result.drawReason, "Stalemate");
            assert.equal(game.Draw, true);
        });

        it("recomputes checkmate when mate flags were not set on load", () => {
            deliverDiscoveredMate(game);
            game.GameState.checkmate = false;
            game.GameState.check = false;
            const result = game.evaluate();
            assert.equal(result.check, true);
            assert.equal(result.checkmate, true);
            assert.equal(game.Checkmate, true);
        });
    });
});

/** Kings, knights, and queens — enough material to avoid an immediate insufficient-material draw. */
const REPETITION_PIECES = [
    { row: 0, col: 4, color: "black", pieceType: KING },
    { row: 0, col: 6, color: "black", pieceType: KNIGHT },
    { row: 0, col: 3, color: "black", pieceType: QUEEN },
    { row: 7, col: 4, color: "white", pieceType: KING },
    { row: 7, col: 6, color: "white", pieceType: KNIGHT },
    { row: 7, col: 3, color: "white", pieceType: QUEEN },
];

function loadRepetitionStart(game, overrides = {}) {
    game.loadGame(emptyBoard(REPETITION_PIECES, {
        whiteKingMoved: false,
        blackKingMoved: false,
        ...overrides,
    }));
}

function knightCycle(game) {
    play(game, { row: 7, col: 6 }, { row: 5, col: 7 });
    play(game, { row: 0, col: 6 }, { row: 2, col: 5 });
    play(game, { row: 5, col: 7 }, { row: 7, col: 6 });
    play(game, { row: 2, col: 5 }, { row: 0, col: 6 });
}

function kingShuffle(game) {
    play(game, { row: 7, col: 4 }, { row: 6, col: 4 });
    play(game, { row: 0, col: 4 }, { row: 1, col: 4 });
    play(game, { row: 6, col: 4 }, { row: 7, col: 4 });
    play(game, { row: 1, col: 4 }, { row: 0, col: 4 });
}

describe("FIDE rules — Phase 5: draw rule refinements", () => {
    /** @type {ChessGame} */
    let game;

    beforeEach(() => {
        game = new ChessGame(true);
    });

    describe("Fifty-move rule (Article 9.3 — 50 moves without pawn move or capture)", () => {
        it("resets the counter to zero after a pawn move", () => {
            game.loadGame(emptyBoard([
                { row: 5, col: 4, color: "white", pieceType: PAWN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { fiftyMovesCounter: 45, turn: "white" }));
            play(game, { row: 5, col: 4 }, { row: 4, col: 4 });
            assert.equal(game.GameState.fiftyMovesCounter, 0);
            assert.equal(game.Draw, false);
        });

        it("resets the counter to zero after a capture", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: ROOK },
                { row: 4, col: 5, color: "black", pieceType: PAWN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { fiftyMovesCounter: 45, turn: "white" }));
            play(game, { row: 4, col: 4 }, { row: 4, col: 5 });
            assert.equal(game.GameState.fiftyMovesCounter, 0);
            assert.equal(game.Draw, false);
        });

        it("increments the counter on quiet piece moves", () => {
            game.loadGame(emptyBoard([
                { row: 4, col: 4, color: "white", pieceType: KNIGHT },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 0, col: 3, color: "black", pieceType: QUEEN },
                { row: 7, col: 3, color: "white", pieceType: QUEEN },
            ], { fiftyMovesCounter: 10, turn: "white" }));
            play(game, { row: 4, col: 4 }, { row: 2, col: 5 });
            assert.equal(game.GameState.fiftyMovesCounter, 11);
            assert.equal(game.Draw, false);
        });

        it("declares a draw when the counter reaches 50 after a quiet move", () => {
            let drawFired = false;
            game.OnDraw = () => { drawFired = true; };
            game.loadGame(emptyBoard([
                { row: 3, col: 4, color: "white", pieceType: KNIGHT },
                { row: 4, col: 3, color: "black", pieceType: KNIGHT },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { fiftyMovesCounter: 49, turn: "black" }));
            play(game, { row: 4, col: 3 }, { row: 2, col: 4 });
            assert.equal(game.Draw, true);
            assert.equal(game.DrawReason, "50 Moves");
            assert.equal(drawFired, true);
        });
    });

    describe("Insufficient material (Article 5.2.2)", () => {
        it("declares K vs K as insufficient material", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            const result = game.evaluate();
            assert.equal(result.draw, true);
            assert.equal(result.drawReason, "insufficient Materials");
        });

        it("declares K+B vs K+B on same-color squares as insufficient material", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 2, col: 5, color: "black", pieceType: BISHOP },
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 5, col: 2, color: "white", pieceType: BISHOP },
            ]));
            const result = game.evaluate();
            assert.equal(result.draw, true);
            assert.equal(result.drawReason, "insufficient Materials");
        });

        it("does not declare K+B vs K+B on opposite-color squares as insufficient material", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 2, col: 2, color: "black", pieceType: BISHOP },
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 5, col: 2, color: "white", pieceType: BISHOP },
            ]));
            const result = game.evaluate();
            assert.equal(result.draw, false);
        });

        it("declares K+N vs K+N as insufficient material", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 2, col: 7, color: "black", pieceType: KNIGHT },
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 5, col: 0, color: "white", pieceType: KNIGHT },
            ]));
            const result = game.evaluate();
            assert.equal(result.draw, true);
            assert.equal(result.drawReason, "insufficient Materials");
        });

        it("does not declare K+P vs K+P as insufficient material", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 1, col: 4, color: "black", pieceType: PAWN },
                { row: 7, col: 4, color: "white", pieceType: KING },
                { row: 6, col: 4, color: "white", pieceType: PAWN },
            ]));
            const result = game.evaluate();
            assert.equal(result.draw, false);
        });
    });

    describe("Threefold repetition (Article 5.2.2)", () => {
        it("declares a draw after the same position occurs three times", () => {
            let drawFired = false;
            game.OnDraw = () => { drawFired = true; };
            loadRepetitionStart(game);
            knightCycle(game);
            assert.equal(game.Draw, false, "one cycle is only the second occurrence");
            knightCycle(game);
            assert.equal(game.Draw, true);
            assert.equal(game.DrawReason, "Threefold Repetition");
            assert.equal(drawFired, true);
        });

        it("does not count earlier positions with different castling rights toward threefold", () => {
            loadRepetitionStart(game);
            kingShuffle(game);
            assert.equal(game.GameState.whiteKingMoved, true);
            assert.equal(game.GameState.blackKingMoved, true);
            knightCycle(game);
            assert.equal(game.Draw, false, "one cycle after castling rights changed is not yet threefold");
        });
    });
});

function assertGameOverMoveBlocked(game, source, target, color) {
    const move = game.validateMove(source, target, color);
    assert.equal(move.valid, false);
    assert.equal(move.reason, game.Reasons.GAME_OVER);
}

describe("FIDE rules — Phase 6: game termination", () => {
    /** @type {ChessGame} */
    let game;

    beforeEach(() => {
        game = new ChessGame(true);
    });

    describe("Resignation (Article 9.6 — a player may resign)", () => {
        it("normalizes the resigning player name to lowercase", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            game.resign("White");
            assert.equal(game.GameState.resigned, "white");
        });

        it("ends the game with 0-1 when white resigns", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            game.resign("white");
            assert.equal(game.GameOver, true);
            assert.equal(game.ResultMove.moveStr, "0-1");
        });

        it("ends the game with 1-0 when black resigns", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            game.resign("black");
            assert.equal(game.GameOver, true);
            assert.equal(game.ResultMove.moveStr, "1-0");
        });

        it("reports resignation in GameOverReason", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            game.resign("black");
            assert.equal(game.GameOverReason, "black Player Resigned.");
        });

        it("blocks further moves after resignation", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { turn: "white" }));
            game.resign("black");
            assertGameOverMoveBlocked(game, { row: 7, col: 4 }, { row: 6, col: 4 }, "white");
        });
    });

    describe("Timeout (Article 6.9 — loss on time)", () => {
        it("ends the game with 0-1 when white runs out of time", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            game.OutOfTime = "white";
            assert.equal(game.GameOver, true);
            assert.equal(game.ResultMove.moveStr, "0-1");
        });

        it("ends the game with 1-0 when black runs out of time", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            game.OutOfTime = "black";
            assert.equal(game.GameOver, true);
            assert.equal(game.ResultMove.moveStr, "1-0");
        });

        it("blocks further moves after a timeout", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { turn: "white" }));
            game.OutOfTime = "black";
            assertGameOverMoveBlocked(game, { row: 7, col: 4 }, { row: 6, col: 4 }, "white");
        });
    });

    describe("Draw offer accepted (Article 9.6 — agreement to a draw)", () => {
        it("declares a draw with result 1/2-1/2", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            game.drawOfferAccepted("white");
            assert.equal(game.Draw, true);
            assert.equal(game.GameOver, true);
            assert.equal(game.ResultMove.moveStr, "1/2-1/2");
            assert.equal(game.DrawReason, "white player's draw offer accepted");
        });

        it("fires OnDraw with the acceptance reason", () => {
            let drawFired = false;
            let drawReason = "";
            game.OnDraw = (reason) => {
                drawFired = true;
                drawReason = reason;
            };
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ]));
            game.drawOfferAccepted("black");
            assert.equal(drawFired, true);
            assert.equal(drawReason, "black player's draw offer accepted");
        });

        it("blocks further moves after a draw is agreed", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { turn: "white" }));
            game.drawOfferAccepted("white");
            assertGameOverMoveBlocked(game, { row: 7, col: 4 }, { row: 6, col: 4 }, "white");
        });
    });

    describe("Game-over invariants", () => {
        it("returns null ResultMove while the game is in progress", () => {
            game.loadGame(emptyBoard([
                { row: 6, col: 4, color: "white", pieceType: PAWN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { turn: "white" }));
            assert.equal(game.GameOver, false);
            assert.equal(game.ResultMove, null);
        });

        it("rejects moves on a loaded draw position", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 0, color: "black", pieceType: KING },
                { row: 1, col: 2, color: "white", pieceType: QUEEN },
                { row: 3, col: 1, color: "white", pieceType: KING },
            ], { turn: "black", draw: true, drawReason: "Stalemate" }));
            assert.equal(game.GameOver, true);
            assertGameOverMoveBlocked(game, { row: 0, col: 0 }, { row: 0, col: 1 }, "black");
        });

        it("rejects moves on a loaded resignation state", () => {
            game.loadGame(emptyBoard([
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { turn: "white", resigned: "white" }));
            assert.equal(game.GameOver, true);
            assert.equal(game.ResultMove.moveStr, "0-1");
            assertGameOverMoveBlocked(game, { row: 7, col: 4 }, { row: 6, col: 4 }, "white");
        });

        it("undo restores a playable position after resignation without a new snapshot", () => {
            game.loadGame(emptyBoard([
                { row: 6, col: 4, color: "white", pieceType: PAWN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { turn: "white" }));
            play(game, { row: 6, col: 4 }, { row: 4, col: 4 });
            game.resign("white");
            assert.equal(game.GameOver, true);
            game.undo();
            assert.equal(game.GameOver, false);
            assert.equal(game.GameState.resigned, "");
            assert.equal(game.Turn, "white");
            assert.ok(game.GameState.board[6][4], "pawn should be back on e2 after undo");
        });

        it("redo replays a move that was undone", () => {
            game.loadGame(emptyBoard([
                { row: 6, col: 4, color: "white", pieceType: PAWN },
                { row: 0, col: 4, color: "black", pieceType: KING },
                { row: 7, col: 4, color: "white", pieceType: KING },
            ], { turn: "white" }));
            play(game, { row: 6, col: 4 }, { row: 4, col: 4 });
            game.undo();
            assert.equal(game.Turn, "white");
            game.redo();
            assert.equal(game.Turn, "black");
            assert.ok(game.GameState.board[4][4], "pawn should be on e4 after redo");
        });
    });
});
