/**
 * First king/rook development penalties must affect search scores (not only tie-breaks).
 */
"use strict";

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const brainConfigService = require("../src/modules/game/brainConfigService");
const brain43 = require("../src/brain43");
const brain42 = require("../src/brain42");

function openQueensideRook(game) {
    game.startNewGame(true);
    const st = game.GameState;
    st.board[6][0] = null; // a2
    st.board[7][1] = null; // b1
}

function findQueensideRookMove(H, game) {
    return H.collectLegalMoves(game).find(function (m) {
        return (
            m.piece
            && m.piece.pieceType === game.ROOK
            && m.source.row === 7
            && m.source.col === 0
        );
    });
}

function findQuietPawnMove(H, game) {
    return H.collectLegalMoves(game).find(function (m) {
        return m.piece && m.piece.pieceType === game.PAWN && m.source.col === 4;
    });
}

describe("brain43 first rook/king development in search score", function () {
    const H = brain43.__testHooks;

    it("lowers evaluateSearchMove when firstRookMovePenalty is more negative", function () {
        const cfg = brainConfigService.getDefaultConfig("brain43");
        const game = new ChessGame();
        openQueensideRook(game);
        H.setBrain43SearchContext(cfg, 0);
        const rookMove = findQueensideRookMove(H, game);
        assert.ok(rookMove, "expected a queenside rook move");

        const mild = H.evaluateSearchMove(game, rookMove, 0, -Infinity, Infinity, 1);
        const deltaMild = H.getFirstKingRookMovePenaltyDelta(
            game,
            rookMove,
            cfg.startGame.specialEvaluations,
        );
        assert.ok(deltaMild < 0);

        const harsh = JSON.parse(JSON.stringify(cfg));
        harsh.startGame.specialEvaluations.firstRookMovePenalty = -100;
        harsh.midGame.specialEvaluations.firstRookMovePenalty = -100;
        harsh.endGame.specialEvaluations.firstRookMovePenalty = -100;
        H.setBrain43SearchContext(harsh, 0);
        const harshScore = H.evaluateSearchMove(game, rookMove, 0, -Infinity, Infinity, 1);
        assert.ok(
            harshScore < mild - 50,
            `expected harsh first-rook penalty in search score (mild=${mild}, harsh=${harshScore})`,
        );
    });

    it("does not apply firstRookMovePenalty to a quiet pawn move search score", function () {
        const cfg = brainConfigService.getDefaultConfig("brain43");
        const game = new ChessGame();
        openQueensideRook(game);
        H.setBrain43SearchContext(cfg, 0);
        const pawnMove = findQuietPawnMove(H, game);
        assert.ok(pawnMove);

        const base = H.evaluateSearchMove(game, pawnMove, 0, -Infinity, Infinity, 1);
        const harsh = JSON.parse(JSON.stringify(cfg));
        harsh.startGame.specialEvaluations.firstRookMovePenalty = -100;
        harsh.midGame.specialEvaluations.firstRookMovePenalty = -100;
        harsh.endGame.specialEvaluations.firstRookMovePenalty = -100;
        H.setBrain43SearchContext(harsh, 0);
        const after = H.evaluateSearchMove(game, pawnMove, 0, -Infinity, Infinity, 1);
        assert.strictEqual(after, base);
    });
});

describe("brain42 first rook development in search score", function () {
    const H = brain42.__testHooks;

    it("lowers evaluateSearchMove when firstRookMovePenalty is more negative", function () {
        const cfg = brainConfigService.getDefaultConfig("brain42");
        const game = new ChessGame();
        openQueensideRook(game);
        H.setBrain42SearchContext(cfg, 0);
        const rookMove = findQueensideRookMove(H, game);
        assert.ok(rookMove);
        const mild = H.evaluateSearchMove(game, rookMove, 0, -Infinity, Infinity, 1);
        const harsh = JSON.parse(JSON.stringify(cfg));
        harsh.startGame.specialEvaluations.firstRookMovePenalty = -100;
        harsh.midGame.specialEvaluations.firstRookMovePenalty = -100;
        harsh.endGame.specialEvaluations.firstRookMovePenalty = -100;
        H.setBrain42SearchContext(harsh, 0);
        const harshScore = H.evaluateSearchMove(game, rookMove, 0, -Infinity, Infinity, 1);
        assert.ok(harshScore < mild - 50);
    });
});
