/**
 * In-memory presence: HTTP ping (tabs without WS) + WebSocket subscribers (live online/offline).
 * WS connections are session-bound on the server; never trust client-supplied user ids for attachment.
 *
 * Offline is debounced so full-page navigations (WS disconnect → reconnect) do not flash friends' UI.
 */

const ONLINE_MS = 90 * 1000;
/** Delay before telling others this user went offline (ms). Cancels if they reconnect (new tab WS). */
const OFFLINE_BROADCAST_DEBOUNCE_MS = 4000;

const lastSeenByUserId = new Map();

/** @type {Map<string, Set<any>>} */
const wsSocketsByUserId = new Map();

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pendingOfflineByUserId = new Map();

/** @type {null | ((payload: { userId: string, username: string, online: boolean }) => void)} */
let broadcastFriendPresence = null;

/**
 * @param {string} uid
 */
function clearOfflineTimer(uid) {
    const u = String(uid);
    const t = pendingOfflineByUserId.get(u);
    if (t != null) {
        clearTimeout(t);
        pendingOfflineByUserId.delete(u);
    }
}

/**
 * @param {string} uid
 * @param {string} username
 */
function scheduleOfflineBroadcast(uid, username) {
    const u = String(uid);
    clearOfflineTimer(u);
    const timer = setTimeout(() => {
        pendingOfflineByUserId.delete(u);
        const set = wsSocketsByUserId.get(u);
        if (set && set.size > 0) {
            return;
        }
        if (broadcastFriendPresence) {
            broadcastFriendPresence({
                userId: u,
                username: username != null ? String(username) : "",
                online: false,
            });
        }
    }, OFFLINE_BROADCAST_DEBOUNCE_MS);
    pendingOfflineByUserId.set(u, timer);
}

/**
 * @param {null | ((payload: { userId: string, username: string, online: boolean }) => void)} fn
 */
function setFriendPresenceBroadcaster(fn) {
    broadcastFriendPresence = fn;
}

/**
 * @param {string|import("mongoose").Types.ObjectId} userId
 */
function touch(userId) {
    if (userId == null || userId === "") {
        return;
    }
    lastSeenByUserId.set(String(userId), Date.now());
}

/**
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @returns {boolean}
 */
function isOnline(userId) {
    if (userId == null || userId === "") {
        return false;
    }
    const uid = String(userId);
    const sockets = wsSocketsByUserId.get(uid);
    if (sockets && sockets.size > 0) {
        return true;
    }
    const t = lastSeenByUserId.get(uid);
    return t != null && Date.now() - t < ONLINE_MS;
}

/**
 * @param {any} ws
 * @param {string} userId
 * @param {string} username
 */
function attachPresenceWebSocket(ws, userId, username) {
    const uid = String(userId);
    const hadPendingOffline = pendingOfflineByUserId.has(uid);
    clearOfflineTimer(uid);

    if (!wsSocketsByUserId.has(uid)) {
        wsSocketsByUserId.set(uid, new Set());
    }
    const set = wsSocketsByUserId.get(uid);
    const wasEmpty = set.size === 0;
    set.add(ws);
    ws._presenceUserId = uid;
    ws._presenceUsername = username != null ? String(username) : "";

    if (wasEmpty && broadcastFriendPresence && !hadPendingOffline) {
        broadcastFriendPresence({
            userId: uid,
            username: ws._presenceUsername,
            online: true,
        });
    }
}

/**
 * @param {any} ws
 */
/**
 * Send a JSON payload to all presence WebSocket connections for a given user (same tabs).
 * @param {string|import("mongoose").Types.ObjectId} userId
 * @param {object} payload Object serialized with JSON.stringify (not a raw string).
 */
function sendToUser(userId, payload) {
    if (userId == null || userId === "") {
        return;
    }
    const set = wsSocketsByUserId.get(String(userId));
    if (!set || set.size === 0) {
        return;
    }
    let message;
    try {
        message = JSON.stringify(payload);
    } catch {
        return;
    }
    for (const s of set) {
        if (s && s.readyState === 1) {
            try {
                s.send(message);
            } catch {
                /* ignore */
            }
        }
    }
}

function detachPresenceWebSocket(ws) {
    const uid = ws._presenceUserId;
    if (uid == null) {
        return;
    }
    const usernameSnapshot = ws._presenceUsername != null ? String(ws._presenceUsername) : "";
    const set = wsSocketsByUserId.get(String(uid));
    if (!set) {
        delete ws._presenceUserId;
        delete ws._presenceUsername;
        return;
    }
    set.delete(ws);
    delete ws._presenceUserId;
    delete ws._presenceUsername;
    if (set.size === 0) {
        wsSocketsByUserId.delete(String(uid));
        scheduleOfflineBroadcast(String(uid), usernameSnapshot);
    }
}

module.exports = {
    touch,
    isOnline,
    setFriendPresenceBroadcaster,
    attachPresenceWebSocket,
    detachPresenceWebSocket,
    sendToUser,
};
