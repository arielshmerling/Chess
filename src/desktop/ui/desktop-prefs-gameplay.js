/**
 * Gameplay preferences in the Preferences panel (mouse, thinking time, move hints).
 */
(function () {
    "use strict";

    var mounted = false;
    var wired = false;

    function Settings() {
        return window.DesktopGameSettings;
    }

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    function thinkingOptions() {
        var s = Settings();
        return s && Array.isArray(s.THINKING_TIME_OPTIONS)
            ? s.THINKING_TIME_OPTIONS
            : [2, 5, 10, 15, 20, 30, 60, 120];
    }

    function indexForSeconds(seconds) {
        var options = thinkingOptions();
        var s = Settings();
        var normalized = s && typeof s.normalizeThinkingTimeSeconds === "function"
            ? s.normalizeThinkingTimeSeconds(seconds)
            : seconds;
        var idx = options.indexOf(normalized);
        return idx >= 0 ? idx : options.indexOf(10);
    }

    function secondsForIndex(index) {
        var options = thinkingOptions();
        var i = parseInt(index, 10);
        if (!Number.isFinite(i) || i < 0) {
            return options[0];
        }
        if (i >= options.length) {
            return options[options.length - 1];
        }
        return options[i];
    }

    function formatSeconds(seconds) {
        return t("desktop.prefs.secondsOption", { count: seconds });
    }

    function buildMarkup() {
        var options = thinkingOptions();
        var maxIndex = Math.max(0, options.length - 1);
        return [
            '<div class="desktop-prefs-gameplay-row desktop-prefs-gameplay-row--mouse">',
            '  <span class="desktop-prefs-gameplay-label" id="desktopPrefsMouseLabel">' +
                t("desktop.prefs.mouseControl") +
                "</span>",
            '  <div class="desktop-prefs-mouse-seg" role="radiogroup"',
            '    aria-labelledby="desktopPrefsMouseLabel">',
            '    <label class="desktop-prefs-mouse-seg__opt">',
            '      <input type="radio" name="desktopPrefsMouse" value="drag">',
            '      <span class="desktop-prefs-mouse-seg__face">',
            '        <span class="desktop-prefs-mouse-seg__text">' +
                t("desktop.prefs.mouseDrag") +
                "</span>",
            "      </span>",
            "    </label>",
            '    <label class="desktop-prefs-mouse-seg__opt">',
            '      <input type="radio" name="desktopPrefsMouse" value="double">',
            '      <span class="desktop-prefs-mouse-seg__face">',
            '        <span class="desktop-prefs-mouse-seg__text">' +
                t("desktop.prefs.mouseClick") +
                "</span>",
            "      </span>",
            "    </label>",
            "  </div>",
            "</div>",
            '<div class="desktop-prefs-gameplay-row desktop-prefs-gameplay-row--think">',
            '  <div class="desktop-prefs-think-head">',
            '    <label class="desktop-prefs-gameplay-label" for="desktopPrefsThinkingTime">' +
                t("desktop.prefs.thinkingTime") +
                "</label>",
            '    <span class="desktop-prefs-think-value" id="desktopPrefsThinkingTimeValue" aria-hidden="true"></span>',
            "  </div>",
            '  <input type="range" class="desktop-prefs-think-slider" id="desktopPrefsThinkingTime"',
            '    min="0" max="' +
                maxIndex +
                '" step="1" aria-valuemin="0" aria-valuemax="' +
                maxIndex +
                '"',
            '    aria-label="' +
                t("desktop.prefs.thinkingTimeAria") +
                '">',
            '  <div class="desktop-prefs-think-ends" aria-hidden="true">',
            "    <span>" + formatSeconds(options[0]) + "</span>",
            "    <span>" + formatSeconds(options[options.length - 1]) + "</span>",
            "  </div>",
            "</div>",
            '<div class="desktop-prefs-gameplay-checks">',
            '  <label class="desktop-check desktop-prefs-gameplay-check">',
            '    <input type="checkbox" id="desktopPrefsShowMoves" value="1">',
            '    <span class="desktop-check-box" aria-hidden="true"></span>',
            "    <span>" + t("site.playNow.showAvailableMoves") + "</span>",
            "  </label>",
            '  <label class="desktop-check desktop-prefs-gameplay-check">',
            '    <input type="checkbox" id="desktopPrefsImmediateResign" value="1">',
            '    <span class="desktop-check-box" aria-hidden="true"></span>',
            "    <span>" + t("desktop.prefs.immediateResign") + "</span>",
            "  </label>",
            "</div>",
        ].join("");
    }

    function syncUi(prefs) {
        var mouse = prefs.mouse === "double" ? "double" : "drag";
        document.querySelectorAll('input[name="desktopPrefsMouse"]').forEach(function (input) {
            input.checked = input.value === mouse;
        });

        var slider = document.getElementById("desktopPrefsThinkingTime");
        var valueEl = document.getElementById("desktopPrefsThinkingTimeValue");
        if (slider) {
            var idx = indexForSeconds(prefs.thinkingTimeSeconds);
            var seconds = secondsForIndex(idx);
            slider.value = String(idx);
            slider.setAttribute("aria-valuenow", String(idx));
            slider.setAttribute("aria-valuetext", formatSeconds(seconds));
            if (valueEl) {
                valueEl.textContent = formatSeconds(seconds);
            }
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

    function applyThinkingFromSlider(slider) {
        if (!slider || !Settings()) {
            return;
        }
        var seconds = secondsForIndex(slider.value);
        var valueEl = document.getElementById("desktopPrefsThinkingTimeValue");
        if (valueEl) {
            valueEl.textContent = formatSeconds(seconds);
        }
        slider.setAttribute("aria-valuenow", String(slider.value));
        slider.setAttribute("aria-valuetext", formatSeconds(seconds));
        Settings().saveGamePreferences({ thinkingTimeSeconds: seconds });
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
                Settings().saveGamePreferences({ mouse: input.value });
            });
        });

        var slider = document.getElementById("desktopPrefsThinkingTime");
        if (slider) {
            var thinkingSaveTimer = null;
            function scheduleThinkingSave() {
                if (thinkingSaveTimer) {
                    clearTimeout(thinkingSaveTimer);
                }
                thinkingSaveTimer = setTimeout(function () {
                    thinkingSaveTimer = null;
                    applyThinkingFromSlider(slider);
                }, 120);
            }
            slider.addEventListener("input", function () {
                var seconds = secondsForIndex(slider.value);
                var valueEl = document.getElementById("desktopPrefsThinkingTimeValue");
                if (valueEl) {
                    valueEl.textContent = formatSeconds(seconds);
                }
                slider.setAttribute("aria-valuenow", String(slider.value));
                slider.setAttribute("aria-valuetext", formatSeconds(seconds));
                /* Persist while dragging — change alone is easy to miss on some platforms. */
                scheduleThinkingSave();
            });
            slider.addEventListener("change", function () {
                if (thinkingSaveTimer) {
                    clearTimeout(thinkingSaveTimer);
                    thinkingSaveTimer = null;
                }
                applyThinkingFromSlider(slider);
            });
        }

        var showMoves = document.getElementById("desktopPrefsShowMoves");
        if (showMoves) {
            showMoves.addEventListener("change", function () {
                Settings().saveGamePreferences({ showAvailableMoves: showMoves.checked });
            });
        }

        var immediateResign = document.getElementById("desktopPrefsImmediateResign");
        if (immediateResign) {
            immediateResign.addEventListener("change", function () {
                Settings().saveGamePreferences({ immediateResign: immediateResign.checked });
            });
        }
    }

    function mount(container) {
        if (!container || !Settings()) {
            return;
        }
        if (!mounted) {
            container.innerHTML = buildMarkup();
            wireEvents();
            mounted = true;
        }
        syncUi(Settings().loadGamePreferences());
    }

    function refresh() {
        if (!mounted || !Settings()) {
            return;
        }
        syncUi(Settings().loadGamePreferences());
    }

    window.DesktopPrefsGameplay = {
        mount: mount,
        refresh: refresh,
    };
})();
