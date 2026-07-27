/**
 * Shared play-page path resolution for web routing (desktop uses /app/play).
 * Logged-in users (Admin, Partner, Member) use the new /play shell on desktop web.
 */

const {
    canAccessPlayPage: sessionCanAccessPlayPage,
    canUsePlayAdvancedTools: sessionCanUsePlayAdvancedTools,
    canAccessDebug: sessionCanAccessDebug,
    isAdminSession,
    resolveSessionUserType,
} = require("../modules/user/roles");

/**
 * @param {{ isMobile?: boolean, desktopQuery?: boolean, usePlayPage?: boolean, isAdmin?: boolean }} opts
 * @returns {"/game"|"/mobile-game"|"/play"}
 */
function resolvePlayGamePath(opts) {
    const options = opts || {};
    const isMobile = !!options.isMobile;
    const desktopQuery = !!options.desktopQuery;
    /* isAdmin kept for callers/tests; all desktop web users that prefer play get /play. */
    const usePlayPage = options.usePlayPage !== undefined
        ? !!options.usePlayPage
        : !!options.isAdmin;

    if (isMobile && !desktopQuery) {
        return "/mobile-game";
    }
    if (usePlayPage) {
        return "/play";
    }
    return "/game";
}

/**
 * Participant reopen URL for an online game id.
 * @param {string|number} gameId
 * @param {{ usePlayPage?: boolean }} [opts]
 * @returns {string}
 */
function resolveOnlineParticipantHref(gameId, opts) {
    const base = resolvePlayGamePath({
        isMobile: false,
        usePlayPage: !!(opts && opts.usePlayPage),
    });
    return base + "?id=" + encodeURIComponent(String(gameId));
}

/**
 * Spectator watch URL for an online game id.
 * @param {string|number} gameId
 * @param {{ usePlayPage?: boolean }} [opts]
 * @returns {string}
 */
function resolveOnlineWatchHref(gameId, opts) {
    if (opts && opts.usePlayPage) {
        return (
            "/play?id=" +
            encodeURIComponent(String(gameId)) +
            "&mode=watch"
        );
    }
    return "/watch?id=" + encodeURIComponent(String(gameId));
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
    if (opts && opts.usePlayPage) {
        let url =
            "/play?mode=review&id=" + encodeURIComponent(String(gameId));
        if (type) {
            url += "&type=" + encodeURIComponent(type);
        }
        return url;
    }
    let classic = "/review?id=" + encodeURIComponent(String(gameId));
    if (type) {
        classic += "&type=" + encodeURIComponent(type);
    }
    return classic;
}

/**
 * Debug / Practice self-play URL.
 * @param {{ usePlayPage?: boolean }} [opts]
 * @returns {string}
 */
function resolvePracticeHref(opts) {
    if (opts && opts.usePlayPage) {
        return "/play?mode=practice";
    }
    return "/game?gameType=3";
}

/**
 * Whether the logged-in user may open the Play shell.
 * @param {{ session?: { user_id?: *, admin?: boolean, userType?: string } }} req
 */
function canAccessPlayPage(req) {
    return sessionCanAccessPlayPage(req && req.session);
}

/**
 * Position Setup + Config on /play.
 * @param {{ session?: { admin?: boolean, userType?: string } }} req
 */
function canUsePlayAdvancedTools(req) {
    return sessionCanUsePlayAdvancedTools(req && req.session);
}

/**
 * Debug / PracticeGame (gameType 3).
 * @param {{ session?: { admin?: boolean, userType?: string } }} req
 */
function canAccessDebug(req) {
    return sessionCanAccessDebug(req && req.session);
}

/**
 * Desktop web users with a session use the new Play UI.
 * @param {{ session?: { user_id?: *, admin?: boolean, userType?: string } }} req
 */
function effectivePreferPlayPage(req) {
    return sessionCanAccessPlayPage(req && req.session);
}

module.exports = {
    resolvePlayGamePath,
    resolveOnlineParticipantHref,
    resolveOnlineWatchHref,
    resolveReviewHref,
    resolvePracticeHref,
    canAccessPlayPage,
    canUsePlayAdvancedTools,
    canAccessDebug,
    effectivePreferPlayPage,
    isAdminSession,
    resolveSessionUserType,
};
