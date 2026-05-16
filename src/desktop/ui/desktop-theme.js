/**
 * Desktop theme picker (uses global setDefaultTheme / themes from /themes.js).
 */
(function () {
    "use strict";

    function applyThemeById(themeId) {
        if (typeof setDefaultTheme !== "function" || typeof themes === "undefined") {
            return;
        }
        if (themeId === "blue") {
            setDefaultTheme(themes.blueTheme);
            localStorage.setItem("theme", "blue");
        } else {
            setDefaultTheme(themes.darkTheme);
            localStorage.setItem("theme", "dark");
        }
        document.dispatchEvent(
            new CustomEvent("shmerling-theme-changed", { detail: { theme: themeId === "blue" ? "blue" : "dark" } })
        );
    }

    function ensureDefaultTheme() {
        var theme = localStorage.getItem("theme");
        if (theme !== "blue" && theme !== "dark") {
            localStorage.setItem("theme", "blue");
            if (typeof setDefaultTheme === "function" && typeof themes !== "undefined") {
                setDefaultTheme(themes.blueTheme);
            }
        }
    }

    window.applyDesktopTheme = applyThemeById;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ensureDefaultTheme);
    } else {
        ensureDefaultTheme();
    }
})();
