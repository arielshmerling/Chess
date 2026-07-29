/**
 * Gameplay preferences in the Preferences panel (mouse, thinking time, move hints).
 */
(function () {
    "use strict";

    var Settings = window.DesktopGameSettings;
    var mounted = false;
    var wired = false;

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    function thinkingTimeOptionsHtml(selected) {
        return Settings.THINKING_TIME_OPTIONS.map(function (seconds) {
            var sel =
                seconds === Settings.normalizeThinkingTimeSeconds(selected) ? " selected" : "";
            return (
                '<option value="' +
                seconds +
                '"' +
                sel +
                ">" +
                t("desktop.prefs.secondsOption", { count: seconds }) +
                "</option>"
            );
        }).join("");
    }

    function buildMarkup() {
        return [
            '<div class="desktop-prefs-gameplay-row">',
            '  <span class="desktop-prefs-gameplay-label" id="desktopPrefsMouseLabel">' +
                t("desktop.prefs.mouseControl") +
                "</span>",
            '  <div class="desktop-option-group desktop-option-group--equal desktop-prefs-gameplay-mouse"',
            '    role="radiogroup" aria-labelledby="desktopPrefsMouseLabel">',
            '    <label class="desktop-option-pill">',
            '      <input type="radio" name="desktopPrefsMouse" value="drag">',
            "      <span>" + t("site.playNow.drag") + "</span>",
            "    </label>",
            '    <label class="desktop-option-pill">',
            '      <input type="radio" name="desktopPrefsMouse" value="double">',
            "      <span>" + t("site.playNow.doubleClick") + "</span>",
            "    </label>",
            "  </div>",
            "</div>",
            '<div class="desktop-field desktop-prefs-gameplay-field">',
            '  <label class="desktop-prefs-gameplay-label" for="desktopPrefsThinkingTime">' +
                t("desktop.prefs.thinkingTime") +
                "</label>",
            '  <select id="desktopPrefsThinkingTime" aria-label="' +
                t("desktop.prefs.thinkingTimeAria") +
                '"></select>',
            "</div>",
            '<label class="desktop-check desktop-prefs-gameplay-check">',
            '  <input type="checkbox" id="desktopPrefsShowMoves" value="1">',
            '  <span class="desktop-check-box" aria-hidden="true"></span>',
            "  <span>" + t("site.playNow.showAvailableMoves") + "</span>",
            "</label>",
            '<label class="desktop-check desktop-prefs-gameplay-check">',
            '  <input type="checkbox" id="desktopPrefsImmediateResign" value="1">',
            '  <span class="desktop-check-box" aria-hidden="true"></span>',
            "  <span>" + t("desktop.prefs.immediateResign") + "</span>",
            "</label>",
        ].join("");
    }

    function syncUi(prefs) {
        var mouse = prefs.mouse === "double" ? "double" : "drag";
        document.querySelectorAll('input[name="desktopPrefsMouse"]').forEach(function (input) {
            input.checked = input.value === mouse;
        });

        var thinkingSelect = document.getElementById("desktopPrefsThinkingTime");
        if (thinkingSelect) {
            var normalized = Settings.normalizeThinkingTimeSeconds(prefs.thinkingTimeSeconds);
            thinkingSelect.innerHTML = thinkingTimeOptionsHtml(normalized);
            thinkingSelect.value = String(normalized);
        }

        var showMoves = document.getElementById("desktopPrefsShowMoves");
        if (showMoves) {
            showMoves.checked = prefs.showAvailableMoves !== false;
        }

        var immediateResign = document.getElementById("desktopPrefsImmediateResign");
        if (immediateResign) {
            immediateResign.checked = prefs.immediateResign === true;
        }
    }

    function wireEvents() {
        if (wired) {
            return;
        }
        wired = true;

        document.querySelectorAll('input[name="desktopPrefsMouse"]').forEach(function (input) {
            input.addEventListener("change", function () {
                if (!input.checked) {
                    return;
                }
                Settings.saveGamePreferences({ mouse: input.value });
            });
        });

        var thinkingSelect = document.getElementById("desktopPrefsThinkingTime");
        if (thinkingSelect) {
            thinkingSelect.addEventListener("change", function () {
                Settings.saveGamePreferences({
                    thinkingTimeSeconds: parseInt(thinkingSelect.value, 10),
                });
            });
        }

        var showMoves = document.getElementById("desktopPrefsShowMoves");
        if (showMoves) {
            showMoves.addEventListener("change", function () {
                Settings.saveGamePreferences({ showAvailableMoves: showMoves.checked });
            });
        }

        var immediateResign = document.getElementById("desktopPrefsImmediateResign");
        if (immediateResign) {
            immediateResign.addEventListener("change", function () {
                Settings.saveGamePreferences({ immediateResign: immediateResign.checked });
            });
        }
    }

    function mount(container) {
        if (!container || !Settings) {
            return;
        }
        if (!mounted) {
            container.innerHTML = buildMarkup();
            wireEvents();
            mounted = true;
        }
        syncUi(Settings.loadGamePreferences());
    }

    function refresh() {
        if (!mounted || !Settings) {
            return;
        }
        syncUi(Settings.loadGamePreferences());
    }

    window.DesktopPrefsGameplay = {
        mount: mount,
        refresh: refresh,
    };
})();
