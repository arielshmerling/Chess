/**
 * New-game options and persistent gameplay preferences.
 */
(function () {
    "use strict";

    const STORAGE_KEY = "shmerling.desktop.lastGameOptions";
    const GUEST_NAME = "Player";

    const ENGINE_LABELS = {
        brain43: "Brain 4.3",
        brain42: "Brain 4.2",
        brain41: "Brain 4.1",
    };

    const ENGINE_OPTIONS = [
        { value: "brain43", label: ENGINE_LABELS.brain43 },
        { value: "brain42", label: ENGINE_LABELS.brain42 },
        { value: "brain41", label: ENGINE_LABELS.brain41 },
    ];

    const DEFAULTS = {
        color: "white",
        engine: "brain43",
        thinkingTimeSeconds: 10,
        mouse: "drag",
        showAvailableMoves: true,
        allowUndo: true,
        immediateResign: false,
        timeMinutes: 90,
    };

    const THINKING_TIME_OPTIONS = [2, 5, 10, 15, 20, 30, 60, 120];

    let cachedGamePrefs = null;
    let serverBootStarted = false;

    function isDesktopApp() {
        if (
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.shouldPersistPlayPrefsToServer === "function"
        ) {
            return window.ShmerlingPlayShell.shouldPersistPlayPrefsToServer();
        }
        if (typeof window === "undefined" || !window.location) {
            return false;
        }
        return window.location.pathname.indexOf("/app") === 0;
    }

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

    function normalizeGamePreferences(prefs) {
        const input = prefs && typeof prefs === "object" ? prefs : {};
        return {
            mouse: input.mouse === "double" ? "double" : "drag",
            thinkingTimeSeconds: normalizeThinkingTimeSeconds(input.thinkingTimeSeconds),
            showAvailableMoves: input.showAvailableMoves !== false,
            immediateResign: input.immediateResign === true,
        };
    }

    function rememberGamePreferences(prefs) {
        cachedGamePrefs = normalizeGamePreferences(prefs);
    }

    function readStoredOptions() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    function writeStoredOptions(opts) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
        } catch {
            /* ignore */
        }
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

    function loadGamePreferences() {
        if (cachedGamePrefs) {
            return Object.assign({}, cachedGamePrefs);
        }
        const stored = migrateSavedOptions(readStoredOptions());
        return normalizeGamePreferences({
            mouse: stored.mouse,
            thinkingTimeSeconds: stored.thinkingTimeSeconds,
            showAvailableMoves: stored.showAvailableMoves,
            immediateResign: stored.immediateResign,
        });
    }

    function persistGamePreferencesToServer(prefs) {
        if (!isDesktopApp()) {
            return;
        }
        fetch("/app/api/ui-settings", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ gamePreferences: normalizeGamePreferences(prefs) }),
        }).catch(function () {
            /* ignore */
        });
    }

    function notifyGamePreferencesChanged(prefs) {
        if (typeof document === "undefined") {
            return;
        }
        document.dispatchEvent(
            new CustomEvent("shmerling-game-preferences-changed", {
                detail: normalizeGamePreferences(prefs),
            })
        );
    }

    function saveGamePreferences(partial) {
        const next = normalizeGamePreferences(Object.assign({}, loadGamePreferences(), partial || {}));
        rememberGamePreferences(next);
        const stored = migrateSavedOptions(readStoredOptions());
        writeStoredOptions(Object.assign({}, stored, next));
        persistGamePreferencesToServer(next);
        notifyGamePreferencesChanged(next);
        return next;
    }

    function persistLastGameOptionsToServer(opts) {
        // Mongo lastGameOptions is a web User field; desktop Electron keeps localStorage only.
        const isWebPlay =
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.isWebPlayPage === "function"
            && window.ShmerlingPlayShell.isWebPlayPage();
        if (!isWebPlay) {
            return;
        }
        const payload = {
            color: opts.color === "black" ? "black" : "white",
            engine: normalizeEngine(opts.engine),
            difficulty: normalizeThinkingTimeSeconds(
                opts.thinkingTimeSeconds != null ? opts.thinkingTimeSeconds : opts.difficulty,
            ),
            mouse: opts.mouse === "double" ? "double" : "drag",
            showAvailableMoves: opts.showAvailableMoves !== false,
            timeMinutes:
                typeof opts.timeMinutes === "number" && opts.timeMinutes >= 1
                    ? opts.timeMinutes
                    : DEFAULTS.timeMinutes,
            isPrivate: opts.isPrivate === true,
        };
        fetch("/api/play/last-game-options", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        }).catch(function () {
            /* ignore */
        });
    }

    function loadLastOptions() {
        const stored = migrateSavedOptions(readStoredOptions());
        const gamePrefs = loadGamePreferences();
        return Object.assign({}, stored, gamePrefs);
    }

    function saveLastOptions(opts) {
        const gamePrefs = loadGamePreferences();
        const merged = Object.assign({}, opts, gamePrefs);
        writeStoredOptions(merged);
    }

    function saveNewGameOptions(opts) {
        const stored = migrateSavedOptions(readStoredOptions());
        const gamePrefs = loadGamePreferences();
        const merged = Object.assign({}, stored, gamePrefs, {
            color: opts.color,
            engine: opts.engine,
            allowUndo: opts.allowUndo,
            timeMinutes: opts.timeMinutes,
            mouse: opts.mouse,
            thinkingTimeSeconds: opts.thinkingTimeSeconds,
            showAvailableMoves: opts.showAvailableMoves,
            difficulty: opts.difficulty,
        });
        writeStoredOptions(merged);
        persistLastGameOptionsToServer(merged);
    }

    function loadGamePreferencesFromServer() {
        if (!isDesktopApp()) {
            return Promise.resolve();
        }
        return fetch("/app/api/ui-settings", {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
        })
            .then(function (res) {
                if (!res.ok) {
                    return null;
                }
                return res.json();
            })
            .then(function (data) {
                if (data && data.gamePreferences) {
                    const next = normalizeGamePreferences(data.gamePreferences);
                    rememberGamePreferences(next);
                    const stored = migrateSavedOptions(readStoredOptions());
                    writeStoredOptions(Object.assign({}, stored, next));
                    notifyGamePreferencesChanged(next);
                }
            })
            .catch(function () {
                /* ignore */
            });
    }

    function bootGamePreferences() {
        if (serverBootStarted || typeof document === "undefined") {
            return;
        }
        serverBootStarted = true;
        loadGamePreferencesFromServer();
    }

    function brainLabel(engine) {
        return ENGINE_LABELS[engine] || "Engine";
    }

    /** Session metadata for headers / bookmarks (replaces server gameInfo). */
    function buildSession(opts) {
        const humanWhite = opts.color !== "black";
        const engineName = brainLabel(opts.engine);
        const displayName = opts.username || GUEST_NAME;
        return {
            username: displayName,
            whitePlayerName: humanWhite ? displayName : engineName,
            blackPlayerName: humanWhite ? engineName : displayName,
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

    if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", bootGamePreferences);
        } else {
            bootGamePreferences();
        }
    }

    window.DesktopGameSettings = {
        DEFAULTS,
        ENGINE_OPTIONS,
        THINKING_TIME_OPTIONS,
        loadLastOptions,
        saveLastOptions,
        saveNewGameOptions,
        loadGamePreferences,
        saveGamePreferences,
        loadGamePreferencesFromServer,
        buildSession,
        brainLabel,
        normalizeEngine,
        normalizeThinkingTimeSeconds,
    };
})();
