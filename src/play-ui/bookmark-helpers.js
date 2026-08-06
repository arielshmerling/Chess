/**
 * Bookmark naming and create-payload helpers for the Play shell.
 *
 * Pure shaping — the shell still posts to the API and owns ChessGame state.
 */
(function (global) {
    "use strict";

    const t =
        typeof module === "object" && module && module.exports
            ? require("../strings/t-bridge").t
            : typeof global.ShmerlingT === "function"
              ? global.ShmerlingT
              : function (key) {
                    return key;
                };

    function localizeStoredPlayerName(raw, fallbackKey) {
        if (raw == null || String(raw).trim() === "") {
            return t(fallbackKey);
        }
        const name = String(raw).trim();
        if (name === "Player") {
            return t("play.savedGames.player");
        }
        if (name === "White") {
            return t("common.white");
        }
        if (name === "Black") {
            return t("common.black");
        }
        if (name === "Engine") {
            return t("common.engine");
        }
        return name;
    }

    /**
     * @param {object|null|undefined} source
     * @returns {{ white: string, black: string }}
     */
    function sessionPlayerNames(source) {
        if (!source) {
            return { white: t("common.white"), black: t("common.black") };
        }
        return {
            white: localizeStoredPlayerName(source.whitePlayerName, "common.white"),
            black: localizeStoredPlayerName(source.blackPlayerName, "common.black"),
        };
    }

    /**
     * @param {object|null|undefined} source
     * @returns {string}
     */
    function formatPlayersVsTitle(source) {
        const names = sessionPlayerNames(source);
        return t("play.savedGames.playersVs", {
            white: names.white,
            black: names.black,
        });
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
        const names = sessionPlayerNames(session);
        return t("play.savedGames.manualSaveName", {
            white: names.white,
            black: names.black,
        });
    }

    /**
     * @param {Date} [now]
     * @returns {string}
     */
    function formatPositionSetupSaveName(now) {
        const date = now || new Date();
        const stamp = date.toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
        });
        return t("play.savedGames.positionSaveName", { when: stamp });
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
