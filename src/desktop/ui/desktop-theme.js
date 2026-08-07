/**
 * Desktop theme picker (uses global setDefaultTheme / themes from /themes.js).
 * Applies cached theme immediately; refreshes again when custom-theme store is ready.
 */
(function () {
    "use strict";

    function dispatchThemeChanged(themeId) {
        document.dispatchEvent(
            new CustomEvent("shmerling-theme-changed", {
                detail: { theme: themeId },
            })
        );
    }

    function rememberActiveTheme(themeId, persist) {
        try {
            localStorage.setItem("theme", themeId);
        } catch {
            /* ignore */
        }
        if (
            persist &&
            window.DesktopCustomTheme &&
            typeof window.DesktopCustomTheme.setActiveTheme === "function"
        ) {
            window.DesktopCustomTheme.setActiveTheme(themeId);
        }
    }

    function applyCustomThemeById(customId, persist) {
        if (!window.DesktopCustomTheme) {
            return false;
        }
        var entry = window.DesktopCustomTheme.getThemeById(customId);
        if (!entry || !entry.vars) {
            return false;
        }
        if (typeof setDefaultTheme === "function") {
            setDefaultTheme(entry.vars);
        }
        rememberActiveTheme("custom:" + customId, !!persist);
        dispatchThemeChanged("custom:" + customId);
        return true;
    }

    function applyEmergencyTheme() {
        if (typeof setDefaultTheme === "function" && typeof themes !== "undefined") {
            setDefaultTheme(themes.darkTheme);
        }
        dispatchThemeChanged(null);
    }

    function applyThemeById(themeId, options) {
        var persist = !!(options && options.persist);
        if (typeof setDefaultTheme !== "function" || typeof themes === "undefined") {
            return;
        }
        if (themeId === "blue" || themeId === "dark") {
            themeId = "custom:" + themeId;
        }
        if (themeId && themeId.indexOf("custom:") === 0) {
            if (!applyCustomThemeById(themeId.slice(7), persist)) {
                if (window.PlayBoot && typeof window.PlayBoot.applyCachedTheme === "function") {
                    if (window.PlayBoot.applyCachedTheme()) {
                        return;
                    }
                }
                applyEmergencyTheme();
            }
            return;
        }
        applyEmergencyTheme();
    }

    function bootTheme() {
        var theme =
            window.DesktopCustomTheme && window.DesktopCustomTheme.getActiveTheme
                ? window.DesktopCustomTheme.getActiveTheme()
                : localStorage.getItem("theme") || "custom:custom-mr45iwvr";
        applyThemeById(theme, { persist: false });
        if (window.PlayBoot && typeof window.PlayBoot.mark === "function") {
            window.PlayBoot.mark("theme-applied");
        }
    }

    window.applyDesktopTheme = function (themeId) {
        applyThemeById(themeId, { persist: true });
    };

    function start() {
        bootTheme();
        if (window.DesktopCustomTheme && typeof window.DesktopCustomTheme.whenReady === "function") {
            window.DesktopCustomTheme.whenReady().then(bootTheme);
        }
        /* Catalog often arrives after whenReady's early local-cache resolve — re-apply then. */
        document.addEventListener("shmerling-custom-themes-changed", function () {
            bootTheme();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
