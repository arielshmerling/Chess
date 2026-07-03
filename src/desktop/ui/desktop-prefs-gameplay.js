/**
 * Gameplay preferences in the Preferences panel (mouse, thinking time, move hints).
 */
(function () {
    "use strict";

    var Settings = window.DesktopGameSettings;
    var mounted = false;
    var wired = false;

    function thinkingTimeOptionsHtml(selected) {
        return Settings.THINKING_TIME_OPTIONS.map(function (seconds) {
            var sel =
                seconds === Settings.normalizeThinkingTimeSeconds(selected) ? " selected" : "";
            return '<option value="' + seconds + '"' + sel + ">" + seconds + "s</option>";
        }).join("");
    }

    function buildMarkup() {
        return [
            '<div class="desktop-prefs-gameplay-row">',
            '  <span class="desktop-prefs-gameplay-label" id="desktopPrefsMouseLabel">Mouse control</span>',
            '  <div class="desktop-option-group desktop-option-group--equal desktop-prefs-gameplay-mouse"',
            '    role="radiogroup" aria-labelledby="desktopPrefsMouseLabel">',
            '    <label class="desktop-option-pill">',
            '      <input type="radio" name="desktopPrefsMouse" value="drag">',
            "      <span>Drag</span>",
            "    </label>",
            '    <label class="desktop-option-pill">',
            '      <input type="radio" name="desktopPrefsMouse" value="double">',
            "      <span>Double-click</span>",
            "    </label>",
            "  </div>",
            "</div>",
            '<div class="desktop-field desktop-prefs-gameplay-field">',
            '  <label class="desktop-prefs-gameplay-label" for="desktopPrefsThinkingTime">Thinking time</label>',
            '  <select id="desktopPrefsThinkingTime" aria-label="Thinking time in seconds"></select>',
            "</div>",
            '<label class="desktop-check desktop-prefs-gameplay-check">',
            '  <input type="checkbox" id="desktopPrefsShowMoves" value="1">',
            '  <span class="desktop-check-box" aria-hidden="true"></span>',
            "  <span>Show available moves</span>",
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
