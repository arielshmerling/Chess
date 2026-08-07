/**
 * Display preferences in the Preferences panel (full screen).
 */
(function () {
    "use strict";

    var mounted = false;
    var wired = false;
    var unsubscribeFullscreen = null;

    function Fullscreen() {
        return window.DesktopFullscreen;
    }

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    function isSupported() {
        var fs = Fullscreen();
        if (!fs || typeof fs.toggleFullscreen !== "function") {
            return false;
        }
        var el = document.documentElement;
        return !!(
            el.requestFullscreen
            || el.webkitRequestFullscreen
            || el.mozRequestFullScreen
            || el.msRequestFullscreen
        );
    }

    function syncUi() {
        var btn = document.getElementById("desktopPrefsFullscreenBtn");
        var fs = Fullscreen();
        if (!btn || !fs) {
            return;
        }
        var active = fs.isFullscreen();
        btn.textContent = active
            ? t("desktop.prefs.exitFullScreen")
            : t("desktop.prefs.enterFullScreen");
        btn.setAttribute("aria-pressed", active ? "true" : "false");
    }

    function onFullscreenChanged() {
        syncUi();
        if (window.DesktopBoardScale && typeof window.DesktopBoardScale.refresh === "function") {
            window.DesktopBoardScale.refresh();
        }
    }

    function buildMarkup() {
        if (!isSupported()) {
            return (
                '<p class="desktop-prefs-display-note">' +
                t("desktop.prefs.fullScreenUnavailable") +
                "</p>"
            );
        }
        return (
            '<button type="button" class="desktop-btn desktop-prefs-fullscreen-btn" ' +
            'id="desktopPrefsFullscreenBtn" aria-pressed="false">' +
            t("desktop.prefs.enterFullScreen") +
            "</button>"
        );
    }

    function wireEvents() {
        if (wired || !isSupported()) {
            return;
        }
        wired = true;

        var btn = document.getElementById("desktopPrefsFullscreenBtn");
        if (btn) {
            btn.addEventListener("click", function () {
                var fs = Fullscreen();
                if (!fs) {
                    return;
                }
                fs.toggleFullscreen().catch(function (err) {
                    console.warn("[Shmerling] Full screen toggle failed:", err);
                });
            });
        }

        if (unsubscribeFullscreen) {
            unsubscribeFullscreen();
        }
        var fsApi = Fullscreen();
        unsubscribeFullscreen = fsApi && typeof fsApi.onFullscreenChange === "function"
            ? fsApi.onFullscreenChange(onFullscreenChanged)
            : null;
    }

    function mount(container) {
        if (!container) {
            return;
        }
        if (!mounted) {
            container.innerHTML = buildMarkup();
            wireEvents();
            mounted = true;
        }
        syncUi();
    }

    function refresh() {
        if (!mounted) {
            return;
        }
        syncUi();
    }

    window.DesktopPrefsDisplay = {
        mount: mount,
        refresh: refresh,
    };
})();
