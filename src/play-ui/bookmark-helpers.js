/**
 * Bookmark naming and create-payload helpers for the Play shell.
 *
 * Pure shaping — the shell still posts to the API and owns ChessGame state.
 */
(function (global) {
    "use strict";

    /**
     * @param {object|null|undefined} source
     * @returns {{ white: string, black: string }}
     */
    function sessionPlayerNames(source) {
        if (!source) {
            return { white: "White", black: "Black" };
        }
        return {
            white: source.whitePlayerName || "White",
            black: source.blackPlayerName || "Black",
        };
    }

    /**
     * @param {object|null|undefined} source
     * @returns {string}
     */
    function formatPlayersVsTitle(source) {
        const names = sessionPlayerNames(source);
        return names.white + " vs. " + names.black;
    }

    /**
     * @param {object|null|undefined} session
     * @returns {string}
     */
    function formatAutoSaveGameName(session) {
        return formatPlayersVsTitle(session);
    }

    /**
     * @param {object|null|undefined} session
     * @returns {string}
     */
    function formatManualSaveGameName(session) {
        return "Saved — " + formatPlayersVsTitle(session);
    }

    /**
     * @param {Date} [now]
     * @param {{ toLocaleString?: Function }} [dateLike]
     * @returns {string}
     */
    function formatPositionSetupSaveName(now) {
        const date = now || new Date();
        const stamp = date.toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
        });
        return "Position — " + stamp;
    }

    /**
     * Thinking-time / depth field used on bookmark payloads.
     *
     * @param {object|null|undefined} session
     * @param {number} [fallback=10]
     * @returns {number}
     */
    function thinkingOrDepth(session, fallback) {
        const fb = fallback == null ? 10 : fallback;
        if (session && typeof session.thinkingTimeSeconds === "number") {
            return session.thinkingTimeSeconds;
        }
        if (session && typeof session.difficulty === "number") {
            return session.difficulty;
        }
        return fb;
    }

    /**
     * @param {object} input
     * @param {object} input.gameState
     * @param {string} input.name
     * @param {Array} [input.moves]
     * @param {object|null|undefined} input.session
     * @param {string|null|undefined} [input.originState]
     * @returns {object}
     */
    function buildCreatePayload(input) {
        const src = input || {};
        const session = src.session || {};
        const players = sessionPlayerNames(session);
        const depth = thinkingOrDepth(session, 10);
        const payload = {
            gameState: src.gameState,
            name: src.name,
            gameType: "SinglePlayerGame",
            moves: src.moves || [],
            engine: session.engine || "brain43",
            whitePlayerName: players.white,
            blackPlayerName: players.black,
            thinkingTimeSeconds: depth,
            depth: depth,
        };
        if (src.originState) {
            payload.originState = src.originState;
        }
        return payload;
    }

    const BookmarkHelpers = {
        sessionPlayerNames: sessionPlayerNames,
        formatPlayersVsTitle: formatPlayersVsTitle,
        formatAutoSaveGameName: formatAutoSaveGameName,
        formatManualSaveGameName: formatManualSaveGameName,
        formatPositionSetupSaveName: formatPositionSetupSaveName,
        thinkingOrDepth: thinkingOrDepth,
        buildCreatePayload: buildCreatePayload,
    };

    global.PlayBookmarkHelpers = BookmarkHelpers;

    if (typeof module === "object" && module && module.exports) {
        module.exports = BookmarkHelpers;
    }
})(typeof window !== "undefined" ? window : globalThis);
