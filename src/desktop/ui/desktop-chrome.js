/**
 * Desktop shell: top bar (logo + preferences) on /app/* pages,
 * or preferences-only host (#webDesktopPrefsHost) on classic web pages.
 */
(function () {
    "use strict";

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    function getHomeHref() {
        if (
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.getPlayHomeHref === "function"
        ) {
            return window.ShmerlingPlayShell.getPlayHomeHref();
        }
        return "/app/play";
    }

    function buildPrefsHtml() {
        return [
        '<div class="desktop-prefs">',
        '  <button type="button" class="desktop-prefs-trigger" id="desktopPrefsTrigger"',
        '    aria-expanded="false" aria-controls="desktopPrefsPanel" aria-haspopup="dialog">',
        '    <span class="desktop-prefs-trigger-icon" aria-hidden="true">&#9881;</span>',
        '    <span class="desktop-prefs-trigger-label">' + t("desktop.chrome.preferences") + "</span>",
        "  </button>",
        '  <div class="desktop-prefs-panel" id="desktopPrefsPanel" role="dialog"',
        '    aria-labelledby="desktopPrefsTitle" hidden>',
        '    <h2 class="desktop-prefs-title" id="desktopPrefsTitle">' + t("desktop.chrome.preferences") + "</h2>",
        '    <section class="desktop-prefs-section desktop-prefs-section--theme">',
        '      <h3 class="desktop-prefs-section-title">' + t("desktop.chrome.boardTheme") + "</h3>",
        '      <div class="desktop-prefs-theme desktop-prefs-theme--builtin desktop-prefs-theme--compact" role="group" aria-label="' + t("desktop.chrome.builtInThemesAria") + '">',
        '        <button type="button" class="desktop-theme-choice" data-theme="blue" aria-pressed="false">',
        '          <span class="desktop-theme-swatch desktop-theme-swatch--blue" aria-hidden="true"></span>',
        '          <span class="desktop-theme-name">' + t("desktop.chrome.themeBlue") + '</span>',
        "        </button>",
        '        <button type="button" class="desktop-theme-choice" data-theme="dark" aria-pressed="false">',
        '          <span class="desktop-theme-swatch desktop-theme-swatch--dark" aria-hidden="true"></span>',
        '          <span class="desktop-theme-name">' + t("desktop.chrome.themeDark") + '</span>',
        "        </button>",
        "      </div>",
        '      <div id="desktopPrefsCustomThemes" class="desktop-prefs-theme desktop-prefs-theme--custom" role="group" aria-label="' + t("desktop.chrome.savedCustomThemesAria") + '"></div>',
        '      <button type="button" class="desktop-btn desktop-customize-theme-btn desktop-customize-theme-btn--compact" id="desktopCustomizeThemeBtn">' + t("desktop.chrome.customizeTheme") + "</button>",
        "    </section>",
        '    <section class="desktop-prefs-section desktop-prefs-section--pieces">',
        '      <h3 class="desktop-prefs-section-title">' + t("desktop.chrome.pieceSet") + "</h3>",
        '      <div id="desktopPrefsPieceSets" class="desktop-prefs-piece-sets" role="group" aria-label="' + t("desktop.chrome.pieceSetsAria") + '"></div>',
        "    </section>",
        '    <section class="desktop-prefs-section desktop-prefs-section--gameplay">',
        '      <h3 class="desktop-prefs-section-title">' + t("desktop.chrome.gameplay") + "</h3>",
        '      <div id="desktopPrefsGameplay" class="desktop-prefs-gameplay"></div>',
        "    </section>",
        '    <section class="desktop-prefs-section desktop-prefs-section--display">',
        '      <h3 class="desktop-prefs-section-title">' + t("desktop.chrome.display") + "</h3>",
        '      <div id="desktopPrefsDisplay" class="desktop-prefs-display"></div>',
        "    </section>",
        "  </div>",
        "</div>",
    ].join("");
    }

    function buildTopbarHtml() {
        return [
        '<header class="desktop-topbar" role="banner">',
        '  <a href="' + getHomeHref() + '" class="desktop-topbar-logo" aria-label="' + t("desktop.chrome.homeAria") + '">',
        '    <img src="/images/shmerling.png" alt="">',
        "  </a>",
        '  <div class="desktop-topbar-spacer"></div>',
        '  <div class="desktop-topbar-actions">',
        buildPrefsHtml(),
        "  </div>",
        "</header>",
    ].join("");
    }

    function mountPreferencesInto(host) {
        if (!host || document.getElementById("desktopPrefsTrigger")) {
            return false;
        }
        host.innerHTML = buildPrefsHtml();
        initPreferencesMenu();
        return true;
    }

    function initWebUserMenu() {
        var trigger = document.getElementById("webUserMenuTrigger");
        var panel = document.getElementById("webUserMenuPanel");
        var preferencesAction = document.getElementById("webUserPreferencesAction");
        if (!trigger || !panel || trigger.dataset.menuBound === "1") {
            return;
        }
        trigger.dataset.menuBound = "1";

        function setOpen(open) {
            trigger.setAttribute("aria-expanded", open ? "true" : "false");
            panel.hidden = !open;
        }

        trigger.addEventListener("click", function (event) {
            event.stopPropagation();
            setOpen(panel.hidden);
        });

        if (preferencesAction) {
            preferencesAction.addEventListener("click", function (event) {
                event.stopPropagation();
                setOpen(false);
                var preferencesTrigger = document.getElementById("desktopPrefsTrigger");
                if (preferencesTrigger) {
                    preferencesTrigger.click();
                }
            });
        }

        document.addEventListener("click", function (event) {
            if (!panel.hidden && !panel.contains(event.target) && !trigger.contains(event.target)) {
                setOpen(false);
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !panel.hidden) {
                setOpen(false);
                trigger.focus();
            }
        });
    }

    function mountTopbar() {
        var host = document.getElementById("webDesktopPrefsHost");
        if (host) {
            mountPreferencesInto(host);
            initWebUserMenu();
            return;
        }
        /* Classic web pages already have #header — never inject a second top bar. */
        if (document.getElementById("header")) {
            return;
        }
        if (document.querySelector(".desktop-topbar")) {
            return;
        }
        var wrap = document.createElement("div");
        wrap.innerHTML = buildTopbarHtml();
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
        if (trigger.dataset.prefsBound === "1") {
            return;
        }
        trigger.dataset.prefsBound = "1";

        function setOpen(open) {
            trigger.setAttribute("aria-expanded", open ? "true" : "false");
            panel.hidden = !open;
            if (open) {
                syncThemeButtons();
                refreshCustomThemeList();
                refreshPieceSetButtons();
                refreshGameplayPrefs();
                refreshDisplayPrefs();
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
                if (!canCustomizeThemeUi()) {
                    return;
                }
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
        mountDisplayPrefs();
        resolveCustomizeThemeAccess();
    }

    function canCustomizeThemeUi() {
        if (
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.isElectronPlayPage === "function"
            && window.ShmerlingPlayShell.isElectronPlayPage()
        ) {
            return true;
        }
        if (typeof window.__SHMERLING_CAN_CUSTOMIZE_THEMES__ === "boolean") {
            return window.__SHMERLING_CAN_CUSTOMIZE_THEMES__;
        }
        if (typeof window.__SHMERLING_PLAY_ADVANCED__ === "boolean") {
            return window.__SHMERLING_PLAY_ADVANCED__;
        }
        return false;
    }

    function applyCustomizeThemeButtonVisibility(allowed) {
        var btn = document.getElementById("desktopCustomizeThemeBtn");
        if (!btn) {
            return;
        }
        btn.hidden = !allowed;
    }

    function resolveCustomizeThemeAccess() {
        if (canCustomizeThemeUi()) {
            applyCustomizeThemeButtonVisibility(true);
            return;
        }
        var isWebPlay =
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.isWebPlayPage === "function"
            && window.ShmerlingPlayShell.isWebPlayPage();
        if (!isWebPlay) {
            applyCustomizeThemeButtonVisibility(false);
            return;
        }
        /* /play has no boilerplate flags — ask launch-context. */
        applyCustomizeThemeButtonVisibility(false);
        fetch("/api/play/launch-context", {
            credentials: "same-origin",
            headers: { Accept: "application/json" },
        })
            .then(function (res) {
                return res.ok ? res.json() : null;
            })
            .then(function (ctx) {
                var allowed = !!(ctx && (ctx.canCustomizeThemes || ctx.canPlayAdvanced));
                window.__SHMERLING_CAN_CUSTOMIZE_THEMES__ = allowed;
                applyCustomizeThemeButtonVisibility(allowed);
            })
            .catch(function () {
                applyCustomizeThemeButtonVisibility(false);
            });
    }

    function mountDisplayPrefs() {
        var container = document.getElementById("desktopPrefsDisplay");
        if (!container || !window.DesktopPrefsDisplay) {
            return;
        }
        window.DesktopPrefsDisplay.mount(container);
    }

    function refreshDisplayPrefs() {
        if (window.DesktopPrefsDisplay && typeof window.DesktopPrefsDisplay.refresh === "function") {
            window.DesktopPrefsDisplay.refresh();
        }
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

    window.DesktopChrome = {
        mountTopbar: mountTopbar,
        mountPreferencesInto: mountPreferencesInto,
        initPreferencesMenu: initPreferencesMenu,
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mountTopbar);
    } else {
        mountTopbar();
    }
})();
