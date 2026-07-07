const test = require("node:test");
const assert = require("node:assert/strict");
const {
    MATE_SCORE,
    isProvenMateLossScore,
    isProvenMateWinScore,
    opponentMateInFromLossScore,
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
