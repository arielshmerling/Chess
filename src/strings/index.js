/**
 * String lookup API — resolves keys from locale catalogs and interpolates params.
 *
 * Usage:
 *   t("play.status.gameOver")
 *   t("play.status.timesUpLost", { loser: "White" })
 *
 * Default locale: Hebrew ("he"). English remains available via setLocale("en")
 * or t(key, params, "en"). Missing keys fall back to English.
 */
(function (global) {
    "use strict";

    const DEFAULT_LOCALE = "he";
    const FALLBACK_LOCALE = "en";

    function isPlainObject(value) {
        return !!value && typeof value === "object" && !Array.isArray(value);
    }

    function deepMerge(base, extra) {
        if (!isPlainObject(base) || !isPlainObject(extra)) {
            return extra !== undefined ? extra : base;
        }
        const out = Object.assign({}, base);
        Object.keys(extra).forEach(function (key) {
            const val = extra[key];
            if (isPlainObject(val) && isPlainObject(out[key])) {
                out[key] = deepMerge(out[key], val);
            } else {
                out[key] = val;
            }
        });
        return out;
    }

    function loadCatalogPair(baseGlobalName, extraGlobalName, baseModule, extraModule) {
        let catalog = null;
        if (typeof module === "object" && module && module.exports) {
            try {
                catalog = require(baseModule);
            } catch {
                /* fall through */
            }
        } else {
            catalog = global[baseGlobalName] || null;
        }
        let extra = null;
        if (typeof module === "object" && module && module.exports) {
            try {
                extra = require(extraModule);
            } catch {
                extra = null;
            }
        } else {
            extra = global[extraGlobalName] || null;
        }
        if (catalog && extra) {
            return deepMerge(catalog, extra);
        }
        return catalog || extra;
    }

    function loadEnCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsEn",
            "ShmerlingStringsEnExtra",
            "./en",
            "./en-extra",
        );
    }

    function loadHeCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsHe",
            "ShmerlingStringsHeExtra",
            "./he",
            "./he-extra",
        );
    }

    const LOCALES = {
        he: loadHeCatalog,
        en: loadEnCatalog,
    };

    const RTL_LOCALES = { he: true };

    let activeLocale = DEFAULT_LOCALE;

    function lookup(path, source) {
        if (!path || !source) {
            return undefined;
        }
        const parts = String(path).split(".");
        let node = source;
        for (let i = 0; i < parts.length; i++) {
            if (node == null || typeof node !== "object") {
                return undefined;
            }
            node = node[parts[i]];
        }
        return node;
    }

    function format(template, params) {
        if (template == null) {
            return "";
        }
        let text = String(template);
        if (!params || typeof params !== "object") {
            return text;
        }
        Object.keys(params).forEach(function (key) {
            const value = params[key];
            text = text.split("{{" + key + "}}").join(value == null ? "" : String(value));
        });
        return text;
    }

    function getCatalog(locale) {
        const code = locale || activeLocale;
        const loader = LOCALES[code] || LOCALES[FALLBACK_LOCALE];
        return typeof loader === "function" ? loader() : loader;
    }

    function t(key, params, locale) {
        const preferred = locale || activeLocale;
        let value = lookup(key, getCatalog(preferred));
        if (typeof value !== "string" && preferred !== FALLBACK_LOCALE) {
            value = lookup(key, getCatalog(FALLBACK_LOCALE));
        }
        if (typeof value !== "string") {
            return String(key);
        }
        return format(value, params);
    }

    function setLocale(locale) {
        if (locale && LOCALES[locale]) {
            activeLocale = locale;
        }
    }

    function getLocale(locale) {
        return locale || activeLocale;
    }

    function getStrings(locale) {
        return getCatalog(locale);
    }

    function isRtl(locale) {
        return !!RTL_LOCALES[locale || activeLocale];
    }

    function getHtmlLang(locale) {
        return getLocale(locale);
    }

    function getHtmlDir(locale) {
        return isRtl(locale) ? "rtl" : "ltr";
    }

    function applyDocumentLocale(doc) {
        const documentRef = doc || (typeof document !== "undefined" ? document : null);
        if (!documentRef || !documentRef.documentElement) {
            return;
        }
        documentRef.documentElement.lang = getHtmlLang();
        documentRef.documentElement.dir = getHtmlDir();
    }

    const api = {
        t: t,
        format: format,
        setLocale: setLocale,
        getLocale: getLocale,
        getStrings: getStrings,
        isRtl: isRtl,
        getHtmlLang: getHtmlLang,
        getHtmlDir: getHtmlDir,
        applyDocumentLocale: applyDocumentLocale,
        DEFAULT_LOCALE: DEFAULT_LOCALE,
        LOCALES: Object.keys(LOCALES),
    };

    global.ShmerlingStrings = api;
    if (typeof document !== "undefined") {
        try {
            applyDocumentLocale(document);
        } catch {
            /* ignore */
        }
    }

    if (typeof module === "object" && module && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
