/**
 * Shared play-page path resolution for web routing (desktop uses /app/play).
 * Admins use the new /play shell; everyone else stays on classic /game.
 */

/**
 * @param {{ isMobile?: boolean, desktopQuery?: boolean, isAdmin?: boolean }} opts
 * @returns {"/game"|"/mobile-game"|"/play"}
 */
function resolvePlayGamePath(opts) {
    const options = opts || {};
    const isMobile = !!options.isMobile;
    const desktopQuery = !!options.desktopQuery;
    const isAdmin = !!options.isAdmin;

    if (isMobile && !desktopQuery) {
        return "/mobile-game";
    }
    if (isAdmin) {
        return "/play";
    }
    return "/game";
}

/**
 * Whether the logged-in user may open the Play shell.
 * @param {{ session?: { admin?: boolean } }} req
 */
function canAccessPlayPage(req) {
    return !!(req && req.session && req.session.admin);
}

/**
 * Admins always use the new Play UI on desktop web.
 * @param {{ session?: { admin?: boolean } }} req
 */
function effectivePreferPlayPage(req) {
    return !!(req && req.session && req.session.admin);
}

module.exports = {
    resolvePlayGamePath,
    canAccessPlayPage,
    effectivePreferPlayPage,
};
