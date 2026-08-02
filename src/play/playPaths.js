/**
 * Shared play-page path resolution for web routing.
 * Desktop uses `/play`; mobile uses `/mobile-game` (and `/watch` / `/review` shells).
 */

const {
    canAccessPlayPage: sessionCanAccessPlayPage,
    canUsePlayAdvancedTools: sessionCanUsePlayAdvancedTools,
    canAccessDebug: sessionCanAccessDebug,
    isAdminSession,
    resolveSessionUserType,
} = require("../modules/user/roles");

/**
 * @param {{ isMobile?: boolean, desktopQuery?: boolean }} opts
 * @returns {"/mobile-game"|"/play"}
 */
function resolvePlayGamePath(opts) {
    const options = opts || {};
    if (options.isMobile && !options.desktopQuery) {
        return "/mobile-game";
    }
    return "/play";
}

/**
 * Participant reopen URL for an online game id.
 * @param {string|number} gameId
 * @returns {string}
 */
function resolveOnlineParticipantHref(gameId) {
    return "/play?id=" + encodeURIComponent(String(gameId));
}

/**
 * Spectator watch URL for an online game id.
 * @param {string|number} gameId
 * @param {{ isMobile?: boolean }} [opts]
 * @returns {string}
 */
function resolveOnlineWatchHref(gameId, opts) {
    if (opts && opts.isMobile) {
        return "/watch?id=" + encodeURIComponent(String(gameId));
    }
    return (
        "/play?id=" +
        encodeURIComponent(String(gameId)) +
        "&mode=watch"
    );
}

/**
 * History / PGN review URL.
 * @param {string|number} gameId
 * @param {{ usePlayPage?: boolean, type?: "history"|"pgn"|string|null }} [opts]
 * @returns {string}
 */
function resolveReviewHref(gameId, opts) {
    const type =
        opts && (opts.type === "history" || opts.type === "pgn") ? opts.type : null;
    if (opts && opts.usePlayPage === false) {
        let url = "/review?id=" + encodeURIComponent(String(gameId));
        if (type) {
            url += "&type=" + encodeURIComponent(type);
        }
        return url;
    }
    let url =
        "/play?mode=review&id=" + encodeURIComponent(String(gameId));
    if (type) {
        url += "&type=" + encodeURIComponent(type);
    }
    return url;
}

/**
 * Practice / Debug entry URL.
 * @returns {string}
 */
function resolvePracticeHref() {
    return "/play?mode=practice";
}

/**
 * Map retired `/game` query → `/play`.
 *
 * @param {Record<string, string|undefined>|null|undefined} query
 * @returns {string}
 */
function resolveGameToPlayHref(query) {
    const q = query || {};

    if (q.joinGame != null && String(q.joinGame).trim() !== "") {
        return (
            "/play?id=" + encodeURIComponent(String(q.joinGame).trim())
        );
    }

    if (String(q.gameType) === "3") {
        return "/play?mode=practice";
    }

    if (q.id != null && String(q.id).trim() !== "") {
        let url = "/play?id=" + encodeURIComponent(String(q.id).trim());
        if (q.mode === "watch") {
            url += "&mode=watch";
        }
        return url;
    }

    if (q.newGame === "1" || String(q.gameType) === "1") {
        const params = new URLSearchParams();
        params.set("newGame", "1");
        if (q.color === "white" || q.color === "black") {
            params.set("color", q.color);
        }
        if (typeof q.engine === "string" && q.engine.trim()) {
            params.set("engine", q.engine.trim());
        }
        if (q.difficulty != null && String(q.difficulty).trim() !== "") {
            params.set("difficulty", String(q.difficulty));
        }
        if (q.mouse === "drag" || q.mouse === "double") {
            params.set("mouse", q.mouse);
        }
        if (q.showMoves === "0" || q.showMoves === "1") {
            params.set("showMoves", q.showMoves);
        }
        if (q.timeMinutes != null && String(q.timeMinutes).trim() !== "") {
            params.set("timeMinutes", String(q.timeMinutes));
        }
        if (q.private === "1") {
            params.set("private", "1");
        }
        return "/play?" + params.toString();
    }

    return "/play";
}

/**
 * @param {{ session?: { user_id?: *, admin?: boolean, userType?: string } }} req
 */
function canAccessPlayPage(req) {
    return sessionCanAccessPlayPage(req && req.session);
}

function canUsePlayAdvancedTools(req) {
    return sessionCanUsePlayAdvancedTools(req && req.session);
}

function canAccessDebug(req) {
    return sessionCanAccessDebug(req && req.session);
}

module.exports = {
    resolvePlayGamePath,
    resolveOnlineParticipantHref,
    resolveOnlineWatchHref,
    resolveReviewHref,
    resolvePracticeHref,
    resolveGameToPlayHref,
    canAccessPlayPage,
    canUsePlayAdvancedTools,
    canAccessDebug,
    isAdminSession,
    resolveSessionUserType,
};
