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

    const ENGINE_OPTIONS = [
        { value: "brain42", label: ENGINE_LABELS.brain42 },
        { value: "brain41", label: ENGINE_LABELS.brain41 },
    ];

    const DEFAULTS = {
        color: "white",
        engine: "brain42",
        thinkingTimeSeconds: 10,
        mouse: "drag",
        showAvailableMoves: true,
        allowUndo: true,
        timeMinutes: 90,
    };

    const THINKING_TIME_OPTIONS = [2, 5, 10, 15, 20, 30, 60, 120];

    function normalizeThinkingTimeSeconds(value) {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed)) {
            return DEFAULTS.thinkingTimeSeconds;
        }
        if (THINKING_TIME_OPTIONS.indexOf(parsed) !== -1) {
            return parsed;
        }
        if (parsed >= 1 && parsed <= 6) {
            return THINKING_TIME_OPTIONS[Math.min(parsed - 1, THINKING_TIME_OPTIONS.length - 1)];
        }
        let nearest = THINKING_TIME_OPTIONS[0];
        let nearestDist = Math.abs(parsed - nearest);
        for (let i = 1; i < THINKING_TIME_OPTIONS.length; i += 1) {
            const dist = Math.abs(parsed - THINKING_TIME_OPTIONS[i]);
            if (dist < nearestDist) {
                nearest = THINKING_TIME_OPTIONS[i];
                nearestDist = dist;
            }
        }
        return nearest;
    }

    function migrateSavedOptions(raw) {
        const opts = Object.assign({}, DEFAULTS, raw || {});
        if (opts.thinkingTimeSeconds == null && opts.difficulty != null) {
            opts.thinkingTimeSeconds = normalizeThinkingTimeSeconds(opts.difficulty);
        } else {
            opts.thinkingTimeSeconds = normalizeThinkingTimeSeconds(opts.thinkingTimeSeconds);
        }
        return opts;
    }

    function loadLastOptions() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? migrateSavedOptions(JSON.parse(raw)) : Object.assign({}, DEFAULTS);
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
            thinkingTimeSeconds: normalizeThinkingTimeSeconds(
                opts.thinkingTimeSeconds != null ? opts.thinkingTimeSeconds : opts.difficulty,
            ),
            /** @deprecated alias — same value as thinkingTimeSeconds */
            difficulty: normalizeThinkingTimeSeconds(
                opts.thinkingTimeSeconds != null ? opts.thinkingTimeSeconds : opts.difficulty,
            ),
            gameTimeMinutes: opts.timeMinutes != null ? opts.timeMinutes : DEFAULTS.timeMinutes,
            mousePreference: opts.mouse || DEFAULTS.mouse,
            showAvailableMoves: opts.showAvailableMoves !== false,
            allowUndo: opts.allowUndo !== false,
            gameType: "SinglePlayerGame",
        };
    }

    function normalizeEngine(engine) {
        return ENGINE_OPTIONS.some(function (o) {
            return o.value === engine;
        })
            ? engine
            : DEFAULTS.engine;
    }

    window.DesktopGameSettings = {
        DEFAULTS,
        ENGINE_OPTIONS,
        THINKING_TIME_OPTIONS,
        loadLastOptions,
        saveLastOptions,
        buildSession,
        brainLabel,
        normalizeEngine,
        normalizeThinkingTimeSeconds,
    };
})();
