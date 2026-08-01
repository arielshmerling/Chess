/**
 * Authorization helpers for live / review game read access.
 */

function sessionUserId(session) {
    return session && session.user_id != null ? String(session.user_id) : "";
}

function sessionUserName(session) {
    return session && session.user_name != null ? String(session.user_name) : "";
}

/**
 * @param {*} game live server game
 * @param {*} session
 */
function isLiveGameParticipant(game, session) {
    if (!game || !session) {
        return false;
    }
    const uid = sessionUserId(session);
    const uname = sessionUserName(session);
    if (!uid && !uname) {
        return false;
    }
    if (game.createdBy && game.createdBy.userId != null && String(game.createdBy.userId) === uid) {
        return true;
    }
    if (game.whitePlayer && game.whitePlayer.userId != null && String(game.whitePlayer.userId) === uid) {
        return true;
    }
    if (game.blackPlayer && game.blackPlayer.userId != null && String(game.blackPlayer.userId) === uid) {
        return true;
    }
    if (uname) {
        if (game.whitePlayer && game.whitePlayer.userName === uname) {
            return true;
        }
        if (game.blackPlayer && game.blackPlayer.userName === uname) {
            return true;
        }
    }
    return false;
}

/**
 * Logged-in users may read public live games (spectate); private → participants only.
 * @param {*} game
 * @param {*} session
 */
function canReadLiveGame(game, session) {
    if (!session || !session.user_id) {
        return false;
    }
    if (isLiveGameParticipant(game, session)) {
        return true;
    }
    if (game && game.isPrivate === true) {
        return false;
    }
    return true;
}

/**
 * @param {{ whitePlayer?: string, blackPlayer?: string, createBy?: string, createByUserId?: *, isPrivate?: boolean }} doc
 * @param {*} session
 */
function canReadPersistedGame(doc, session) {
    if (!session || !session.user_id || !doc) {
        return false;
    }
    const uid = sessionUserId(session);
    const uname = sessionUserName(session);
    if (doc.createByUserId != null && String(doc.createByUserId) === uid) {
        return true;
    }
    if (uname && (doc.whitePlayer === uname || doc.blackPlayer === uname || doc.createBy === uname)) {
        return true;
    }
    if (doc.isPrivate === true) {
        return false;
    }
    return true;
}

/**
 * @param {{ whitePlayer?: string, blackPlayer?: string, createBy?: string, createByUserId?: * }} doc
 * @param {*} session
 * @param {boolean} isAdmin
 */
function canDeletePersistedGame(doc, session, isAdmin) {
    if (isAdmin) {
        return true;
    }
    if (!session || !doc) {
        return false;
    }
    const uid = sessionUserId(session);
    const uname = sessionUserName(session);
    if (doc.createByUserId != null && String(doc.createByUserId) === uid) {
        return true;
    }
    if (uname && (doc.whitePlayer === uname || doc.blackPlayer === uname || doc.createBy === uname)) {
        return true;
    }
    return false;
}

module.exports = {
    isLiveGameParticipant,
    canReadLiveGame,
    canReadPersistedGame,
    canDeletePersistedGame,
};
