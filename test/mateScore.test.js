const test = require("node:test");
const assert = require("node:assert/strict");
const {
    MATE_SCORE,
    isProvenMateLossScore,
    isProvenMateWinScore,
    opponentMateInFromLossScore,
    rootSearchMovesEqual,
    shouldStopOnStableProvenMateWin,
    snapshotRootSearchMove,
} = require("../src/mateScore");

test("isProvenMateLossScore recognizes mate loss scores with ply offset", () => {
    assert.equal(isProvenMateLossScore(-MATE_SCORE + 3), true);
    assert.equal(isProvenMateLossScore(-8999999999999997), true);
    assert.equal(isProvenMateLossScore(-100), false);
    assert.equal(isProvenMateLossScore(MATE_SCORE), false);
});

test("isProvenMateWinScore recognizes mate win scores", () => {
    assert.equal(isProvenMateWinScore(MATE_SCORE - 5), true);
    assert.equal(isProvenMateWinScore(-MATE_SCORE + 3), false);
});

test("opponentMateInFromLossScore converts ply offset to full moves", () => {
    assert.equal(opponentMateInFromLossScore(-MATE_SCORE + 8), 4);
    assert.equal(opponentMateInFromLossScore(-MATE_SCORE + 3), 2);
    assert.equal(opponentMateInFromLossScore(-100), null);
});

test("shouldStopOnStableProvenMateWin when same move is proven mate two depths in a row", () => {
    const move = { source: { row: 6, col: 4 }, target: { row: 4, col: 4 }, score: MATE_SCORE - 4 };
    const prev = snapshotRootSearchMove(move);
    const cur = { source: { row: 6, col: 4 }, target: { row: 4, col: 4 }, score: MATE_SCORE - 6 };
    assert.equal(rootSearchMovesEqual(prev, cur), true);
    assert.equal(shouldStopOnStableProvenMateWin(prev, cur), true);
});

test("shouldStopOnStableProvenMateWin is false when best move changes", () => {
    const prev = snapshotRootSearchMove({
        source: { row: 6, col: 4 },
        target: { row: 4, col: 4 },
        score: MATE_SCORE - 2,
    });
    const cur = {
        source: { row: 6, col: 3 },
        target: { row: 4, col: 3 },
        score: MATE_SCORE - 2,
    };
    assert.equal(shouldStopOnStableProvenMateWin(prev, cur), false);
});
