/**
 * Shared mate-score helpers for brain search (winning / losing forced mates).
 */

const LARGE_MATE_SCORE = 9_000_000_000_000_000;
const LARGE_MATE_THRESHOLD = LARGE_MATE_SCORE - 1024;
const SMALL_MATE_SCORE = 9999;

function largeIsWinningMateScore(score) {
    return Number.isFinite(score) && score >= LARGE_MATE_THRESHOLD;
}

function largeIsLosingMateScore(score) {
    return Number.isFinite(score) && score <= -LARGE_MATE_THRESHOLD;
}

function largeMatePliesFromScore(score) {
    if (largeIsLosingMateScore(score)) {
        return LARGE_MATE_SCORE + score;
    }
    if (largeIsWinningMateScore(score)) {
        return LARGE_MATE_SCORE - score;
    }
    return null;
}

function smallIsWinningMateScore(score) {
    return Number.isFinite(score) && score >= SMALL_MATE_SCORE;
}

function smallIsLosingMateScore(score) {
    return Number.isFinite(score) && score <= -SMALL_MATE_SCORE;
}

function smallMatePliesFromScore(score) {
    if (smallIsLosingMateScore(score)) {
        return SMALL_MATE_SCORE + score;
    }
    if (smallIsWinningMateScore(score)) {
        return SMALL_MATE_SCORE - score;
    }
    return null;
}

function tagOpponentMateOnMove(move, score, engineKind) {
    if (!move) {
        return move;
    }
    const isLosing = engineKind === "brain41" ? smallIsLosingMateScore : largeIsLosingMateScore;
    const matePlies = engineKind === "brain41" ? smallMatePliesFromScore : largeMatePliesFromScore;
    if (!isLosing(score)) {
        return move;
    }
    move._opponentMateDetected = true;
    const plies = matePlies(score);
    if (plies != null && plies > 0) {
        move.opponentMateIn = plies;
    }
    return move;
}

module.exports = {
    LARGE_MATE_SCORE,
    LARGE_MATE_THRESHOLD,
    SMALL_MATE_SCORE,
    largeIsWinningMateScore,
    largeIsLosingMateScore,
    largeMatePliesFromScore,
    smallIsWinningMateScore,
    smallIsLosingMateScore,
    smallMatePliesFromScore,
    tagOpponentMateOnMove,
};
