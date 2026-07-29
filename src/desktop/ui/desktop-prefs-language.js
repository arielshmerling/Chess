/**
 * Language preference in the Preferences panel (Hebrew / English).
 */
(function () {
    "use strict";

    var mounted = false;
    var wired = false;

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    function currentLocale() {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.getLocale === "function") {
            return window.ShmerlingStrings.getLocale();
        }
        return "he";
    }

    function buildMarkup() {
        var locale = currentLocale();
        return [
            '<div class="desktop-prefs-gameplay-row">',
            '  <span class="desktop-prefs-gameplay-label" id="desktopPrefsLanguageLabel">' +
                t("desktop.prefs.language") +
                "</span>",
            '  <div class="desktop-option-group desktop-option-group--equal desktop-prefs-language"',
            '    role="radiogroup" aria-labelledby="desktopPrefsLanguageLabel">',
            '    <label class="desktop-option-pill">',
            '      <input type="radio" name="desktopPrefsLanguage" value="he"' +
                (locale === "he" ? " checked" : "") +
                ">",
            "      <span>" + t("desktop.prefs.languageHebrew") + "</span>",
            "    </label>",
            '    <label class="desktop-option-pill">',
            '      <input type="radio" name="desktopPrefsLanguage" value="en"' +
                (locale === "en" ? " checked" : "") +
                ">",
            "      <span>" + t("desktop.prefs.languageEnglish") + "</span>",
            "    </label>",
            "  </div>",
            "</div>",
        ].join("");
    }

    function syncUi() {
        var locale = currentLocale();
        document.querySelectorAll('input[name="desktopPrefsLanguage"]').forEach(function (input) {
            input.checked = input.value === locale;
        });
    }

    function wireEvents() {
        if (wired) {
            return;
        }
        wired = true;

        document.querySelectorAll('input[name="desktopPrefsLanguage"]').forEach(function (input) {
            input.addEventListener("change", function () {
                if (!input.checked) {
                    return;
                }
                if (
                    window.ShmerlingStrings
                    && typeof window.ShmerlingStrings.changeLocale === "function"
                ) {
                    window.ShmerlingStrings.changeLocale(input.value);
                }
            });
        });
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

    window.DesktopPrefsLanguage = {
        mount: mount,
        refresh: refresh,
    };
})();
