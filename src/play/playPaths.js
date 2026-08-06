/**
 * Shared play-page path resolution for web routing.
 * Desktop uses `/play`; mobile uses `/mobile-game` (and `/watch` / `/review` shells).
 */

const { canAccessPlayPage: sessionCanAccessPlayPage } = require("../modules/user/roles");

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
 * History / PGN review URL (Play shell).
 * @param {string|number} gameId
 * @param {{ type?: "history"|"pgn"|string|null }} [opts]
 * @returns {string}
 */
function resolveReviewHref(gameId, opts) {
    const type =
        opts && (opts.type === "history" || opts.type === "pgn") ? opts.type : null;
    let url =
        "/play?mode=review&id=" + encodeURIComponent(String(gameId));
    if (type) {
        url += "&type=" + encodeURIComponent(type);
    }
    return url;
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

module.exports = {
    resolveOnlineWatchHref,
    resolveReviewHref,
    resolveGameToPlayHref,
    canAccessPlayPage,
};
