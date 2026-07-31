/**
 * Language preference in the Preferences panel (combo box).
 */
(function () {
    "use strict";

    var mounted = false;
    var wired = false;
    var hostEl = null;

    var LANGUAGE_OPTIONS = [
        { value: "en", labelKey: "desktop.prefs.languageEnglish", titleEn: "English" },
        { value: "he", labelKey: "desktop.prefs.languageHebrew", titleEn: "Hebrew" },
        { value: "ja", labelKey: "desktop.prefs.languageJapanese", titleEn: "Japanese" },
        { value: "fr", labelKey: "desktop.prefs.languageFrench", titleEn: "French" },
        { value: "de", labelKey: "desktop.prefs.languageGerman", titleEn: "German" },
        { value: "zh", labelKey: "desktop.prefs.languageChinese", titleEn: "Simplified Chinese" },
        { value: "ar", labelKey: "desktop.prefs.languageArabic", titleEn: "Arabic" },
        { value: "hi", labelKey: "desktop.prefs.languageHindi", titleEn: "Hindi" },
        { value: "es", labelKey: "desktop.prefs.languageSpanish", titleEn: "Spanish" },
        { value: "ru", labelKey: "desktop.prefs.languageRussian", titleEn: "Russian" },
        { value: "uk", labelKey: "desktop.prefs.languageUkrainian", titleEn: "Ukrainian" },
        { value: "no", labelKey: "desktop.prefs.languageNorwegian", titleEn: "Norwegian" },
    ];

    function escapeAttr(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;");
    }

    function englishTitleFor(locale) {
        for (var i = 0; i < LANGUAGE_OPTIONS.length; i++) {
            if (LANGUAGE_OPTIONS[i].value === locale) {
                return LANGUAGE_OPTIONS[i].titleEn;
            }
        }
        return "";
    }

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
        return "en";
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
                ' title="' +
                escapeAttr(opt.titleEn) +
                '">' +
                t(opt.labelKey) +
                "</option>"
            );
        }).join("");
    }

    function buildMarkup() {
        var locale = currentLocale();
        var titleEn = englishTitleFor(locale);
        return [
            '<div class="desktop-field desktop-prefs-language-field">',
            '  <select id="desktopPrefsLanguageSelect" class="desktop-prefs-language-select"',
            '    aria-label="' +
                escapeAttr(t("desktop.prefs.language")) +
                '"' +
                (titleEn ? ' title="' + escapeAttr(titleEn) + '"' : "") +
                ">",
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
        var titleEn = englishTitleFor(select.value || locale);
        if (titleEn) {
            select.title = titleEn;
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
            var titleEn = englishTitleFor(select.value);
            if (titleEn) {
                select.title = titleEn;
            }
            applyLocaleChoice(select.value);
        });
        select.addEventListener("mouseover", function () {
            var titleEn = englishTitleFor(select.value);
            if (titleEn) {
                select.title = titleEn;
            }
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
