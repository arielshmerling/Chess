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
    canAccessPlayPage,
    canUsePlayAdvancedTools,
    canAccessDebug,
    effectivePreferPlayPage,
    isAdminSession,
    resolveSessionUserType,
};
