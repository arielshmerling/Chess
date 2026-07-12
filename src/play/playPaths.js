/**
 * Shared play-page path resolution for web routing (desktop uses /app/play).
 */

/**
 * @param {{ isMobile?: boolean, desktopQuery?: boolean, isAdmin?: boolean, preferPlayPage?: boolean }} opts
 * @returns {"/game"|"/mobile-game"|"/play"}
 */
function resolvePlayGamePath(opts) {
    const options = opts || {};
    const isMobile = !!options.isMobile;
    const desktopQuery = !!options.desktopQuery;
    const isAdmin = !!options.isAdmin;
    const preferPlayPage = !!options.preferPlayPage;

    if (isMobile && !desktopQuery) {
        return "/mobile-game";
    }
    if (isAdmin && preferPlayPage) {
        return "/play";
    }
    return "/game";
}

/**
 * Whether the logged-in user may open the experimental Play shell.
 * @param {{ session?: { admin?: boolean } }} req
 */
function canAccessPlayPage(req) {
    return !!(req && req.session && req.session.admin);
}

/**
 * Effective prefer-play flag (admins only).
 * @param {{ session?: { admin?: boolean, preferPlayPage?: boolean } }} req
 */
function effectivePreferPlayPage(req) {
    if (!req || !req.session || !req.session.admin) {
        return false;
    }
    return !!req.session.preferPlayPage;
}

module.exports = {
    resolvePlayGamePath,
    canAccessPlayPage,
    effectivePreferPlayPage,
};
