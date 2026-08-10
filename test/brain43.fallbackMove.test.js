/**
 * Timeout / error fallback and capture ordering must survive ChessGame.undo() replacing GameState.
 */
"use strict";

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const brain43 = require("../src/brain43");
const brain42 = require("../src/brain42");
const brainConfigService = require("../src/modules/game/brainConfigService");

function playSan(game, san, color) {
    const move = game.convertPGNMove({ moveStr: san, color });
    game.makeMove(move.source, move.target);
}

/** 1.e4 e5 2.Nc3 Nf6 3.Nf3 Nc6 4.Bc4 Bb4 5.O-O O-O 6.a3 — Black to move, bishop hanging. */
function loadA3ThreatensBishop(game) {
    game.startNewGame(true);
    const seq = [
        ["e4", "white"],
        ["e5", "black"],
        ["Nc3", "white"],
        ["Nf6", "black"],
        ["Nf3", "white"],
        ["Nc6", "black"],
        ["Bc4", "white"],
        ["Bb4", "black"],
        ["O-O", "white"],
        ["O-O", "black"],
        ["a3", "white"],
    ];
    for (const [san, color] of seq) {
        playSan(game, san, color);
    }
}

function moveLabel(move) {
    return (
        "abcdefgh"[move.source.col]
        + (8 - move.source.row)
        + "abcdefgh"[move.target.col]
        + (8 - move.target.row)
    );
}

describe("brain search timeout fallback move", function () {
    it("brain43 prefers capturing the knight (Bxc3) over board-order Rb8", function () {
        const H = brain43.__testHooks;
        const game = new ChessGame();
        loadA3ThreatensBishop(game);
        H.setBrain43SearchContext(brainConfigService.loadBrainConfig("brain43"), 11);

        const firstScan = H.collectLegalMoves(game)[0];
        assert.strictEqual(moveLabel(firstScan), "a8b8", "precondition: board scan still starts at Rb8");

        const fallback = H.getFirstLegalMove(game);
        assert.ok(fallback);
        assert.strictEqual(
            moveLabel(fallback),
            "b4c3",
            "fallback should take the hanging-resolution capture Bxc3",
        );
    });

    it("brain42 prefers capturing the knight (Bxc3) over board-order Rb8", function () {
        const H = brain42.__testHooks;
        const game = new ChessGame();
        loadA3ThreatensBishop(game);
        H.setBrain42SearchContext(brainConfigService.loadBrainConfig("brain42"), 11);

        assert.strictEqual(moveLabel(H.collectLegalMoves(game)[0]), "a8b8");
        assert.strictEqual(moveLabel(H.getFirstLegalMove(game)), "b4c3");
    });

    it("brain43 orderMovesCapturesFirst ranks Bxc3 ahead of quiet Rb8 despite undo state swaps", function () {
        const H = brain43.__testHooks;
        const game = new ChessGame();
        loadA3ThreatensBishop(game);
        H.setBrain43SearchContext(brainConfigService.loadBrainConfig("brain43"), 11);

        const moves = H.collectLegalMoves(game);
        assert.strictEqual(moveLabel(moves[0]), "a8b8");

        const ordered = H.orderMovesCapturesFirst(game, moves);
        assert.strictEqual(moveLabel(ordered[0]), "b4c3");
    });

    it("brain42 orderMovesCapturesFirst ranks Bxc3 ahead of quiet Rb8", function () {
        const H = brain42.__testHooks;
        const game = new ChessGame();
        loadA3ThreatensBishop(game);
        H.setBrain42SearchContext(brainConfigService.loadBrainConfig("brain42"), 11);

        const ordered = H.orderMovesCapturesFirst(game, H.collectLegalMoves(game));
        assert.strictEqual(moveLabel(ordered[0]), "b4c3");
    });

    it("documents that undo() replaces GameState (stale cache hazard)", function () {
        const H = brain43.__testHooks;
        const game = new ChessGame();
        loadA3ThreatensBishop(game);
        const moves = H.collectLegalMoves(game);
        const a8b8 = moves.find((m) => moveLabel(m) === "a8b8");
        assert.ok(a8b8);

        const cached = game.GameState;
        H.withAppliedMove(game, a8b8, () => game.Check);

        assert.notStrictEqual(
            cached,
            game.GameState,
            "undo replaces #state — callers must not cache GameState across withAppliedMove",
        );
        // Stale mid-move board still shows the rook on b8 after undo restored live state.
        assert.ok(
            cached.board[0][1] && cached.board[0][1].pieceType === game.ROOK,
            "cached snapshot still looks mid-move (rook on b8)",
        );
        assert.strictEqual(
            game.GameState.board[0][1],
            null,
            "live board after undo has empty b8",
        );
    });

    it("stale GameState cache would mis-rank Nc6-b8 as capturing own rook", function () {
        const H = brain43.__testHooks;
        const game = new ChessGame();
        loadA3ThreatensBishop(game);
        H.setBrain43SearchContext(brainConfigService.loadBrainConfig("brain43"), 11);
        const moves = H.collectLegalMoves(game);
        const turn = game.Turn;

        // Reproduce the old bug: cache state once, then withAppliedMove each move.
        const staleState = game.GameState;
        let staleBest = moves[0];
        let staleBestScore = -Infinity;
        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            const capture = staleState.board[move.target.row]?.[move.target.col];
            const captureValue = capture ? 1 : 0;
            H.withAppliedMove(game, move, () => game.Check);
            const score = captureValue * 1e6;
            if (score > staleBestScore) {
                staleBestScore = score;
                staleBest = move;
            }
        }
        assert.strictEqual(
            moveLabel(staleBest),
            "c6b8",
            "precondition: stale cache falsely treats Nb8 as a capture",
        );

        // Live implementation must not make that mistake.
        assert.strictEqual(moveLabel(H.getFirstLegalMove(game)), "b4c3");
        assert.strictEqual(turn, game.Turn);
    });
});
