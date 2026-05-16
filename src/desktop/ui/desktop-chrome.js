/**
 * Desktop shell: top bar (logo + preferences) on all /app/* pages.
 */
(function () {
    "use strict";

    var TOPBAR_HTML = [
        '<header class="desktop-topbar" role="banner">',
        '  <a href="/app/" class="desktop-topbar-logo" aria-label="Shmerling home">',
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
        '        <section class="desktop-prefs-section">',
        '          <h3 class="desktop-prefs-section-title">Color theme</h3>',
        '          <div class="desktop-prefs-theme" role="group" aria-label="Color theme">',
        '            <button type="button" class="desktop-theme-choice" data-theme="blue" aria-pressed="false">',
        '              <span class="desktop-theme-swatch desktop-theme-swatch--blue" aria-hidden="true"></span>',
        '              <span class="desktop-theme-name">Blue</span>',
        "            </button>",
        '            <button type="button" class="desktop-theme-choice" data-theme="dark" aria-pressed="false">',
        '              <span class="desktop-theme-swatch desktop-theme-swatch--dark" aria-hidden="true"></span>',
        '              <span class="desktop-theme-name">Dark</span>',
        "            </button>",
        "          </div>",
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
            if (!panel.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
                setOpen(false);
            }
        });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && !panel.hidden) {
                setOpen(false);
                trigger.focus();
            }
        });

        var picker = panel.querySelector(".desktop-prefs-theme");
        if (picker) {
            picker.querySelectorAll("[data-theme]").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var id = btn.getAttribute("data-theme") === "dark" ? "dark" : "blue";
                    if (typeof window.applyDesktopTheme === "function") {
                        window.applyDesktopTheme(id);
                    }
                    syncThemeButtons();
                });
            });
        }

        document.addEventListener("shmerling-theme-changed", syncThemeButtons);
        syncThemeButtons();
    }

    function syncThemeButtons() {
        var picker = document.querySelector(".desktop-prefs-theme");
        if (!picker) {
            return;
        }
        var current = localStorage.getItem("theme") === "dark" ? "dark" : "blue";
        picker.querySelectorAll("[data-theme]").forEach(function (btn) {
            var active = btn.getAttribute("data-theme") === current;
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
