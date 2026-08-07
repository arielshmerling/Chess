/**
 * First Play script: apply cached theme before other assets, expose boot timeline + overlay API.
 * Must stay tiny and free of other module deps (CSP-safe external file).
 */
(function () {
    "use strict";

    var THEME_VARS_KEY = "shmerling.themeVars";
    var CUSTOM_THEMES_KEY = "shmerling.desktop.customThemes";
    var t0 =
        typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now();
    var marks = {};

    function mark(name) {
        var now =
            typeof performance !== "undefined" && performance.now
                ? performance.now()
                : Date.now();
        marks[name] = Math.round(now - t0);
        try {
            if (typeof console !== "undefined" && console.info) {
                console.info("[play-boot]", name, marks[name] + "ms");
            }
        } catch {
            /* ignore */
        }
        return marks[name];
    }

    function applyVars(vars) {
        if (!vars || typeof vars !== "object") {
            return false;
        }
        var root = document.documentElement;
        var keys = Object.keys(vars);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (typeof vars[key] === "string") {
                root.style.setProperty(key, vars[key]);
            }
        }
        return keys.length > 0;
    }

    function applyCachedTheme() {
        try {
            var rawVars = localStorage.getItem(THEME_VARS_KEY);
            if (rawVars) {
                var parsedVars = JSON.parse(rawVars);
                if (applyVars(parsedVars)) {
                    mark("theme-vars-cache");
                    return true;
                }
            }
        } catch {
            /* ignore */
        }
        try {
            var themeId = localStorage.getItem("theme") || "";
            var customId =
                themeId.indexOf("custom:") === 0 ? themeId.slice(7) : null;
            if (!customId) {
                return false;
            }
            var rawStore = localStorage.getItem(CUSTOM_THEMES_KEY);
            if (!rawStore) {
                return false;
            }
            var store = JSON.parse(rawStore);
            var themes = store && Array.isArray(store.themes) ? store.themes : [];
            for (var i = 0; i < themes.length; i++) {
                if (themes[i] && themes[i].id === customId && themes[i].vars) {
                    if (applyVars(themes[i].vars)) {
                        mark("theme-custom-cache");
                        return true;
                    }
                }
            }
        } catch {
            /* ignore */
        }
        return false;
    }

    function setBootMessage(message, percent) {
        var msgEl = document.getElementById("playBootMessage");
        var barEl = document.getElementById("playBootBar");
        var overlay = document.getElementById("playBootOverlay");
        if (overlay) {
            overlay.hidden = false;
            overlay.setAttribute("aria-hidden", "false");
        }
        if (msgEl && typeof message === "string" && message) {
            msgEl.textContent = message;
        }
        if (barEl && typeof percent === "number" && !isNaN(percent)) {
            var pct = Math.max(0, Math.min(100, percent));
            barEl.style.width = pct + "%";
        }
    }

    function doneBoot() {
        mark("boot-done");
        var overlay = document.getElementById("playBootOverlay");
        if (!overlay) {
            return;
        }
        overlay.classList.add("play-boot-overlay--done");
        window.setTimeout(function () {
            overlay.hidden = true;
            overlay.setAttribute("aria-hidden", "true");
            overlay.classList.remove("play-boot-overlay--done");
        }, 180);
    }

    applyCachedTheme();
    mark("early-boot");

    /* Overlap Mongo prefs fetch with deferred shell download. */
    try {
        window.__SHMERLING_LAUNCH_CONTEXT_PREFETCH__ = fetch("/api/play/launch-context", {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
        })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error("launch-context " + res.status);
                }
                return res.json();
            })
            .then(function (data) {
                mark("launch-context-prefetch");
                return data;
            })
            .catch(function (err) {
                mark("launch-context-prefetch-failed");
                return null;
            });
    } catch {
        window.__SHMERLING_LAUNCH_CONTEXT_PREFETCH__ = Promise.resolve(null);
    }

    window.PlayBoot = {
        mark: mark,
        marks: marks,
        t0: t0,
        set: setBootMessage,
        done: doneBoot,
        applyCachedTheme: applyCachedTheme,
    };
})();
