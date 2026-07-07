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

function rootSearchMovesEqual(a, b) {
    return !!(
        a
        && b
        && a.source
        && b.source
        && a.target
        && b.target
        && a.source.row === b.source.row
        && a.source.col === b.source.col
        && a.target.row === b.target.row
        && a.target.col === b.target.col
    );
}

/**
 * Stop iterative deepening when the same root move is a proven mate win two depths in a row.
 * @param {{ source: object, target: object, score?: number }|null} previousBest
 * @param {{ source: object, target: object, score?: number }|null} currentBest
 */
function shouldStopOnStableProvenMateWin(previousBest, currentBest) {
    if (!previousBest || !currentBest) {
        return false;
    }
    return isProvenMateWinScore(previousBest.score)
        && isProvenMateWinScore(currentBest.score)
        && rootSearchMovesEqual(previousBest, currentBest);
}

/** Shallow snapshot for cross-depth mate-stability comparison. */
function snapshotRootSearchMove(move) {
    if (!move || move.source == null || move.target == null) {
        return null;
    }
    return {
        source: { row: move.source.row, col: move.source.col },
        target: { row: move.target.row, col: move.target.col },
        score: move.score,
    };
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
    rootSearchMovesEqual,
    shouldStopOnStableProvenMateWin,
    snapshotRootSearchMove,
};
