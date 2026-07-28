/**
 * String lookup API — resolves keys from locale catalogs and interpolates params.
 *
 * Usage:
 *   t("play.status.gameOver")
 *   t("play.status.timesUpLost", { loser: "White" })
 *
 * Future locales: add src/strings/es.js and register in LOCALES.
 */
(function (global) {
    "use strict";

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

    function loadEnExtra() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./en-extra");
            } catch {
                return null;
            }
        }
        return global.ShmerlingStringsEnExtra || null;
    }

    function loadEnCatalog() {
        let catalog = null;
        if (typeof module === "object" && module && module.exports) {
            try {
                catalog = require("./en");
            } catch {
                /* fall through */
            }
        } else {
            catalog = global.ShmerlingStringsEn || null;
        }
        const extra = loadEnExtra();
        if (catalog && extra) {
            return deepMerge(catalog, extra);
        }
        return catalog || extra;
    }

    const LOCALES = {
        en: loadEnCatalog,
    };

    let activeLocale = "en";

    /**
     * @param {string} path - Dot-separated key path.
     * @param {object|null|undefined} source
     * @returns {*}
     */
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

    /**
     * @param {string} template
     * @param {object|null|undefined} params
     * @returns {string}
     */
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

    /**
     * @param {string} [locale]
     * @returns {object|null}
     */
    function getCatalog(locale) {
        const code = locale || activeLocale;
        const loader = LOCALES[code] || LOCALES.en;
        return typeof loader === "function" ? loader() : loader;
    }

    /**
     * @param {string} key
     * @param {object|null|undefined} [params]
     * @param {string|null|undefined} [locale]
     * @returns {string}
     */
    function t(key, params, locale) {
        const catalog = getCatalog(locale);
        const value = lookup(key, catalog);
        if (typeof value !== "string") {
            return String(key);
        }
        return format(value, params);
    }

    /**
     * @param {string} locale
     */
    function setLocale(locale) {
        if (locale && LOCALES[locale]) {
            activeLocale = locale;
        }
    }

    /**
     * @param {string|null|undefined} [locale]
     * @returns {string}
     */
    function getLocale(locale) {
        return locale || activeLocale;
    }

    /**
     * @param {string|null|undefined} [locale]
     * @returns {object|null}
     */
    function getStrings(locale) {
        return getCatalog(locale);
    }

    const api = {
        t: t,
        format: format,
        setLocale: setLocale,
        getLocale: getLocale,
        getStrings: getStrings,
        LOCALES: Object.keys(LOCALES),
    };

    global.ShmerlingStrings = api;

    if (typeof module === "object" && module && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
