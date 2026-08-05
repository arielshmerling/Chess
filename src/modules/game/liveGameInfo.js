"use strict";

/**
 * Shared rules for what /gameInfo exposes to Play clients.
 */

/**
 * @param {{ status?: string, chessGame?: { GameOver?: boolean } }} game
 * @returns {{ status: string, includeBoard: boolean }}
 */
function resolveLiveGameInfoFlags(game) {
    const rawStatus = game && game.status != null ? String(game.status) : "new";
    const chessOver = !!(game && game.chessGame && game.chessGame.GameOver);
    let status = rawStatus;
    /*
     * Chess may be finished while status lagged (timeout race). Clients must see
     * "game over", never a live resume. Cancelled stays cancelled.
     */
    if (chessOver && status !== "cancelled") {
        status = "game over";
    }
    const includeBoard =
        status === "game over" ||
        status === "in progress" ||
        status === "pending" ||
        status === "establishing" ||
        status === "on hold" ||
        status === "reJoining";
    return { status: status, includeBoard: includeBoard };
}

module.exports = {
    resolveLiveGameInfoFlags: resolveLiveGameInfoFlags,
};
