/**
 * Assign white/black seats for an online rematch.
 *
 * @param {object} opts
 * @param {*} opts.whitePlayer - white player from the finished game
 * @param {*} opts.blackPlayer - black player from the finished game
 * @param {boolean} opts.acceptorIsWhite - acceptor's color in the finished game
 * @param {"white"|"black"|null|undefined} opts.offererWantsColor - offerer's preferred color in the new game
 * @returns {{ whitePlayer: *, blackPlayer: * }}
 */
function assignRematchPlayers(opts) {
    const whitePlayer = opts && opts.whitePlayer;
    const blackPlayer = opts && opts.blackPlayer;
    const acceptorIsWhite = opts && opts.acceptorIsWhite === true;
    const offererWantsColor = opts && opts.offererWantsColor;

    if (offererWantsColor !== "white" && offererWantsColor !== "black") {
        return { whitePlayer: whitePlayer, blackPlayer: blackPlayer };
    }

    const offerer = acceptorIsWhite ? blackPlayer : whitePlayer;
    const acceptor = acceptorIsWhite ? whitePlayer : blackPlayer;

    if (offererWantsColor === "white") {
        return { whitePlayer: offerer, blackPlayer: acceptor };
    }
    return { whitePlayer: acceptor, blackPlayer: offerer };
}

/**
 * Normalize a rematch color preference from a WS message field.
 * @param {*} value
 * @returns {"white"|"black"|null}
 */
function normalizeOffererWantsColor(value) {
    if (value === "white" || value === "black") {
        return value;
    }
    return null;
}

/**
 * Clamp rematch clock length (minutes per side) to the product range.
 * @param {*} value
 * @returns {number|null}
 */
function normalizeRematchTimeMinutes(value) {
    const tm = typeof value === "number" ? value : parseInt(value, 10);
    if (!Number.isFinite(tm) || tm < 1) {
        return null;
    }
    return Math.max(1, Math.min(180, Math.round(tm)));
}

/**
 * @param {*} game - finished OnlineGame (or similar) with chessGame.GameTimeLength in seconds
 * @returns {number|null}
 */
function timeMinutesFromGame(game) {
    const gtl = game && game.chessGame && game.chessGame.GameTimeLength;
    if (typeof gtl === "number" && gtl >= 60) {
        return Math.max(1, Math.min(180, Math.round(gtl / 60)));
    }
    return null;
}

/**
 * Prefer an explicit offer value; otherwise reuse the finished game's clock; else 90.
 * @param {*} preferred
 * @param {*} [fallbackGame]
 * @returns {number}
 */
function resolveRematchTimeMinutes(preferred, fallbackGame) {
    return (
        normalizeRematchTimeMinutes(preferred) ||
        timeMinutesFromGame(fallbackGame) ||
        90
    );
}

module.exports = {
    assignRematchPlayers,
    normalizeOffererWantsColor,
    normalizeRematchTimeMinutes,
    timeMinutesFromGame,
    resolveRematchTimeMinutes,
};
