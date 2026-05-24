/**
 * Brain 4.2 game-phase detection.
 * Run: npx mocha ./test/brain42.gamePhase.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const {
    detectBrain42Phase,
    countPiecesForColor,
    resolveBrain42ActivePhaseSettings,
} = require("../src/brain42");
const { getDefaultConfig } = require("../src/modules/game/brainConfigService");

function emptyStateBase(turn) {
    const board = {};
    for (let row = 0; row < 8; row++) {
        board[row] = Array(8).fill(null);
    }
    return {
        board,
        turn,
        whitePlayerView: true,
        capturedPiecesList: [],
        promoting: false,
    };
}

/** White to move; black has king plus optional extra pieces (for endgame phase tests). */
function loadSparseBlackArmy(game, blackExtras) {
    const s = emptyStateBase("white");
    const K = 1;
    s.board[7][4] = { color: "white", pieceType: K };
    s.board[0][4] = { color: "black", pieceType: K };
    for (const sq of blackExtras) {
        s.board[sq.row][sq.col] = { color: "black", pieceType: sq.pieceType };
    }
    game.loadGame(JSON.stringify(s));
}

describe("Brain 4.2 game phase", () => {
    const fullConfig = getDefaultConfig("brain42");

    it("startGame at move zero with full material", () => {
        const game = new ChessGame(true);
        assert.strictEqual(detectBrain42Phase(fullConfig, game, 0), "startGame");
    });

    it("midGame after configured full-move threshold", () => {
        const game = new ChessGame(true);
        const after = fullConfig.gamePhase.midGameAfterMoves;
        assert.strictEqual(detectBrain42Phase(fullConfig, game, after * 2), "midGame");
        assert.strictEqual(detectBrain42Phase(fullConfig, game, after * 2 - 1), "startGame");
    });

    it("endGame when opponent has at most configured piece count", () => {
        const game = new ChessGame(true);
        loadSparseBlackArmy(game, [
            { row: 1, col: 0, pieceType: 0 },
            { row: 1, col: 1, pieceType: 0 },
        ]);
        const blackPieces = countPiecesForColor(game, "black");
        assert.ok(blackPieces <= fullConfig.gamePhase.endGameOpponentMaxPieces);
        assert.strictEqual(detectBrain42Phase(fullConfig, game, 0), "endGame");
    });

    it("endGame takes priority over midGame by move count", () => {
        const game = new ChessGame(true);
        loadSparseBlackArmy(game, [{ row: 1, col: 0, pieceType: 0 }]);
        const manyPlies = fullConfig.gamePhase.midGameAfterMoves * 2 + 10;
        assert.strictEqual(detectBrain42Phase(fullConfig, game, manyPlies), "endGame");
    });

    it("resolveBrain42ActivePhaseSettings returns phase piece scores", () => {
        const game = new ChessGame(true);
        const resolved = resolveBrain42ActivePhaseSettings(fullConfig, game, 0);
        assert.strictEqual(resolved.phase, "startGame");
        assert.strictEqual(resolved.pieceScores.king, fullConfig.startGame.pieceScores.king);
    });
});
