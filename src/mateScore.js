/** Magnitude of a terminal mate score; dominates any material total. */
const MATE_SCORE = 9_000_000_000_000_000;
/** Largest ply offset from ±MATE_SCORE still treated as a proven mate score. */
const MATE_SCORE_PLY_MARGIN = 512;

function isProvenMateLossScore(score) {
    return Number.isFinite(score) && score <= -MATE_SCORE + MATE_SCORE_PLY_MARGIN;
}

function isProvenMateWinScore(score) {
    return Number.isFinite(score) && score >= MATE_SCORE - MATE_SCORE_PLY_MARGIN;
}

function isProvenMateScore(score) {
    return isProvenMateLossScore(score) || isProvenMateWinScore(score);
}

/** Full moves until opponent delivers mate, from a root loss score (-MATE_SCORE + ply). */
function opponentMateInFromLossScore(score) {
    if (!isProvenMateLossScore(score)) {
        return null;
    }
    const pliesUntilMate = Math.round(score + MATE_SCORE);
    if (pliesUntilMate < 0) {
        return null;
    }
    return Math.ceil(pliesUntilMate / 2);
}

module.exports = {
    MATE_SCORE,
    MATE_SCORE_PLY_MARGIN,
    isProvenMateLossScore,
    isProvenMateWinScore,
    isProvenMateScore,
    opponentMateInFromLossScore,
};
