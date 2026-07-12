/**
 * Desktop shell: top bar (logo + preferences) on all /app/* pages.
 */
(function () {
    "use strict";

    function getHomeHref() {
        if (
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.getPlayHomeHref === "function"
        ) {
            return window.ShmerlingPlayShell.getPlayHomeHref();
        }
        return "/app/play";
    }

    var TOPBAR_HTML = [
        '<header class="desktop-topbar" role="banner">',
        '  <a href="' + getHomeHref() + '" class="desktop-topbar-logo" aria-label="Shmerling Chess home">',
        '    <img src="/images/shmerling.png" alt="">',
        "  </a>",
        '  <div class="desktop-topbar-spacer"></div>',
        '  <div class="desktop-topbar-actions">',
        '    <div class="desktop-prefs">',
        '      <button type="button" class="desktop-prefs-trigger" id="desktopPrefsTrigger"',
        '        aria-expanded="false" aria-controls="desktopPrefsPanel" aria-haspopup="dialog">',
        '        <span class="desktop-prefs-trigger-icon" aria-hidden="true">&#9881;</span>',
        '        <span class="desktop-prefs-trigger-label">Preferences</span>',
        "      </button>",
        '      <div class="desktop-prefs-panel" id="desktopPrefsPanel" role="dialog"',
        '        aria-labelledby="desktopPrefsTitle" hidden>',
        '        <h2 class="desktop-prefs-title" id="desktopPrefsTitle">Preferences</h2>',
        '        <section class="desktop-prefs-section desktop-prefs-section--theme">',
        '          <h3 class="desktop-prefs-section-title">Color theme</h3>',
        '          <div class="desktop-prefs-theme desktop-prefs-theme--builtin desktop-prefs-theme--compact" role="group" aria-label="Built-in themes">',
        '            <button type="button" class="desktop-theme-choice" data-theme="blue" aria-pressed="false">',
        '              <span class="desktop-theme-swatch desktop-theme-swatch--blue" aria-hidden="true"></span>',
        '              <span class="desktop-theme-name">Blue</span>',
        "            </button>",
        '            <button type="button" class="desktop-theme-choice" data-theme="dark" aria-pressed="false">',
        '              <span class="desktop-theme-swatch desktop-theme-swatch--dark" aria-hidden="true"></span>',
        '              <span class="desktop-theme-name">Dark</span>',
        "            </button>",
        "          </div>",
        '          <div id="desktopPrefsCustomThemes" class="desktop-prefs-theme desktop-prefs-theme--custom" role="group" aria-label="Saved custom themes"></div>',
        '          <button type="button" class="desktop-btn desktop-customize-theme-btn desktop-customize-theme-btn--compact" id="desktopCustomizeThemeBtn">Customize theme…</button>',
        "        </section>",
        '        <section class="desktop-prefs-section desktop-prefs-section--pieces">',
        '          <h3 class="desktop-prefs-section-title">Piece set</h3>',
        '          <div id="desktopPrefsPieceSets" class="desktop-prefs-piece-sets" role="group" aria-label="Piece sets"></div>',
        "        </section>",
        '        <section class="desktop-prefs-section desktop-prefs-section--gameplay">',
        '          <h3 class="desktop-prefs-section-title">Gameplay</h3>',
        '          <div id="desktopPrefsGameplay" class="desktop-prefs-gameplay"></div>',
        "        </section>",
        "      </div>",
        "    </div>",
        "  </div>",
        "</header>",
    ].join("");

    function mountTopbar() {
        if (document.querySelector(".desktop-topbar")) {
            return;
        }
        var wrap = document.createElement("div");
        wrap.innerHTML = TOPBAR_HTML;
        var bar = wrap.firstElementChild;
        if (!bar) {
            return;
        }
        document.body.insertBefore(bar, document.body.firstChild);
        document.body.classList.add("desktop-has-topbar");
        initPreferencesMenu();
    }

    function getCurrentThemeId() {
        return localStorage.getItem("theme") || "blue";
    }

    function initPreferencesMenu() {
        var trigger = document.getElementById("desktopPrefsTrigger");
        var panel = document.getElementById("desktopPrefsPanel");
        if (!trigger || !panel) {
            return;
        }

        function setOpen(open) {
            trigger.setAttribute("aria-expanded", open ? "true" : "false");
            panel.hidden = !open;
            if (open) {
                syncThemeButtons();
                refreshCustomThemeList();
                refreshPieceSetButtons();
                refreshGameplayPrefs();
            }
        }

        trigger.addEventListener("click", function (e) {
            e.stopPropagation();
            setOpen(panel.hidden);
        });

        document.addEventListener("click", function (e) {
            if (panel.hidden) {
                return;
            }
            var customPanel = document.getElementById("desktopCustomThemePanel");
            if (customPanel && !customPanel.hidden && customPanel.contains(e.target)) {
                return;
            }
            if (!panel.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
                setOpen(false);
            }
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !panel.hidden) {
                var customPanel = document.getElementById("desktopCustomThemePanel");
                if (customPanel && !customPanel.hidden) {
                    return;
                }
                setOpen(false);
                trigger.focus();
            }
        });

        panel.querySelectorAll(".desktop-prefs-theme--builtin [data-theme]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-theme");
                if (typeof window.applyDesktopTheme === "function") {
                    window.applyDesktopTheme(id === "dark" ? "dark" : "blue");
                }
                syncThemeButtons();
            });
        });

        var customizeBtn = document.getElementById("desktopCustomizeThemeBtn");
        if (customizeBtn) {
            customizeBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                if (window.DesktopCustomTheme && typeof window.DesktopCustomTheme.openEditor === "function") {
                    window.DesktopCustomTheme.openEditor();
                }
            });
        }

        document.addEventListener("shmerling-theme-changed", syncThemeButtons);
        document.addEventListener("shmerling-custom-themes-changed", refreshCustomThemeList);
        document.addEventListener("shmerling-piece-set-changed", refreshPieceSetButtons);
        document.addEventListener("shmerling-game-preferences-changed", refreshGameplayPrefs);
        syncThemeButtons();
        refreshCustomThemeList();
        refreshPieceSetButtons();
        mountGameplayPrefs();
    }

    function mountGameplayPrefs() {
        var container = document.getElementById("desktopPrefsGameplay");
        if (!container || !window.DesktopPrefsGameplay) {
            return;
        }
        window.DesktopPrefsGameplay.mount(container);
    }

    function refreshGameplayPrefs() {
        if (window.DesktopPrefsGameplay && typeof window.DesktopPrefsGameplay.refresh === "function") {
            window.DesktopPrefsGameplay.refresh();
        }
    }

    function refreshPieceSetButtons() {
        var container = document.getElementById("desktopPrefsPieceSets");
        if (!container || !window.ShmerlingPieceSets) {
            return;
        }
        if (!container.childElementCount) {
            window.ShmerlingPieceSets.renderPieceSetButtons(container);
        } else {
            window.ShmerlingPieceSets.syncPieceSetButtons(container);
        }
    }

    function refreshCustomThemeList() {
        var container = document.getElementById("desktopPrefsCustomThemes");
        if (!container || !window.DesktopCustomTheme) {
            return;
        }
        window.DesktopCustomTheme.renderSavedThemeButtons(container);
    }

    function syncThemeButtons() {
        var current = getCurrentThemeId();
        document.querySelectorAll(".desktop-prefs-theme--builtin [data-theme]").forEach(function (btn) {
            var theme = btn.getAttribute("data-theme");
            var active = current === theme;
            btn.setAttribute("aria-pressed", active ? "true" : "false");
            btn.classList.toggle("is-active", active);
        });
        document.querySelectorAll(".desktop-prefs-theme--custom [data-theme]").forEach(function (btn) {
            var theme = btn.getAttribute("data-theme");
            var active = current === theme;
            btn.setAttribute("aria-pressed", active ? "true" : "false");
            btn.classList.toggle("is-active", active);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mountTopbar);
    } else {
        mountTopbar();
    }
})();
