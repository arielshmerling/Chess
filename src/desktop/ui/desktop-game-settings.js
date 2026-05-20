/**
 * Local new-game options (no server session).
 */
(function () {
    "use strict";

    const STORAGE_KEY = "shmerling.desktop.lastGameOptions";
    const GUEST_NAME = "Player";

    const ENGINE_LABELS = {
        brain42: "Brain 4.2",
        brain41: "Brain 4.1",
    };

    const DEFAULTS = {
        color: "white",
        engine: "brain42",
        difficulty: 3,
        mouse: "drag",
        showAvailableMoves: true,
        allowUndo: true,
        timeMinutes: 90,
    };

    function loadLastOptions() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? Object.assign({}, DEFAULTS, JSON.parse(raw)) : Object.assign({}, DEFAULTS);
        } catch {
            return Object.assign({}, DEFAULTS);
        }
    }

    function saveLastOptions(opts) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
        } catch {
            /* ignore */
        }
    }

    function brainLabel(engine) {
        return ENGINE_LABELS[engine] || "Engine";
    }

    /** Session metadata for headers / bookmarks (replaces server gameInfo). */
    function buildSession(opts) {
        const humanWhite = opts.color !== "black";
        const engineName = brainLabel(opts.engine);
        return {
            username: GUEST_NAME,
            whitePlayerName: humanWhite ? GUEST_NAME : engineName,
            blackPlayerName: humanWhite ? engineName : GUEST_NAME,
            engine: opts.engine || DEFAULTS.engine,
            difficulty: opts.difficulty != null ? opts.difficulty : DEFAULTS.difficulty,
            gameTimeMinutes: opts.timeMinutes != null ? opts.timeMinutes : DEFAULTS.timeMinutes,
            mousePreference: opts.mouse || DEFAULTS.mouse,
            showAvailableMoves: opts.showAvailableMoves !== false,
            allowUndo: opts.allowUndo !== false,
            gameType: "SinglePlayerGame",
        };
    }

    window.DesktopGameSettings = {
        DEFAULTS,
        loadLastOptions,
        saveLastOptions,
        buildSession,
        brainLabel,
    };
})();
