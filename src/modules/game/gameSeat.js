/**
 * Resolve which seat a userId is allowed to occupy on a live game.
 * @param {{ whitePlayer?: { userId?: * }, blackPlayer?: { userId?: * }, createdBy?: { userId?: * }, mode?: string }} game
 * @param {*} userId
 * @returns {"white"|"black"|null}
 */
function resolvePlayerSeat(game, userId) {
    if (userId == null || userId === "") {
        return null;
    }
    const uid = String(userId);
    const w = game.whitePlayer;
    const b = game.blackPlayer;
    const wMatch = !!(w && w.userId != null && String(w.userId) === uid);
    const bMatch = !!(b && b.userId != null && String(b.userId) === uid);

    if (wMatch && bMatch) {
        /* Practice (same user both seats): match historical white-first attach. */
        return "white";
    }
    if (wMatch) {
        return "white";
    }
    if (bMatch) {
        return "black";
    }

    /* Review seats may use null player ids; creator may still attach. */
    if (game.mode === "review" && game.createdBy && game.createdBy.userId != null
        && String(game.createdBy.userId) === uid) {
        return "white";
    }
    return null;
}

/**
 * @param {{ whitePlayer?: { channel?: * }, blackPlayer?: { channel?: * } }} game
 * @param {*} ws
 * @returns {"white"|"black"|null}
 */
function seatForChannel(game, ws) {
    if (!ws) {
        return null;
    }
    if (game.whitePlayer && game.whitePlayer.channel === ws) {
        return "white";
    }
    if (game.blackPlayer && game.blackPlayer.channel === ws) {
        return "black";
    }
    return null;
}

/**
 * Overwrite client identity fields from the socket seat (C3).
 * Practice may keep client-chosen isWhite (one human plays both colors).
 * @returns {boolean} false if the message must be rejected
 */
function applySocketMessageIdentity(game, msg, seat) {
    if (!msg || (seat !== "white" && seat !== "black")) {
        return false;
    }
    const isWhiteSeat = seat === "white";

    if (typeof game.allowsClientChosenSide === "function" && game.allowsClientChosenSide()) {
        return true;
    }

    /* Human socket relays AI moves for mobile LocalEngineMode. */
    if (msg.type === "cmd" && msg.info === "clientEngineMove") {
        msg.isWhite = !isWhiteSeat;
        return true;
    }

    if (Object.prototype.hasOwnProperty.call(msg, "isWhite")) {
        msg.isWhite = isWhiteSeat;
    }
    return true;
}

module.exports = {
    resolvePlayerSeat,
    seatForChannel,
    applySocketMessageIdentity,
};
