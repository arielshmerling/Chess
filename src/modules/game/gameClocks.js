/**
 * Server-authoritative game clocks (seconds remaining).
 * Clients may hint flag-fall; the server only ends the game when remaining ≤ 0.
 */

/** Client UI ticks whole seconds; allow a small skew vs server Date.now(). */
const FLAG_GRACE_SEC = 2.5;

function initialSeconds(game) {
    const gtl = game && game.chessGame && game.chessGame.GameTimeLength;
    if (typeof gtl === "number" && Number.isFinite(gtl) && gtl > 0) {
        return Math.round(gtl);
    }
    return 90 * 60;
}

/**
 * Ensure white/black remaining seconds exist on the game.
 * @param {*} game
 */
function ensureClocks(game) {
    if (!game) {
        return;
    }
    const full = initialSeconds(game);
    if (typeof game.clockWhiteSec !== "number" || !Number.isFinite(game.clockWhiteSec)) {
        game.clockWhiteSec = full;
    }
    if (typeof game.clockBlackSec !== "number" || !Number.isFinite(game.clockBlackSec)) {
        game.clockBlackSec = full;
    }
}

/**
 * Remaining seconds for a side, charging the active turn if it is that side.
 * @param {*} game
 * @param {boolean} isWhite
 * @param {number} [nowMs]
 */
function remainingSeconds(game, isWhite, nowMs) {
    ensureClocks(game);
    const base = isWhite ? game.clockWhiteSec : game.clockBlackSec;
    const now = typeof nowMs === "number" ? nowMs : Date.now();
    if (game._clockRunningFor == null || game._clockTurnStartedAt == null) {
        return Math.max(0, base);
    }
    const runningIsWhite = game._clockRunningFor === "white";
    if (runningIsWhite !== !!isWhite) {
        return Math.max(0, base);
    }
    const elapsed = (now - game._clockTurnStartedAt) / 1000;
    return Math.max(0, base - elapsed);
}

function clearFlagTimer(game) {
    if (game && game._flagTimerHandle) {
        clearTimeout(game._flagTimerHandle);
        game._flagTimerHandle = null;
    }
}

/**
 * Restore remaining seconds from the latest move that carries clock fields.
 * @param {*} game
 */
function restoreClocksFromLastMove(game) {
    ensureClocks(game);
    const moves = game && Array.isArray(game.moves) ? game.moves : [];
    for (let i = moves.length - 1; i >= 0; i -= 1) {
        const m = moves[i];
        if (!m) {
            continue;
        }
        let touched = false;
        if (typeof m.whiteTimer === "number" && Number.isFinite(m.whiteTimer)) {
            game.clockWhiteSec = Math.max(0, m.whiteTimer);
            touched = true;
        }
        if (typeof m.blackTimer === "number" && Number.isFinite(m.blackTimer)) {
            game.clockBlackSec = Math.max(0, m.blackTimer);
            touched = true;
        }
        if (touched) {
            return true;
        }
    }
    return false;
}

/**
 * Charge think-time since lastMoveOn onto the side to move (static clocks).
 * Used when server clocks were never started or were lost after rehydrate.
 * @param {*} game
 * @param {number} [nowMs]
 */
function chargeElapsedSinceLastMove(game, nowMs) {
    if (!game || game._clockRunningFor != null) {
        return;
    }
    const last = typeof game.lastMoveOn === "number" ? game.lastMoveOn : null;
    if (last == null || !Number.isFinite(last)) {
        return;
    }
    const now = typeof nowMs === "number" ? nowMs : Date.now();
    const elapsed = Math.max(0, (now - last) / 1000);
    if (elapsed <= 0) {
        return;
    }
    ensureClocks(game);
    const turn = game.chessGame && game.chessGame.Turn === "black" ? "black" : "white";
    if (turn === "white") {
        game.clockWhiteSec = Math.max(0, game.clockWhiteSec - elapsed);
    } else {
        game.clockBlackSec = Math.max(0, game.clockBlackSec - elapsed);
    }
}

/**
 * Ensure live in-progress games have server clocks (after rehydrate / rejoin).
 * @param {*} game
 * @param {number} [nowMs]
 */
function ensureServerClocksActive(game, nowMs) {
    if (!game) {
        return;
    }
    const st = game.status;
    if (st === "game over" || st === "cancelled" || st === "pending" || st === "new") {
        return;
    }
    if (st === "on hold" || st === "reJoining") {
        restoreClocksFromLastMove(game);
        pauseClocks(game, nowMs);
        game._serverClocksActive = true;
        return;
    }
    if (game._serverClocksActive && game._clockRunningFor != null) {
        return;
    }
    restoreClocksFromLastMove(game);
    if (!game._serverClocksActive) {
        chargeElapsedSinceLastMove(game, nowMs);
    }
    game._serverClocksActive = true;
    const turn = game.chessGame && game.chessGame.Turn === "black" ? "black" : "white";
    startTurnClock(game, turn, nowMs);
}

/**
 * Persist charged time for the side that was running; stop the turn clock.
 * @param {*} game
 * @param {number} [nowMs]
 */
function pauseClocks(game, nowMs) {
    if (!game) {
        return;
    }
    ensureClocks(game);
    const now = typeof nowMs === "number" ? nowMs : Date.now();
    if (game._clockRunningFor != null && game._clockTurnStartedAt != null) {
        const isWhite = game._clockRunningFor === "white";
        const left = remainingSeconds(game, isWhite, now);
        if (isWhite) {
            game.clockWhiteSec = left;
        } else {
            game.clockBlackSec = left;
        }
    }
    game._clockRunningFor = null;
    game._clockTurnStartedAt = null;
    clearFlagTimer(game);
}

/**
 * Start (or restart) the clock for the side to move.
 * Schedules server flag-fall when remaining hits zero.
 * @param {*} game
 * @param {"white"|"black"} side
 * @param {number} [nowMs]
 */
function startTurnClock(game, side, nowMs) {
    if (!game || (side !== "white" && side !== "black")) {
        return;
    }
    if (game.status === "game over" || game.status === "cancelled") {
        return;
    }
    game._serverClocksActive = true;
    ensureClocks(game);
    const now = typeof nowMs === "number" ? nowMs : Date.now();
    pauseClocks(game, now);
    game._clockRunningFor = side;
    game._clockTurnStartedAt = now;
    const left = remainingSeconds(game, side === "white", now);
    if (left <= 0) {
        void flagFall(game, side);
        return;
    }
    const delayMs = Math.max(1, Math.ceil(left * 1000));
    game._flagTimerHandle = setTimeout(() => {
        game._flagTimerHandle = null;
        void flagFall(game, side);
    }, delayMs);
    if (typeof game._flagTimerHandle.unref === "function") {
        game._flagTimerHandle.unref();
    }
}

/**
 * After a validated move by `moverIsWhite`, charge that side and start opponent's clock.
 * Writes server remaining onto the move object when present.
 * @param {*} game
 * @param {boolean} moverIsWhite
 * @param {object} [moveObj]
 * @param {number} [nowMs]
 */
function afterValidatedMove(game, moverIsWhite, moveObj, nowMs) {
    if (!game || !game._serverClocksActive) {
        return;
    }
    ensureClocks(game);
    const now = typeof nowMs === "number" ? nowMs : Date.now();

    if (game._clockRunningFor != null) {
        pauseClocks(game, now);
    } else {
        clearFlagTimer(game);
        /* First move before clocks were started: no think-time charge. */
    }

    if (moveObj) {
        moveObj.whiteTimer = Math.round(game.clockWhiteSec);
        moveObj.blackTimer = Math.round(game.clockBlackSec);
        if (typeof moveObj.moveTime !== "number" || !Number.isFinite(moveObj.moveTime)) {
            moveObj.moveTime = Math.round(moverIsWhite ? game.clockWhiteSec : game.clockBlackSec);
        }
    }

    if (game.chessGame && game.chessGame.GameOver) {
        return;
    }
    const next = game.chessGame && game.chessGame.Turn === "black" ? "black" : "white";
    startTurnClock(game, next, now);
}

/**
 * Apply flag fall if not already over. Notifies players when possible.
 * @param {*} game
 * @param {"white"|"black"} loser
 */
async function flagFall(game, loser) {
    if (!game || (loser !== "white" && loser !== "black")) {
        return false;
    }
    if (game.status === "game over" || game.status === "cancelled") {
        return false;
    }
    pauseClocks(game);
    if (loser === "white") {
        game.clockWhiteSec = 0;
    } else {
        game.clockBlackSec = 0;
    }
    await game.outOfTime(loser);
    try {
        const go = {
            type: "info",
            info: "game over",
            gameId: game.gameId,
            loser: loser,
            reason: "out of time",
        };
        if (typeof game.sendMessage === "function") {
            game.sendMessage(go, true);
            game.sendMessage(go, false);
        }
        if (typeof game.sendInfoToWatchers === "function") {
            game.sendInfoToWatchers(go);
        }
        if (typeof game.sendClockSyncToWatchers === "function") {
            game.sendClockSyncToWatchers(game.clockWhiteSec, game.clockBlackSec);
        }
        /* Push authoritative clocks to both seats when channels exist. */
        const sync = {
            type: "info",
            info: "clockSync",
            gameId: game.gameId,
            whiteTimer: Math.round(game.clockWhiteSec),
            blackTimer: Math.round(game.clockBlackSec),
        };
        if (typeof game.sendMessage === "function") {
            game.sendMessage(sync, true);
            game.sendMessage(sync, false);
        }
    } catch (err) {
        console.error("flagFall notify failed:", err && err.message ? err.message : err);
    }
    return true;
}

/**
 * Client hint that a side flagged. Accept only if server remaining ≤ grace.
 * Otherwise push clockSync and reject.
 * @param {*} game
 * @param {"white"|"black"} claimedLoser
 * @returns {Promise<boolean>}
 */
async function tryClientFlagHint(game, claimedLoser) {
    if (!game || (claimedLoser !== "white" && claimedLoser !== "black")) {
        return false;
    }
    if (game.status === "game over" || game.status === "cancelled") {
        return false;
    }
    /*
     * Clocks may be inactive after process rehydrate or if startServerClocks never ran.
     * Rebuild remaining time only when counters are missing — do not overwrite an
     * already-authoritative zero (or other remaining values set by the caller).
     */
    if (!game._serverClocksActive) {
        const missing =
            typeof game.clockWhiteSec !== "number" ||
            typeof game.clockBlackSec !== "number" ||
            !Number.isFinite(game.clockWhiteSec) ||
            !Number.isFinite(game.clockBlackSec);
        if (missing) {
            restoreClocksFromLastMove(game);
            chargeElapsedSinceLastMove(game);
        }
        game._serverClocksActive = true;
    }
    ensureClocks(game);
    const now = Date.now();
    const left = remainingSeconds(game, claimedLoser === "white", now);
    if (left > FLAG_GRACE_SEC) {
        const sync = {
            type: "info",
            info: "clockSync",
            gameId: game.gameId,
            whiteTimer: Math.round(remainingSeconds(game, true, now)),
            blackTimer: Math.round(remainingSeconds(game, false, now)),
        };
        try {
            if (typeof game.sendMessage === "function") {
                game.sendMessage(sync, true);
                game.sendMessage(sync, false);
            }
            if (typeof game.sendClockSyncToWatchers === "function") {
                game.sendClockSyncToWatchers(sync.whiteTimer, sync.blackTimer);
            }
        } catch (err) {
            console.error("clockSync after rejected flag hint:", err && err.message ? err.message : err);
        }
        return false;
    }
    return flagFall(game, claimedLoser);
}

/**
 * Snapshot for /gameInfo style clients (whole seconds).
 * @param {*} game
 * @param {boolean} isWhite
 */
function snapshotSeconds(game, isWhite) {
    return Math.round(remainingSeconds(game, isWhite));
}

module.exports = {
    FLAG_GRACE_SEC,
    ensureClocks,
    remainingSeconds,
    pauseClocks,
    startTurnClock,
    afterValidatedMove,
    flagFall,
    tryClientFlagHint,
    snapshotSeconds,
    clearFlagTimer,
    restoreClocksFromLastMove,
    chargeElapsedSinceLastMove,
    ensureServerClocksActive,
};
