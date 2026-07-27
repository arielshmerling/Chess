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

module.exports = {
    assignRematchPlayers,
    normalizeOffererWantsColor,
};
