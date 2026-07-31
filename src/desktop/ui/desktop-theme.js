/**
 * Desktop theme picker (uses global setDefaultTheme / themes from /themes.js).
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

    function rememberActiveTheme(themeId) {
        try {
            localStorage.setItem("theme", themeId);
        } catch {
            /* ignore */
        }
        if (window.DesktopCustomTheme && typeof window.DesktopCustomTheme.setActiveTheme === "function") {
            window.DesktopCustomTheme.setActiveTheme(themeId);
        }
    }

    function applyCustomThemeById(customId) {
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
        rememberActiveTheme("custom:" + customId);
        dispatchThemeChanged("custom:" + customId);
        return true;
    }

    function applyEmergencyTheme() {
        if (typeof setDefaultTheme === "function" && typeof themes !== "undefined") {
            setDefaultTheme(themes.blueTheme);
        }
        dispatchThemeChanged(null);
    }

    function applyThemeById(themeId) {
        if (typeof setDefaultTheme !== "function" || typeof themes === "undefined") {
            return;
        }
        if (themeId === "blue" || themeId === "dark") {
            themeId = "custom:" + themeId;
        }
        if (themeId && themeId.indexOf("custom:") === 0) {
            if (!applyCustomThemeById(themeId.slice(7))) {
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
                : localStorage.getItem("theme") || "custom:blue";
        applyThemeById(theme);
    }

    window.applyDesktopTheme = applyThemeById;

    function start() {
        if (window.DesktopCustomTheme && typeof window.DesktopCustomTheme.whenReady === "function") {
            window.DesktopCustomTheme.whenReady().then(bootTheme);
            return;
        }
        bootTheme();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
