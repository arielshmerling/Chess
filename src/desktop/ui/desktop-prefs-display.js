/**
 * Display preferences in the Preferences panel (full screen).
 */
(function () {
    "use strict";

    var Fullscreen = window.DesktopFullscreen;
    var mounted = false;
    var wired = false;
    var unsubscribeFullscreen = null;

    function isSupported() {
        if (!Fullscreen || typeof Fullscreen.toggleFullscreen !== "function") {
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
        if (!btn || !Fullscreen) {
            return;
        }
        var active = Fullscreen.isFullscreen();
        btn.textContent = active ? "Exit full screen" : "Enter full screen";
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
                '<p class="desktop-prefs-display-note">Full screen is not available in this browser.</p>'
            );
        }
        return (
            '<button type="button" class="desktop-btn desktop-prefs-fullscreen-btn" ' +
            'id="desktopPrefsFullscreenBtn" aria-pressed="false">Enter full screen</button>'
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
                Fullscreen.toggleFullscreen().catch(function (err) {
                    console.warn("[Shmerling] Full screen toggle failed:", err);
                });
            });
        }

        if (unsubscribeFullscreen) {
            unsubscribeFullscreen();
        }
        unsubscribeFullscreen = Fullscreen.onFullscreenChange(onFullscreenChanged);
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
