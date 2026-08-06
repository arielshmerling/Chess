/**
 * Forced mate detection for immediate resign.
 * Run: npx mocha ./test/forcedMateDetection.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const {
    detectForcedLossMate,
    opponentDeliversImmediateMate,
    shouldRunForcedMateDetection,
} = require("../src/desktop/forcedMateDetection");
const {
    detectForcedLossMateAsync,
    abortForcedMateDetection,
} = require("../src/desktop/forcedMateDetectionAsync");

function baseState(overrides) {
    return {
        board: Array.from({ length: 8 }, () => Array(8).fill(null)),
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
        gameOver: false,
        promoting: false,
        kingsideWhiteRookMoved: true,
        queensideWhiteRookMoved: true,
        kingsideBlackRookMoved: true,
        queensideBlackRookMoved: true,
        ...overrides,
    };
}

function loadState(state) {
    const game = new ChessGame(true);
    game.loadGame(JSON.stringify(state));
    return game;
}

/** White to move: Qh2# on Kh1. */
const IMMEDIATE_MATE_WHITE = baseState({
    turn: "white",
    board: (() => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        board[7][7] = { color: "black", pieceType: 1 };
        board[6][6] = { color: "white", pieceType: 5 };
        board[4][4] = { color: "white", pieceType: 1 };
        return board;
    })(),
});

/** Black can capture the queen and avoid immediate mate. */
const ESCAPE_AVAILABLE = baseState({
    turn: "black",
    board: (() => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        board[1][6] = { color: "black", pieceType: 1 };
        board[6][6] = { color: "white", pieceType: 1 };
        board[2][5] = { color: "white", pieceType: 5 };
        board[2][4] = { color: "black", pieceType: 5 };
        return board;
    })(),
});

/** Lone kings — no forced mate. */
const KING_VS_KING = baseState({
    turn: "black",
    board: (() => {
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        board[0][4] = { color: "black", pieceType: 1 };
        board[7][4] = { color: "white", pieceType: 1 };
        return board;
    })(),
});

describe("forcedMateDetection", () => {
    afterEach(() => {
        abortForcedMateDetection();
    });

    it("detects immediate mate when opponent can deliver checkmate", () => {
        const game = loadState(IMMEDIATE_MATE_WHITE);
        assert.strictEqual(opponentDeliversImmediateMate(game, "black"), true);
    });

    it("does not detect when at least one move avoids forced mate", () => {
        const game = loadState(ESCAPE_AVAILABLE);
        const result = detectForcedLossMate(game);
        assert.strictEqual(result.detected, false);
    });

    it("does not detect drawn king vs king", () => {
        const game = loadState(KING_VS_KING);
        const result = detectForcedLossMate(game);
        assert.strictEqual(result.detected, false);
    });

    it("does not run on the starting position", () => {
        const game = new ChessGame(true);
        assert.strictEqual(shouldRunForcedMateDetection(game), false);
        assert.strictEqual(detectForcedLossMate(game).detected, false);
    });

    it("async worker matches sync results for endgame positions", async function () {
        this.timeout(10000);
        const cases = [ESCAPE_AVAILABLE, KING_VS_KING, IMMEDIATE_MATE_WHITE];
        for (const state of cases) {
            const game = loadState(state);
            const sync = detectForcedLossMate(game);
            const asyncResult = await detectForcedLossMateAsync(game);
            assert.deepStrictEqual(asyncResult, sync);
        }
        const start = new ChessGame(true);
        assert.deepStrictEqual(
            await detectForcedLossMateAsync(start),
            detectForcedLossMate(start),
        );
    });

    it("async path yields to the event loop while detection runs", async function () {
        this.timeout(10000);
        const game = loadState(ESCAPE_AVAILABLE);
        let tick = 0;
        const ticker = setInterval(() => {
            tick += 1;
        }, 5);
        try {
            await detectForcedLossMateAsync(game);
            await new Promise((resolve) => setTimeout(resolve, 20));
            assert.ok(tick >= 1, `expected event-loop ticks during/after async detection, got ${tick}`);
        } finally {
            clearInterval(ticker);
        }
    });
});
