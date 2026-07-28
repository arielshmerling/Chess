/**
 * Launch-option merge helpers for web Play Now / URL / stored prefs.
 *
 * Pure aside from the injected normalizeEngine callback.
 */
(function (global) {
    "use strict";

    /**
     * @param {string} raw
     * @param {object} options
     * @param {boolean} [options.promoteBrain41OnWeb]
     * @param {(engine: string) => string} [options.normalizeEngine]
     * @returns {string}
     */
    function normalizeLaunchEngine(raw, options) {
        const opts = options || {};
        const engine = typeof raw === "string" ? raw.trim() : "";
        if (engine === "brain43" || engine === "brain42") {
            return engine;
        }
        /* brain4 was never a desktop default; always promote. */
        if (engine === "brain4") {
            return "brain43";
        }
        /* brain41 was the previous web Play Now default — promote on web only. */
        if (engine === "brain41") {
            return opts.promoteBrain41OnWeb ? "brain43" : "brain41";
        }
        if (typeof opts.normalizeEngine === "function") {
            return opts.normalizeEngine(engine);
        }
        return engine;
    }

    /**
     * @param {object} target
     * @param {object|null|undefined} source
     * @param {object} [engineOptions] passed to normalizeLaunchEngine
     * @returns {object}
     */
    function mergeStored(target, source, engineOptions) {
        if (!source || typeof source !== "object") {
            return target;
        }
        if (source.color === "white" || source.color === "black") {
            target.color = source.color;
        }
        if (source.engine) {
            target.engine = normalizeLaunchEngine(source.engine, engineOptions);
        }
        const difficulty = Number(source.difficulty);
        if (Number.isFinite(difficulty) && difficulty >= 1 && difficulty <= 6) {
            target.thinkingTimeSeconds = difficulty;
            target.difficulty = difficulty;
        }
        const timeMinutes = Number(source.timeMinutes);
        if (Number.isFinite(timeMinutes) && timeMinutes >= 1 && timeMinutes <= 180) {
            target.timeMinutes = timeMinutes;
        }
        if (source.mouse === "drag" || source.mouse === "double") {
            target.mouse = source.mouse;
        }
        if (source.showAvailableMoves === true || source.showAvailableMoves === false) {
            target.showAvailableMoves = source.showAvailableMoves;
        }
        return target;
    }

    /**
     * @param {object} target
     * @param {string|URLSearchParams|null|undefined} search
     * @param {object} [engineOptions]
     * @returns {object}
     */
    function applyUrlSearch(target, search, engineOptions) {
        try {
            const params =
                search instanceof URLSearchParams
                    ? search
                    : new URLSearchParams(search || "");
            if (params.get("color") === "white" || params.get("color") === "black") {
                target.color = params.get("color");
            }
            if (params.get("engine")) {
                target.engine = normalizeLaunchEngine(params.get("engine"), engineOptions);
            }
            const difficulty = parseInt(params.get("difficulty"), 10);
            if (Number.isFinite(difficulty) && difficulty >= 1 && difficulty <= 6) {
                target.thinkingTimeSeconds = difficulty;
                target.difficulty = difficulty;
            }
            const timeMinutes = parseInt(params.get("timeMinutes"), 10);
            if (Number.isFinite(timeMinutes) && timeMinutes >= 1 && timeMinutes <= 180) {
                target.timeMinutes = timeMinutes;
            }
            const mouse = params.get("mouse");
            if (mouse === "drag" || mouse === "double") {
                target.mouse = mouse;
            }
            if (params.get("showMoves") === "1") {
                target.showAvailableMoves = true;
            } else if (params.get("showMoves") === "0") {
                target.showAvailableMoves = false;
            }
        } catch {
            /* ignore malformed query string */
        }
        return target;
    }

    /**
     * @param {string|URLSearchParams|null|undefined} search
     * @returns {boolean}
     */
    function wantsNewGameDialog(search) {
        try {
            const params =
                search instanceof URLSearchParams
                    ? search
                    : new URLSearchParams(search || "");
            return params.get("newGame") === "1";
        } catch {
            return false;
        }
    }

    /**
     * Online (or resume) game id from the Play URL.
     * @param {string|URLSearchParams|null|undefined} search
     * @returns {string|null}
     */
    function getGameIdFromSearch(search) {
        try {
            const params =
                search instanceof URLSearchParams
                    ? search
                    : new URLSearchParams(search || "");
            const id = params.get("id");
            if (id != null && String(id).trim() !== "") {
                return String(id).trim();
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Friend-invite join id (Prefer-Play treats as /play?id= after accept joins).
     * @param {string|URLSearchParams|null|undefined} search
     * @returns {string|null}
     */
    function getJoinGameIdFromSearch(search) {
        try {
            const params =
                search instanceof URLSearchParams
                    ? search
                    : new URLSearchParams(search || "");
            const id = params.get("joinGame");
            if (id != null && String(id).trim() !== "") {
                return String(id).trim();
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Optional shell mode from the Play URL (`watch` | `review` | `practice`).
     * @param {string|URLSearchParams|null|undefined} search
     * @returns {"watch"|"review"|"practice"|null}
     */
    function getModeFromSearch(search) {
        try {
            const params =
                search instanceof URLSearchParams
                    ? search
                    : new URLSearchParams(search || "");
            const mode = params.get("mode");
            if (mode === "watch" || mode === "review" || mode === "practice") {
                return mode;
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Review type from the Play URL (`history` | `pgn`).
     * @param {string|URLSearchParams|null|undefined} search
     * @returns {"history"|"pgn"|null}
     */
    function getReviewTypeFromSearch(search) {
        try {
            const params =
                search instanceof URLSearchParams
                    ? search
                    : new URLSearchParams(search || "");
            const type = params.get("type");
            if (type === "history" || type === "pgn") {
                return type;
            }
            return null;
        } catch {
            return null;
        }
    }

    const LaunchOptions = {
        normalizeLaunchEngine: normalizeLaunchEngine,
        mergeStored: mergeStored,
        applyUrlSearch: applyUrlSearch,
        wantsNewGameDialog: wantsNewGameDialog,
        getGameIdFromSearch: getGameIdFromSearch,
        getJoinGameIdFromSearch: getJoinGameIdFromSearch,
        getModeFromSearch: getModeFromSearch,
        getReviewTypeFromSearch: getReviewTypeFromSearch,
    };

    global.PlayLaunchOptions = LaunchOptions;

    if (typeof module === "object" && module && module.exports) {
        module.exports = LaunchOptions;
    }
})(typeof window !== "undefined" ? window : globalThis);
