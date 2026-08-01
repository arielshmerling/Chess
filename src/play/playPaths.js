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
 * @param {{ usePlayPage?: boolean, isMobile?: boolean }} [opts]
 * @returns {string}
 */
function resolveOnlineWatchHref(gameId, opts) {
    if (opts && opts.usePlayPage && !opts.isMobile) {
        return (
            "/play?id=" +
            encodeURIComponent(String(gameId)) +
            "&mode=watch"
        );
    }
    /* Mobile and classic both use /watch?id=; mobile UA renders mobile-game shell. */
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

/**
 * Phase 10 deprecation: map classic `/game` query → `/play` when safe.
 * Returns null to keep classic rendering (escape hatch, SP reopen by id, unjoined join).
 *
 * @param {Record<string, string|undefined>|null|undefined} query
 * @param {{
 *   classicEscape?: boolean,
 *   onlineGameById?: boolean,
 *   alreadyJoinedJoinGame?: boolean,
 * }} [opts]
 * @returns {string|null}
 */
function resolveDeprecatedGameToPlayHref(query, opts) {
    const q = query || {};
    const options = opts || {};
    if (options.classicEscape === true || q.classic === "1") {
        return null;
    }

    /*
     * Friend join: Prefer-Play accept goes to /play?id= directly.
     * Deep-link /game?joinGame= still needs classic join unless already a participant.
     */
    if (q.joinGame != null && String(q.joinGame).trim() !== "") {
        if (options.alreadyJoinedJoinGame === true) {
            return (
                "/play?id=" + encodeURIComponent(String(q.joinGame).trim())
            );
        }
        return null;
    }

    if (String(q.gameType) === "3") {
        return "/play?mode=practice";
    }

    if (q.id != null && String(q.id).trim() !== "") {
        /*
         * Prefer-Play: reopen any live game by id (OnlineGame + SinglePlayerGame,
         * including on-hold rejoin). Classic escape still skips this helper.
         */
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

    /* Bare /game → Play shell. */
    if (q.gameType == null || String(q.gameType).trim() === "") {
        return "/play";
    }

    return null;
}

module.exports = {
    resolvePlayGamePath,
    resolveOnlineParticipantHref,
    resolveOnlineWatchHref,
    resolveReviewHref,
    resolvePracticeHref,
    resolveDeprecatedGameToPlayHref,
    canAccessPlayPage,
    canUsePlayAdvancedTools,
    canAccessDebug,
    effectivePreferPlayPage,
    isAdminSession,
    resolveSessionUserType,
};
