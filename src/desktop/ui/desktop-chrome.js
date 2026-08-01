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
        '    <div class="desktop-prefs-header">',
        '      <h2 class="desktop-prefs-title" id="desktopPrefsTitle">' + t("desktop.chrome.preferences") + "</h2>",
        '      <button type="button" class="desktop-prefs-close" id="desktopPrefsClose"',
        '        aria-label="' + t("desktop.chrome.closePreferences") + '">×</button>',
        "    </div>",
        '    <div class="desktop-prefs-row desktop-prefs-row--meta">',
        '      <section class="desktop-prefs-section desktop-prefs-section--language">',
        '        <h3 class="desktop-prefs-section-title">' + t("desktop.prefs.language") + "</h3>",
        '        <div id="desktopPrefsLanguage" class="desktop-prefs-language-host"></div>',
        "      </section>",
        '      <section class="desktop-prefs-section desktop-prefs-section--display">',
        '        <h3 class="desktop-prefs-section-title">' + t("desktop.chrome.display") + "</h3>",
        '        <div id="desktopPrefsDisplay" class="desktop-prefs-display"></div>',
        "      </section>",
        "    </div>",
        '    <div class="desktop-prefs-row desktop-prefs-row--boards">',
        '      <section class="desktop-prefs-section desktop-prefs-section--theme">',
        '        <h3 class="desktop-prefs-section-title">' + t("desktop.chrome.boardTheme") + "</h3>",
        '        <div id="desktopPrefsThemes" class="desktop-prefs-theme desktop-prefs-theme--all" role="group" aria-label="' + t("desktop.chrome.boardTheme") + '"></div>',
        '        <button type="button" class="desktop-btn desktop-customize-theme-btn desktop-customize-theme-btn--compact" id="desktopCustomizeThemeBtn">' + t("desktop.chrome.customizeTheme") + "</button>",
        "      </section>",
        '      <section class="desktop-prefs-section desktop-prefs-section--pieces">',
        '        <h3 class="desktop-prefs-section-title">' + t("desktop.chrome.pieceSet") + "</h3>",
        '        <div id="desktopPrefsPieceSets" class="desktop-prefs-piece-sets" role="group" aria-label="' + t("desktop.chrome.pieceSetsAria") + '"></div>',
        "      </section>",
        "    </div>",
        '    <section class="desktop-prefs-section desktop-prefs-section--gameplay">',
        '      <h3 class="desktop-prefs-section-title">' + t("desktop.chrome.gameplay") + "</h3>",
        '      <div id="desktopPrefsGameplay" class="desktop-prefs-gameplay"></div>',
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
        '  <div id="desktopTopbarGameActions" class="desktop-topbar-game-actions" hidden></div>',
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
        var current = localStorage.getItem("theme") || "custom:blue";
        return current === "blue" || current === "dark" ? "custom:" + current : current;
    }

    function positionPreferencesPanel(trigger, panel) {
        var margin = 12;
        var gap = 8;
        var viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        var viewportHeight = document.documentElement.clientHeight || window.innerHeight;
        var triggerRect = trigger.getBoundingClientRect();
        var initialPanelRect = panel.getBoundingClientRect();
        var triggerIsVisible = triggerRect.width > 0 && triggerRect.height > 0;

        panel.style.position = "fixed";
        panel.style.right = "auto";
        panel.style.left = margin + "px";
        panel.style.top = margin + "px";
        panel.style.maxWidth = Math.max(0, viewportWidth - (margin * 2)) + "px";
        panel.style.maxHeight = Math.max(0, viewportHeight - (margin * 2)) + "px";

        var panelRect = panel.getBoundingClientRect();
        var isRtl = document.documentElement.getAttribute("dir") === "rtl";
        var preferredLeft = triggerIsVisible
            ? (isRtl ? triggerRect.left : triggerRect.right - panelRect.width)
            : initialPanelRect.left;
        var maxLeft = Math.max(margin, viewportWidth - panelRect.width - margin);
        var left = Math.min(Math.max(preferredLeft, margin), maxLeft);
        var spaceBelow = viewportHeight - triggerRect.bottom - margin;
        var preferredTop = triggerIsVisible
            ? (spaceBelow >= panelRect.height
                ? triggerRect.bottom + gap
                : triggerRect.top - panelRect.height - gap)
            : initialPanelRect.top;
        var maxTop = Math.max(margin, viewportHeight - panelRect.height - margin);
        var top = Math.min(Math.max(preferredTop, margin), maxTop);

        panel.style.left = left + "px";
        panel.style.top = top + "px";
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
                positionPreferencesPanel(trigger, panel);
            }
        }

        function repositionOpenPanel() {
            if (!panel.hidden) {
                positionPreferencesPanel(trigger, panel);
            }
        }

        trigger.addEventListener("click", function (e) {
            e.stopPropagation();
            setOpen(panel.hidden);
        });

        var closeBtn = document.getElementById("desktopPrefsClose");
        if (closeBtn) {
            closeBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                setOpen(false);
                trigger.focus();
            });
        }

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

        window.addEventListener("resize", repositionOpenPanel);
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", repositionOpenPanel);
            window.visualViewport.addEventListener("scroll", repositionOpenPanel);
        }

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
        mountLanguagePrefs();
        resolveCustomizeThemeAccess();
    }

    function mountLanguagePrefs() {
        var container = document.getElementById("desktopPrefsLanguage");
        if (!container || !window.DesktopPrefsLanguage) {
            return;
        }
        window.DesktopPrefsLanguage.mount(container);
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
        window.ShmerlingPieceSets.renderPieceSetButtons(container);
    }

    function refreshCustomThemeList() {
        var container = document.getElementById("desktopPrefsThemes");
        if (!container || !window.DesktopCustomTheme) {
            return;
        }
        window.DesktopCustomTheme.renderSavedThemeButtons(container);
    }

    function syncThemeButtons() {
        var current = getCurrentThemeId();
        document.querySelectorAll(".desktop-prefs-theme--all [data-theme]").forEach(function (btn) {
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
