/**
 * Conservative forced-loss detection for desktop immediate resign.
 * Only reports mate when every legal brain move still allows the opponent
 * to force checkmate within a bounded search — unproven lines are treated as escapes.
 */

const DEFAULT_MAX_PLIES = 8;
const MAX_ROOT_MOVES_FOR_DETECTION = 12;
const MAX_PIECES_FOR_DETECTION = 10;
const DEEP_SEARCH_MAX_PIECES = 6;

function countPieces(game) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    let count = 0;
    for (let row = 0; row < game.BOARD_ROWS; row++) {
        const boardRow = state.board[row];
        if (!boardRow) {
            continue;
        }
        for (let col = 0; col < game.BOARD_COLUMNS; col++) {
            if (boardRow[col]) {
                count += 1;
            }
        }
    }
    return count;
}

function collectLegalMoves(game) {
    const state = game.GameState;
    if (!state || !state.board) {
        return [];
    }
    const turn = game.Turn;
    const moves = [];
    for (let row = 0; row < game.BOARD_ROWS; row++) {
        const boardRow = state.board[row];
        if (!boardRow) {
            continue;
        }
        for (let col = 0; col < game.BOARD_COLUMNS; col++) {
            const piece = boardRow[col];
            if (!piece || piece.color !== turn) {
                continue;
            }
            const source = game.square(row, col);
            let options;
            try {
                options = game.possibleMoves(source);
            } catch {
                continue;
            }
            for (let i = 0; i < options.length; i++) {
                const group = options[i];
                if (Array.isArray(group)) {
                    for (let j = 0; j < group.length; j++) {
                        moves.push(group[j]);
                    }
                } else if (group) {
                    moves.push(group);
                }
            }
        }
    }
    return moves;
}

function withAppliedMove(game, move, fn) {
    game.makeMove(move.source, move.target);
    try {
        if (move.promotion) {
            game.completePromotion(move);
        }
        return fn();
    } finally {
        game.undo();
    }
}

function shouldRunForcedMateDetection(game) {
    const legalMoves = collectLegalMoves(game);
    if (legalMoves.length === 0 || legalMoves.length > MAX_ROOT_MOVES_FOR_DETECTION) {
        return false;
    }
    return countPieces(game) <= MAX_PIECES_FOR_DETECTION;
}

function orderMovesForMateSearch(game, moves) {
    if (moves.length <= 1) {
        return moves;
    }
    const state = game.GameState;
    return moves.slice().sort((a, b) => {
        const captureA = state?.board?.[a.target.row]?.[a.target.col] ? 1 : 0;
        const captureB = state?.board?.[b.target.row]?.[b.target.col] ? 1 : 0;
        return captureB - captureA;
    });
}

function isTerminalDraw(game) {
    return !!game.Draw;
}

function positionCacheKey(game, maxPlies, victimColor) {
    return `${JSON.stringify(game.GameState)}|${maxPlies}|${victimColor}`;
}

function opponentDeliversImmediateMate(game, victimColor) {
    const moves = collectLegalMoves(game);
    for (let i = 0; i < moves.length; i++) {
        const isMate = withAppliedMove(game, moves[i], () => game.Checkmate && game.Turn === victimColor);
        if (isMate) {
            return true;
        }
    }
    return false;
}

function canAttackerForceMate(game, maxPlies, victimColor, cache = new Map()) {
    if (maxPlies <= 0) {
        return { forced: false };
    }

    const cacheKey = positionCacheKey(game, maxPlies, victimColor);
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    let result;

    if (game.Checkmate) {
        result = game.Turn === victimColor
            ? { forced: true, pliesUntilMate: 0 }
            : { forced: false };
        cache.set(cacheKey, result);
        return result;
    }

    if (isTerminalDraw(game)) {
        result = { forced: false };
        cache.set(cacheKey, result);
        return result;
    }

    const legalMoves = collectLegalMoves(game);
    if (legalMoves.length === 0) {
        result = { forced: false };
        cache.set(cacheKey, result);
        return result;
    }

    const sideToMove = game.Turn;
    if (sideToMove === victimColor) {
        let minPlies = Infinity;
        for (let i = 0; i < legalMoves.length; i++) {
            const sub = withAppliedMove(game, legalMoves[i], () =>
                canAttackerForceMate(game, maxPlies - 1, victimColor, cache),
            );
            if (!sub.forced) {
                result = { forced: false };
                cache.set(cacheKey, result);
                return result;
            }
            minPlies = Math.min(minPlies, 1 + sub.pliesUntilMate);
        }
        result = { forced: true, pliesUntilMate: minPlies };
        cache.set(cacheKey, result);
        return result;
    }

    if (opponentDeliversImmediateMate(game, victimColor)) {
        result = { forced: true, pliesUntilMate: 1 };
        cache.set(cacheKey, result);
        return result;
    }

    for (let i = 0; i < legalMoves.length; i++) {
        const sub = withAppliedMove(game, legalMoves[i], () =>
            canAttackerForceMate(game, maxPlies - 1, victimColor, cache),
        );
        if (sub.forced) {
            result = { forced: true, pliesUntilMate: 1 + sub.pliesUntilMate };
            cache.set(cacheKey, result);
            return result;
        }
    }

    result = { forced: false };
    cache.set(cacheKey, result);
    return result;
}

function brainMoveAllowsForcedLoss(game, brainColor, maxPlies, cache) {
    if (opponentDeliversImmediateMate(game, brainColor)) {
        return { forced: true, pliesUntilMate: 1 };
    }
    if (countPieces(game) > DEEP_SEARCH_MAX_PIECES || maxPlies <= 1) {
        return { forced: false };
    }
    return canAttackerForceMate(game, maxPlies - 1, brainColor, cache);
}

function opponentMateInFromPlies(pliesAfterBrainMove) {
    return Math.ceil((1 + pliesAfterBrainMove) / 2);
}

/**
 * @param {import("../ChessGame")} game Position with brain to move.
 * @param {{ maxPlies?: number }} [opts]
 * @returns {{ detected: boolean, opponentMateIn?: number }}
 */
function detectForcedLossMate(game, opts) {
    if (!game || game.GameOver || !shouldRunForcedMateDetection(game)) {
        return { detected: false };
    }

    const maxPlies = opts && Number.isFinite(opts.maxPlies) ? opts.maxPlies : DEFAULT_MAX_PLIES;
    const brainColor = game.Turn;
    const cache = new Map();

    if (game.Checkmate && brainColor === game.Turn) {
        return { detected: true, opponentMateIn: 0 };
    }

    const rootMoves = orderMovesForMateSearch(game, collectLegalMoves(game));
    if (rootMoves.length === 0) {
        return { detected: false };
    }

    let shortestPliesAfterBrainMove = Infinity;

    for (let i = 0; i < rootMoves.length; i++) {
        const sub = withAppliedMove(game, rootMoves[i], () =>
            brainMoveAllowsForcedLoss(game, brainColor, maxPlies, cache),
        );
        if (!sub.forced) {
            return { detected: false };
        }
        shortestPliesAfterBrainMove = Math.min(shortestPliesAfterBrainMove, sub.pliesUntilMate);
    }

    return {
        detected: true,
        opponentMateIn: opponentMateInFromPlies(shortestPliesAfterBrainMove),
    };
}

module.exports = {
    detectForcedLossMate,
    canAttackerForceMate,
    collectLegalMoves,
    shouldRunForcedMateDetection,
    opponentDeliversImmediateMate,
    DEFAULT_MAX_PLIES,
};
