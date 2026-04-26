/**
 * Unit tests for Brain 4.1 doubled-pawn penalty and advanced-pawn bonus helpers.
 * Run: npx mocha ./test/brain41.pawnEval.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const {
    getCurrentPlayerDoubledPawnCount,
    getCurrentPlayerAdvancedPawnCount,
    isAdvancedPawnRankForColor,
    getPawnEvalDelta,
    getFirstKingRookMovePenaltyDelta,
    isCastlingKingMove,
} = require("../src/brain41");
const { getDefaultConfig, sanitizeBrainConfig } = require("../src/modules/game/brainConfigService");

function emptyStateBase(turn) {
    return {
        board: Array.from({ length: 8 }, () => Array(8).fill(null)),
        turn,
        capturedPiecesList: [],
        algebricNotation: "",
        check: false,
        checkmate: false,
        draw: false,
        drawReason: "",
        resigned: "",
        outOfTime: "",
        whiteKingMoved: false,
        blackKingMoved: false,
        farWhiteRookMoved: false,
        farBlackRookMoved: false,
        nearWhiteRookMoved: false,
        nearBlackRookMoved: false,
        whitePlayerView: true,
        fiftyMovesCounter: 0,
        promoting: false,
        queensideWhiteRookMoved: false,
        queensideBlackRookMoved: false,
        kingsideWhiteRookMoved: false,
        kingsideBlackRookMoved: false,
    };
}

function loadPawnBoard(game, turn, placer) {
    const s = emptyStateBase(turn);
    placer(s.board, game);
    game.loadGame(JSON.stringify(s));
}

describe("brain41 isAdvancedPawnRankForColor", () => {
    it("treats rows 1–3 as advanced for white (toward top of board, row 0 = rank 8)", () => {
        assert.strictEqual(isAdvancedPawnRankForColor(0, "white"), false);
        assert.strictEqual(isAdvancedPawnRankForColor(1, "white"), true);
        assert.strictEqual(isAdvancedPawnRankForColor(2, "white"), true);
        assert.strictEqual(isAdvancedPawnRankForColor(3, "white"), true);
        assert.strictEqual(isAdvancedPawnRankForColor(4, "white"), false);
    });
    it("treats rows 4–6 as advanced for black (toward bottom of board)", () => {
        assert.strictEqual(isAdvancedPawnRankForColor(3, "black"), false);
        assert.strictEqual(isAdvancedPawnRankForColor(4, "black"), true);
        assert.strictEqual(isAdvancedPawnRankForColor(5, "black"), true);
        assert.strictEqual(isAdvancedPawnRankForColor(6, "black"), true);
        assert.strictEqual(isAdvancedPawnRankForColor(7, "black"), false);
    });
    it("returns false for unknown color", () => {
        assert.strictEqual(isAdvancedPawnRankForColor(2, "red"), false);
    });
});

describe("brain41 getCurrentPlayerDoubledPawnCount", () => {
    const game = new ChessGame();
    const P = game.PAWN;

    it("returns 0 with no pawns for side to move", () => {
        loadPawnBoard(game, "white", () => {});
        assert.strictEqual(getCurrentPlayerDoubledPawnCount(game), 0);
    });
    it("returns 0 when the side has at most one pawn per file", () => {
        loadPawnBoard(game, "white", (board) => {
            board[6][0] = { color: "white", pieceType: P };
            board[6][1] = { color: "white", pieceType: P };
        });
        assert.strictEqual(getCurrentPlayerDoubledPawnCount(game), 0);
    });
    it("adds the file pawn total when a file has two or more pawns (doubled / stacked)", () => {
        loadPawnBoard(game, "white", (board) => {
            board[6][0] = { color: "white", pieceType: P };
            board[5][0] = { color: "white", pieceType: P };
        });
        assert.strictEqual(getCurrentPlayerDoubledPawnCount(game), 2);
    });
    it("stacks: three pawns on one file contribute 3 to the count", () => {
        loadPawnBoard(game, "white", (board) => {
            board[6][0] = { color: "white", pieceType: P };
            board[5][0] = { color: "white", pieceType: P };
            board[4][0] = { color: "white", pieceType: P };
        });
        assert.strictEqual(getCurrentPlayerDoubledPawnCount(game), 3);
    });
    it("sums across multiple files with pairs", () => {
        loadPawnBoard(game, "white", (board) => {
            board[6][0] = { color: "white", pieceType: P };
            board[5][0] = { color: "white", pieceType: P };
            board[6][1] = { color: "white", pieceType: P };
            board[5][1] = { color: "white", pieceType: P };
        });
        assert.strictEqual(getCurrentPlayerDoubledPawnCount(game), 4);
    });
    it("only counts the side to move; ignores opponent pawns on the same file", () => {
        loadPawnBoard(game, "white", (board) => {
            board[6][0] = { color: "white", pieceType: P };
            board[1][0] = { color: "black", pieceType: P };
            board[2][0] = { color: "black", pieceType: P };
        });
        assert.strictEqual(getCurrentPlayerDoubledPawnCount(game), 0);
    });
});

describe("brain41 getCurrentPlayerAdvancedPawnCount", () => {
    const game = new ChessGame();
    const P = game.PAWN;

    it("counts white pawns on advanced ranks 1–3 for white to move", () => {
        loadPawnBoard(game, "white", (board) => {
            board[2][4] = { color: "white", pieceType: P };
        });
        assert.strictEqual(getCurrentPlayerAdvancedPawnCount(game), 1);
    });
    it("does not count a white home-rank pawn as advanced (e.g. row 6)", () => {
        loadPawnBoard(game, "white", (board) => {
            board[6][4] = { color: "white", pieceType: P };
        });
        assert.strictEqual(getCurrentPlayerAdvancedPawnCount(game), 0);
    });
    it("counts black pawns on advanced ranks 4–6 for black to move", () => {
        loadPawnBoard(game, "black", (board) => {
            board[5][3] = { color: "black", pieceType: P };
        });
        assert.strictEqual(getCurrentPlayerAdvancedPawnCount(game), 1);
    });
});

describe("brain41 getPawnEvalDelta", () => {
    const game = new ChessGame();
    const P = game.PAWN;

    it("applies doublePawnPenalty against doubledPawn count and pawnAdvancedBonus with pawn value", () => {
        loadPawnBoard(game, "white", (board) => {
            board[6][0] = { color: "white", pieceType: P };
            board[5][0] = { color: "white", pieceType: P };
            board[2][1] = { color: "white", pieceType: P };
        });
        const se = { doublePawnPenalty: 0.25, pawnAdvancedBonus: 0.2 };
        // doubled: 2 * 0.25 = 0.5 penalty => -0.5; 1 advanced * 1 * 0.2 = +0.2
        const delta = getPawnEvalDelta(game, se, 1);
        assert.strictEqual(delta, -0.3);
    });
    it("treats missing or non-numeric specialEvaluations as zero for those terms", () => {
        loadPawnBoard(game, "white", (board) => {
            board[2][0] = { color: "white", pieceType: P };
        });
        assert.strictEqual(getPawnEvalDelta(game, {}, 10), 0);
        assert.strictEqual(
            getPawnEvalDelta(game, { doublePawnPenalty: "x", pawnAdvancedBonus: "y" }, 10),
            0
        );
    });
});

describe("brain41 isCastlingKingMove", () => {
    const game = new ChessGame();
    const K = game.KING;

    it("detects a two-step horizontal king move on the same row", () => {
        const m = {
            piece: { color: "white", pieceType: K },
            source: { row: 7, col: 4 },
            target: { row: 7, col: 6 },
        };
        assert.strictEqual(isCastlingKingMove(game, m), true);
    });
    it("is false for one king step", () => {
        const m = {
            piece: { color: "white", pieceType: K },
            source: { row: 7, col: 4 },
            target: { row: 7, col: 5 },
        };
        assert.strictEqual(isCastlingKingMove(game, m), false);
    });
});

describe("brain41 getFirstKingRookMovePenaltyDelta", () => {
    const game = new ChessGame();
    const K = game.KING;
    const R = game.ROOK;
    const se = { firstKingMovePenalty: 0.1, firstRookMovePenalty: 0.1 };

    it("applies a penalty for the first non-castling king move", () => {
        const s = emptyStateBase("white");
        s.whitePlayerView = true;
        s.whiteKingMoved = false;
        game.loadGame(JSON.stringify(s));
        const m = {
            piece: { color: "white", pieceType: K },
            source: { row: 7, col: 4 },
            target: { row: 6, col: 4 },
        };
        assert.strictEqual(getFirstKingRookMovePenaltyDelta(game, m, se), -0.1);
    });
    it("does not penalize the king’s castling jump (two files)", () => {
        const s = emptyStateBase("white");
        s.whitePlayerView = true;
        s.whiteKingMoved = false;
        game.loadGame(JSON.stringify(s));
        const m = {
            piece: { color: "white", pieceType: K },
            source: { row: 7, col: 4 },
            target: { row: 7, col: 6 },
        };
        assert.strictEqual(getFirstKingRookMovePenaltyDelta(game, m, se), 0);
    });
    it("applies a penalty for a rook’s first move from the kingside home file", () => {
        const s = emptyStateBase("white");
        s.whitePlayerView = true;
        s.kingsideWhiteRookMoved = false;
        s.queensideWhiteRookMoved = false;
        game.loadGame(JSON.stringify(s));
        const m = {
            piece: { color: "white", pieceType: R },
            source: { row: 7, col: 7 },
            target: { row: 7, col: 5 },
        };
        assert.strictEqual(getFirstKingRookMovePenaltyDelta(game, m, se), -0.1);
    });
    it("returns 0 when both penalties in config are 0", () => {
        const s = emptyStateBase("white");
        s.whitePlayerView = true;
        s.whiteKingMoved = false;
        game.loadGame(JSON.stringify(s));
        const m = {
            piece: { color: "white", pieceType: K },
            source: { row: 7, col: 4 },
            target: { row: 6, col: 4 },
        };
        assert.strictEqual(getFirstKingRookMovePenaltyDelta(game, m, {}), 0);
    });
    it("uses only firstKingMovePenalty when firstRookMovePenalty is 0", () => {
        const s = emptyStateBase("white");
        s.whitePlayerView = true;
        s.whiteKingMoved = false;
        game.loadGame(JSON.stringify(s));
        const m = {
            piece: { color: "white", pieceType: K },
            source: { row: 7, col: 4 },
            target: { row: 6, col: 4 },
        };
        assert.strictEqual(
            getFirstKingRookMovePenaltyDelta(game, m, { firstKingMovePenalty: 0.15, firstRookMovePenalty: 0 }),
            -0.15
        );
    });
    it("uses only firstRookMovePenalty when firstKingMovePenalty is 0", () => {
        const s = emptyStateBase("white");
        s.whitePlayerView = true;
        s.kingsideWhiteRookMoved = false;
        s.queensideWhiteRookMoved = false;
        game.loadGame(JSON.stringify(s));
        const m = {
            piece: { color: "white", pieceType: R },
            source: { row: 7, col: 0 },
            target: { row: 5, col: 0 },
        };
        assert.strictEqual(
            getFirstKingRookMovePenaltyDelta(game, m, { firstKingMovePenalty: 0, firstRookMovePenalty: 0.12 }),
            -0.12
        );
    });
});

describe("brain41 brainConfigService: firstKingMovePenalty & firstRookMovePenalty", () => {
    it("getDefaultConfig includes 0.1 for both", () => {
        const c = getDefaultConfig("brain41");
        assert.strictEqual(c.specialEvaluations.firstKingMovePenalty, 0.1);
        assert.strictEqual(c.specialEvaluations.firstRookMovePenalty, 0.1);
    });
    it("sanitizeBrainConfig applies numeric overrides for both keys", () => {
        const out = sanitizeBrainConfig("brain41", {
            specialEvaluations: {
                firstKingMovePenalty: 0.05,
                firstRookMovePenalty: 0.2,
            },
        });
        assert.strictEqual(out.specialEvaluations.firstKingMovePenalty, 0.05);
        assert.strictEqual(out.specialEvaluations.firstRookMovePenalty, 0.2);
    });
    it("sanitizeBrainConfig keeps defaults when values are not finite", () => {
        const out = sanitizeBrainConfig("brain41", {
            specialEvaluations: {
                firstKingMovePenalty: "x",
                firstRookMovePenalty: Number.NaN,
            },
        });
        assert.strictEqual(out.specialEvaluations.firstKingMovePenalty, 0.1);
        assert.strictEqual(out.specialEvaluations.firstRookMovePenalty, 0.1);
    });
});
