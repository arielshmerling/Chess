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
    getCurrentPlayerPawnChainCount,
    getPawnChainCountEvalDelta,
    isAdvancedPawnRankForColor,
    getPawnEvalDelta,
    getFirstKingRookMovePenaltyDelta,
    isCastlingKingMove,
    getTotalMaterialValueForColor,
    getDrawLeafScoreForMover,
    getBestOpenRookSeventhBonusDelta,
    getVeryGoodOpenFileRookBonusDelta,
    getPoorClosedFileRookPenaltyDelta,
    isBoardFileFullyOpen,
    isBoardFileClosedForRook,
    isRookOnInvadingSeventhRowForColor,
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

/** White pawns on row 6, black on row 1, at given file indices (0 = a, …, 4 = e). */
function loadPawnFiles(game, color, fileIndices) {
    const s = emptyStateBase(color);
    const P = 0;
    const row = color === "white" ? 6 : 1;
    for (const col of fileIndices) {
        s.board[row][col] = { color, pieceType: P };
    }
    game.loadGame(JSON.stringify(s));
}

function loadPawnSquares(game, color, squares) {
    const s = emptyStateBase(color);
    const P = 0;
    for (const sq of squares) {
        s.board[sq.row][sq.col] = { color, pieceType: P };
    }
    game.loadGame(JSON.stringify(s));
}

/** Minimal K vs K (or with extra pawns) for material tests. KING=1, PAWN=0. */
function loadKingsWithPawnExtras(game, whitePawnSquares, blackPawnSquares) {
    const s = emptyStateBase("white");
    const K = 1;
    const P = 0;
    s.board[7][4] = { color: "white", pieceType: K };
    s.board[0][4] = { color: "black", pieceType: K };
    for (const sq of whitePawnSquares) {
        s.board[sq.row][sq.col] = { color: "white", pieceType: P };
    }
    for (const sq of blackPawnSquares) {
        s.board[sq.row][sq.col] = { color: "black", pieceType: P };
    }
    game.loadGame(JSON.stringify(s));
}

describe("brain41 getCurrentPlayerPawnChainCount (adjacent-file pawn chains)", () => {
    const game = new ChessGame();

    it("returns 0 when the side to move has no pawns", () => {
        loadPawnBoard(game, "white", () => {});
        assert.strictEqual(getCurrentPlayerPawnChainCount(game), 0);
    });
    it("treats a full home rank as one chain (files a–h are all adjacent)", () => {
        loadPawnFiles(game, "white", [0, 1, 2, 3, 4, 5, 6, 7]);
        assert.strictEqual(getCurrentPlayerPawnChainCount(game), 1);
    });
    it("merges pawns on adjacent files regardless of rank (c3, d6, e5, f2 style)", () => {
        loadPawnSquares(game, "white", [
            { row: 5, col: 2 },
            { row: 2, col: 3 },
            { row: 3, col: 4 },
            { row: 6, col: 5 },
        ]);
        assert.strictEqual(getCurrentPlayerPawnChainCount(game), 1);
    });
    it("joins pawns on neighboring files even when not diagonally adjacent", () => {
        loadPawnSquares(game, "white", [
            { row: 5, col: 0 },
            { row: 6, col: 1 },
        ]);
        assert.strictEqual(getCurrentPlayerPawnChainCount(game), 1);
    });
    it("counts doubled pawns on one file as part of the same file chain as the neighbor file", () => {
        const s = emptyStateBase("white");
        const P = 0;
        s.board[6][0] = { color: "white", pieceType: P };
        s.board[5][0] = { color: "white", pieceType: P };
        s.board[6][1] = { color: "white", pieceType: P };
        game.loadGame(JSON.stringify(s));
        assert.strictEqual(getCurrentPlayerPawnChainCount(game), 1);
    });
    it("splits when files are not adjacent (b2, d2, e5, f5 style => 2 chains)", () => {
        loadPawnSquares(game, "white", [
            { row: 6, col: 1 },
            { row: 6, col: 3 },
            { row: 3, col: 4 },
            { row: 3, col: 5 },
        ]);
        assert.strictEqual(getCurrentPlayerPawnChainCount(game), 2);
    });
    it("returns 3 for three separate file groups with gaps between them", () => {
        loadPawnSquares(game, "white", [
            { row: 6, col: 0 },
            { row: 5, col: 1 },
            { row: 6, col: 3 },
            { row: 5, col: 4 },
            { row: 6, col: 7 },
        ]);
        assert.strictEqual(getCurrentPlayerPawnChainCount(game), 3);
    });
    it("counts for the side to move (black) with the same file-adjacency rule", () => {
        loadPawnSquares(game, "black", [
            { row: 1, col: 0 },
            { row: 2, col: 1 },
        ]);
        assert.strictEqual(getCurrentPlayerPawnChainCount(game), 1);
    });
});

describe("brain41 getPawnChainCountEvalDelta", () => {
    const game = new ChessGame();
    const se = { pawnsChainCountPenalty: -0.1 };

    it("is 0 for a single diagonal chain, no pawns, or a lone pawn", () => {
        loadPawnSquares(game, "white", [
            { row: 3, col: 0 },
            { row: 4, col: 1 },
            { row: 5, col: 2 },
            { row: 6, col: 3 },
        ]);
        assert.strictEqual(getPawnChainCountEvalDelta(game, se), 0);
        loadPawnBoard(game, "white", () => {});
        assert.strictEqual(getPawnChainCountEvalDelta(game, se), 0);
        loadPawnSquares(game, "white", [{ row: 6, col: 0 }]);
        assert.strictEqual(getPawnChainCountEvalDelta(game, se), 0);
    });
    it("has no penalty for a single file chain on the home rank", () => {
        loadPawnFiles(game, "white", [0, 1, 2, 3, 4, 5, 6, 7]);
        assert.strictEqual(getCurrentPlayerPawnChainCount(game), 1);
        assert.strictEqual(getPawnChainCountEvalDelta(game, se), 0);
    });
    it("penalizes (chainCount - 1) * pawnsChainCountPenalty for b2/d2/e5/f5 style (2 chains)", () => {
        loadPawnSquares(game, "white", [
            { row: 6, col: 1 },
            { row: 6, col: 3 },
            { row: 3, col: 4 },
            { row: 3, col: 5 },
        ]);
        assert.strictEqual(getCurrentPlayerPawnChainCount(game), 2);
        assert.strictEqual(getPawnChainCountEvalDelta(game, se), -0.1);
    });
    it("subtracts (chainCount - 1) * pawnsChainCountPenalty for multiple file groups", () => {
        loadPawnSquares(game, "white", [
            { row: 6, col: 0 },
            { row: 5, col: 1 },
            { row: 6, col: 3 },
            { row: 5, col: 4 },
            { row: 6, col: 7 },
        ]);
        assert.strictEqual(getCurrentPlayerPawnChainCount(game), 3);
        assert.strictEqual(getPawnChainCountEvalDelta(game, se), -0.2);
    });
    it("returns 0 when the config coefficient is 0 or missing", () => {
        loadPawnSquares(game, "white", [
            { row: 6, col: 0 },
            { row: 5, col: 1 },
            { row: 6, col: 3 },
        ]);
        assert.strictEqual(getPawnChainCountEvalDelta(game, { pawnsChainCountPenalty: 0 }), 0);
        assert.strictEqual(getPawnChainCountEvalDelta(game, {}), 0);
    });
});

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
        const se = { doublePawnPenalty: -0.25, pawnAdvancedBonus: 0.2 };
        // doubled: 2 * -0.25 = -0.5; 1 advanced * 1 * 0.2 = +0.2
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
    const se = { firstKingMovePenalty: -0.1, firstRookMovePenalty: -0.1 };

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
            getFirstKingRookMovePenaltyDelta(game, m, { firstKingMovePenalty: -0.15, firstRookMovePenalty: 0 }),
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
            getFirstKingRookMovePenaltyDelta(game, m, { firstKingMovePenalty: 0, firstRookMovePenalty: -0.12 }),
            -0.12
        );
    });
});

describe("brain41 brainConfigService: firstKingMovePenalty & firstRookMovePenalty", () => {
    it("getDefaultConfig includes -0.1 for both (signed penalties)", () => {
        const c = getDefaultConfig("brain41");
        assert.strictEqual(c.specialEvaluations.firstKingMovePenalty, -0.1);
        assert.strictEqual(c.specialEvaluations.firstRookMovePenalty, -0.1);
        assert.strictEqual(c.specialEvaluations.pawnsChainCountPenalty, -0.1);
        assert.strictEqual(c.specialEvaluations.bestOpenRookOnSeventhMultiplier, 1.25);
        assert.strictEqual(c.specialEvaluations.veryGoodOpenRookMultiplier, 1.125);
        assert.strictEqual(c.specialEvaluations.poorClosedFileRookMultiplier, 0.75);
    });
    it("sanitizeBrainConfig applies signed overrides for both keys", () => {
        const out = sanitizeBrainConfig("brain41", {
            specialEvaluations: {
                firstKingMovePenalty: -0.05,
                firstRookMovePenalty: -0.2,
            },
        });
        assert.strictEqual(out.specialEvaluations.firstKingMovePenalty, -0.05);
        assert.strictEqual(out.specialEvaluations.firstRookMovePenalty, -0.2);
    });
    it("sanitizeBrainConfig migrates legacy positive penalty magnitudes to negative", () => {
        const out = sanitizeBrainConfig("brain41", {
            specialEvaluations: {
                firstKingMovePenalty: 0.05,
                firstRookMovePenalty: 0.2,
                doublePawnPenalty: 0.25,
            },
        });
        assert.strictEqual(out.specialEvaluations.firstKingMovePenalty, -0.05);
        assert.strictEqual(out.specialEvaluations.firstRookMovePenalty, -0.2);
        assert.strictEqual(out.specialEvaluations.doublePawnPenalty, -0.25);
    });
    it("sanitizeBrainConfig keeps defaults when values are not finite", () => {
        const out = sanitizeBrainConfig("brain41", {
            specialEvaluations: {
                firstKingMovePenalty: "x",
                firstRookMovePenalty: Number.NaN,
            },
        });
        assert.strictEqual(out.specialEvaluations.firstKingMovePenalty, -0.1);
        assert.strictEqual(out.specialEvaluations.firstRookMovePenalty, -0.1);
    });
    it("sanitizeBrainConfig can override pawnsChainCountPenalty", () => {
        const out = sanitizeBrainConfig("brain41", {
            specialEvaluations: { pawnsChainCountPenalty: -0.05 },
        });
        assert.strictEqual(out.specialEvaluations.pawnsChainCountPenalty, -0.05);
    });
    it("sanitizeBrainConfig can override bestOpenRookOnSeventhMultiplier", () => {
        const out = sanitizeBrainConfig("brain41", {
            specialEvaluations: { bestOpenRookOnSeventhMultiplier: 1.5 },
        });
        assert.strictEqual(out.specialEvaluations.bestOpenRookOnSeventhMultiplier, 1.5);
    });
    it("sanitizeBrainConfig can override veryGoodOpenRookMultiplier", () => {
        const out = sanitizeBrainConfig("brain41", {
            specialEvaluations: { veryGoodOpenRookMultiplier: 1.2 },
        });
        assert.strictEqual(out.specialEvaluations.veryGoodOpenRookMultiplier, 1.2);
    });
    it("sanitizeBrainConfig can override poorClosedFileRookMultiplier", () => {
        const out = sanitizeBrainConfig("brain41", {
            specialEvaluations: { poorClosedFileRookMultiplier: 0.5 },
        });
        assert.strictEqual(out.specialEvaluations.poorClosedFileRookMultiplier, 0.5);
    });
});

describe("brain41 best rook (open file, seventh rank / second rank penetration)", () => {
    const game = new ChessGame();
    const se = () => sanitizeBrainConfig("brain41", {}).specialEvaluations;

    it("indexes seventh rank consistently with pawn-advanced helpers", () => {
        assert.strictEqual(isRookOnInvadingSeventhRowForColor(1, "white"), true);
        assert.strictEqual(isRookOnInvadingSeventhRowForColor(2, "white"), false);
        assert.strictEqual(isRookOnInvadingSeventhRowForColor(6, "black"), true);
        assert.strictEqual(isRookOnInvadingSeventhRowForColor(5, "black"), false);
    });

    it("detects fully open files (no pawns)", () => {
        const sOpen = emptyStateBase("white");
        sOpen.board[7][4] = { color: "white", pieceType: game.KING };
        sOpen.board[0][7] = { color: "black", pieceType: game.KING };
        game.loadGame(JSON.stringify(sOpen));
        assert.strictEqual(isBoardFileFullyOpen(game, 3), true);
        const sBlocked = emptyStateBase("white");
        sBlocked.board[7][4] = { color: "white", pieceType: game.KING };
        sBlocked.board[0][7] = { color: "black", pieceType: game.KING };
        sBlocked.board[2][3] = { color: "white", pieceType: game.PAWN };
        game.loadGame(JSON.stringify(sBlocked));
        assert.strictEqual(isBoardFileFullyOpen(game, 3), false);
    });

    it("bonus (1.25×) for friendly rook on invasion rank when file has no pawn", () => {
        const s = emptyStateBase("white");
        const K = game.KING;
        const R = game.ROOK;
        s.board[7][0] = { color: "white", pieceType: K };
        s.board[0][7] = { color: "black", pieceType: K };
        s.board[1][3] = { color: "white", pieceType: R };
        game.loadGame(JSON.stringify(s));
        assert.strictEqual(getBestOpenRookSeventhBonusDelta(game, se()), 5 * 0.25);
    });

    it("no bonus when a pawn occupies the rook's file somewhere", () => {
        const s = emptyStateBase("white");
        const K = game.KING;
        const R = game.ROOK;
        const P = game.PAWN;
        s.board[7][0] = { color: "white", pieceType: K };
        s.board[0][7] = { color: "black", pieceType: K };
        s.board[1][3] = { color: "white", pieceType: R };
        s.board[6][3] = { color: "white", pieceType: P };
        game.loadGame(JSON.stringify(s));
        assert.strictEqual(getBestOpenRookSeventhBonusDelta(game, se()), 0);
    });

    it("no bonus for multiplier 1", () => {
        const s = emptyStateBase("white");
        s.board[7][0] = { color: "white", pieceType: game.KING };
        s.board[0][7] = { color: "black", pieceType: game.KING };
        s.board[1][3] = { color: "white", pieceType: game.ROOK };
        game.loadGame(JSON.stringify(s));
        assert.strictEqual(getBestOpenRookSeventhBonusDelta(game, { bestOpenRookOnSeventhMultiplier: 1 }), 0);
    });

    it("black to move: rook on row 6 open file", () => {
        const s = emptyStateBase("black");
        const K = game.KING;
        const R = game.ROOK;
        s.board[7][0] = { color: "white", pieceType: K };
        s.board[0][7] = { color: "black", pieceType: K };
        s.board[6][2] = { color: "black", pieceType: R };
        game.loadGame(JSON.stringify(s));
        assert.strictEqual(getBestOpenRookSeventhBonusDelta(game, se()), 5 * 0.25);
    });
});

describe("brain41 very good rook (open file, any rank)", () => {
    const game = new ChessGame();
    const se = () => sanitizeBrainConfig("brain41", {}).specialEvaluations;

    it("bonus 112.5% for rook on open file (e.g. white back rank)", () => {
        const s = emptyStateBase("white");
        const K = game.KING;
        const R = game.ROOK;
        s.board[7][0] = { color: "white", pieceType: K };
        s.board[0][7] = { color: "black", pieceType: K };
        s.board[7][3] = { color: "white", pieceType: R };
        game.loadGame(JSON.stringify(s));
        assert.strictEqual(getVeryGoodOpenFileRookBonusDelta(game, se()), 5 * 0.125);
    });

    it("no bonus when file has a pawn", () => {
        const s = emptyStateBase("white");
        const K = game.KING;
        const R = game.ROOK;
        const P = game.PAWN;
        s.board[7][0] = { color: "white", pieceType: K };
        s.board[0][7] = { color: "black", pieceType: K };
        s.board[7][3] = { color: "white", pieceType: R };
        s.board[1][3] = { color: "black", pieceType: P };
        game.loadGame(JSON.stringify(s));
        assert.strictEqual(getVeryGoodOpenFileRookBonusDelta(game, se()), 0);
    });

    it("stacks with best-rook bonus on seventh rank open file", () => {
        const s = emptyStateBase("white");
        const K = game.KING;
        const R = game.ROOK;
        s.board[7][0] = { color: "white", pieceType: K };
        s.board[0][7] = { color: "black", pieceType: K };
        s.board[1][3] = { color: "white", pieceType: R };
        game.loadGame(JSON.stringify(s));
        const spec = se();
        assert.strictEqual(
            getBestOpenRookSeventhBonusDelta(game, spec) + getVeryGoodOpenFileRookBonusDelta(game, spec),
            5 * 0.25 + 5 * 0.125
        );
    });
});

describe("brain41 poor rook (closed file)", () => {
    const game = new ChessGame();
    const se = () => sanitizeBrainConfig("brain41", {}).specialEvaluations;

    it("closed file ≡ not fully open", () => {
        const sOpen = emptyStateBase("white");
        sOpen.board[7][4] = { color: "white", pieceType: game.KING };
        sOpen.board[0][7] = { color: "black", pieceType: game.KING };
        game.loadGame(JSON.stringify(sOpen));
        assert.strictEqual(isBoardFileClosedForRook(game, 3), false);
        const sClosed = emptyStateBase("white");
        sClosed.board[7][4] = { color: "white", pieceType: game.KING };
        sClosed.board[0][7] = { color: "black", pieceType: game.KING };
        sClosed.board[6][3] = { color: "white", pieceType: game.PAWN };
        game.loadGame(JSON.stringify(sClosed));
        assert.strictEqual(isBoardFileClosedForRook(game, 3), true);
    });

    it("penalty 75% for rook when file has a pawn somewhere", () => {
        const s = emptyStateBase("white");
        const K = game.KING;
        const R = game.ROOK;
        const P = game.PAWN;
        s.board[7][0] = { color: "white", pieceType: K };
        s.board[0][7] = { color: "black", pieceType: K };
        s.board[7][3] = { color: "white", pieceType: R };
        s.board[1][3] = { color: "black", pieceType: P };
        game.loadGame(JSON.stringify(s));
        assert.strictEqual(getPoorClosedFileRookPenaltyDelta(game, se()), -5 * 0.25);
    });

    it("no poor-rook adjustment on fully open file", () => {
        const s = emptyStateBase("white");
        s.board[7][0] = { color: "white", pieceType: game.KING };
        s.board[0][7] = { color: "black", pieceType: game.KING };
        s.board[7][3] = { color: "white", pieceType: game.ROOK };
        game.loadGame(JSON.stringify(s));
        assert.strictEqual(getPoorClosedFileRookPenaltyDelta(game, se()), 0);
        assert.strictEqual(getVeryGoodOpenFileRookBonusDelta(game, se()), 5 * 0.125);
    });

    it("no penalty when multiplier is 1", () => {
        const s = emptyStateBase("white");
        s.board[7][0] = { color: "white", pieceType: game.KING };
        s.board[0][7] = { color: "black", pieceType: game.KING };
        s.board[7][3] = { color: "white", pieceType: game.ROOK };
        s.board[1][3] = { color: "black", pieceType: game.PAWN };
        game.loadGame(JSON.stringify(s));
        assert.strictEqual(getPoorClosedFileRookPenaltyDelta(game, { poorClosedFileRookMultiplier: 1 }), 0);
    });
});

describe("brain41 draw leaf score (material-based)", () => {
    const game = new ChessGame();
    const se = getDefaultConfig("brain41").specialEvaluations;

    it("getTotalMaterialValueForColor sums piece values for that side", () => {
        loadKingsWithPawnExtras(game, [{ row: 6, col: 0 }], [{ row: 1, col: 0 }]);
        const w = getTotalMaterialValueForColor(game, "white");
        const b = getTotalMaterialValueForColor(game, "black");
        assert.ok(w > 0 && b > 0);
        assert.ok(Math.abs(w - b) < 0.001, "K+p vs K+p symmetric");
    });
    it("draw when materially even (|diff| < 3) uses drawScoreWhenEven", () => {
        loadKingsWithPawnExtras(
            game,
            [{ row: 6, col: 0 }, { row: 6, col: 1 }],
            [{ row: 1, col: 0 }, { row: 1, col: 1 }]
        );
        assert.strictEqual(getDrawLeafScoreForMover(game, "white", se), se.drawScoreWhenEven);
    });
    it("draw when ahead by material >= 3 uses drawScoreWhenAhead (default -5)", () => {
        loadKingsWithPawnExtras(
            game,
            [{ row: 6, col: 0 }, { row: 6, col: 1 }, { row: 6, col: 2 }],
            []
        );
        assert.strictEqual(getDrawLeafScoreForMover(game, "white", se), -5);
    });
    it("draw when behind by material >= 3 uses drawScoreWhenBehind (default +5)", () => {
        loadKingsWithPawnExtras(
            game,
            [],
            [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }]
        );
        assert.strictEqual(getDrawLeafScoreForMover(game, "white", se), 5);
    });
});
