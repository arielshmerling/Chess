/**
 * Language preference in the Preferences panel (combo box).
 */
(function () {
    "use strict";

    var mounted = false;
    var wired = false;
    var hostEl = null;

    var LANGUAGE_OPTIONS = [
        { value: "he", labelKey: "desktop.prefs.languageHebrew" },
        { value: "en", labelKey: "desktop.prefs.languageEnglish" },
        { value: "ja", labelKey: "desktop.prefs.languageJapanese" },
    ];

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

    function getSelect() {
        if (hostEl) {
            return hostEl.querySelector("#desktopPrefsLanguageSelect");
        }
        return document.getElementById("desktopPrefsLanguageSelect");
    }

    function optionsHtml(selected) {
        return LANGUAGE_OPTIONS.map(function (opt) {
            var sel = opt.value === selected ? " selected" : "";
            return (
                '<option value="' +
                opt.value +
                '"' +
                sel +
                ">" +
                t(opt.labelKey) +
                "</option>"
            );
        }).join("");
    }

    function buildMarkup() {
        var locale = currentLocale();
        return [
            '<div class="desktop-field desktop-prefs-language-field">',
            '  <select id="desktopPrefsLanguageSelect" class="desktop-prefs-language-select"',
            '    aria-label="' +
                t("desktop.prefs.language") +
                '">',
            optionsHtml(locale),
            "  </select>",
            "</div>",
        ].join("");
    }

    function syncUi() {
        var select = getSelect();
        if (!select) {
            return;
        }
        var locale = currentLocale();
        if (select.value !== locale) {
            select.value = locale;
        }
    }

    function applyLocaleChoice(next) {
        if (!next || next === currentLocale()) {
            return;
        }
        if (
            window.ShmerlingStrings
            && typeof window.ShmerlingStrings.changeLocale === "function"
        ) {
            window.ShmerlingStrings.changeLocale(next);
        }
    }

    function wireEvents() {
        if (wired) {
            return;
        }
        var select = getSelect();
        if (!select) {
            return;
        }
        wired = true;
        select.addEventListener("change", function () {
            applyLocaleChoice(select.value);
        });
    }

    function mount(container) {
        if (!container) {
            return;
        }
        hostEl = container;
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
        var select = getSelect();
        if (select) {
            var locale = currentLocale();
            select.innerHTML = optionsHtml(locale);
            select.value = locale;
        }
        syncUi();
    }

    window.DesktopPrefsLanguage = {
        mount: mount,
        refresh: refresh,
    };
})();
