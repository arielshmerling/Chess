/**
 * Engine FEN / UCI codec tests.
 */
"use strict";

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const {
    gameStateToFen,
    squareToAlgebraic,
    algebraicToSquare,
    moveToUci,
    uciToMove,
} = require("../src/engines/fenCodec");

describe("engines fenCodec", function () {
    it("maps start position (whitePlayerView) to standard FEN", function () {
        const game = new ChessGame(true);
        game.startNewGame(true);
        const fen = gameStateToFen(game.GameState);
        assert.strictEqual(
            fen,
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        );
    });

    it("maps squares consistently for whitePlayerView", function () {
        const state = { whitePlayerView: true };
        assert.strictEqual(squareToAlgebraic(state, { row: 6, col: 4 }), "e2");
        assert.deepStrictEqual(algebraicToSquare(state, "e2"), { row: 6, col: 4 });
    });

    it("maps squares consistently for black orientation", function () {
        const state = { whitePlayerView: false };
        assert.strictEqual(squareToAlgebraic(state, { row: 1, col: 3 }), "e2");
        assert.deepStrictEqual(algebraicToSquare(state, "e2"), { row: 1, col: 3 });
    });

    it("round-trips UCI moves including promotion", function () {
        const state = { whitePlayerView: true };
        const move = {
            source: { row: 1, col: 0 },
            target: { row: 0, col: 0 },
            selectedPiece: 5,
        };
        assert.strictEqual(moveToUci(state, move), "a7a8q");
        const parsed = uciToMove(state, "a7a8q");
        assert.deepStrictEqual(parsed.source, move.source);
        assert.deepStrictEqual(parsed.target, move.target);
        assert.strictEqual(parsed.selectedPiece, 5);
    });

    it("emits en passant target after double pawn push", function () {
        const game = new ChessGame(true);
        game.startNewGame(true);
        const result = game.makeMove({ row: 6, col: 4 }, { row: 4, col: 4 });
        assert.ok(result && result.valid !== false);
        const fen = gameStateToFen(game.GameState);
        assert.ok(fen.includes(" e3 "), `expected ep e3 in ${fen}`);
    });
});
