/**
 * String lookup API — resolves keys from locale catalogs and interpolates params.
 *
 * Usage:
 *   t("play.status.gameOver")
 *   t("play.status.timesUpLost", { loser: "White" })
 *
 * Default locale: Hebrew ("he"). Other locales (en, ja, fr, de, zh, ar, hi, es,
 * ru, uk, no) via setLocale / t(key, params, locale). Missing keys fall back to English.
 */
(function (global) {
    "use strict";

    const DEFAULT_LOCALE = "he";
    const FALLBACK_LOCALE = "en";
    const LOCALE_COOKIE = "shmerling_locale";
    const LOCALE_STORAGE_KEY = "shmerling.locale";
    const LOCALE_COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60;

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

    function loadJaCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsJa",
            "ShmerlingStringsJaExtra",
            "./ja",
            "./ja-extra",
        );
    }

    function loadFrCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsFr",
            "ShmerlingStringsFrExtra",
            "./fr",
            "./fr-extra",
        );
    }

    function loadDeCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsDe",
            "ShmerlingStringsDeExtra",
            "./de",
            "./de-extra",
        );
    }

    function loadZhCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsZh",
            "ShmerlingStringsZhExtra",
            "./zh",
            "./zh-extra",
        );
    }

    function loadArCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsAr",
            "ShmerlingStringsArExtra",
            "./ar",
            "./ar-extra",
        );
    }

    function loadHiCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsHi",
            "ShmerlingStringsHiExtra",
            "./hi",
            "./hi-extra",
        );
    }

    function loadEsCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsEs",
            "ShmerlingStringsEsExtra",
            "./es",
            "./es-extra",
        );
    }

    function loadRuCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsRu",
            "ShmerlingStringsRuExtra",
            "./ru",
            "./ru-extra",
        );
    }

    function loadUkCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsUk",
            "ShmerlingStringsUkExtra",
            "./uk",
            "./uk-extra",
        );
    }

    function loadNoCatalog() {
        return loadCatalogPair(
            "ShmerlingStringsNo",
            "ShmerlingStringsNoExtra",
            "./no",
            "./no-extra",
        );
    }

    const LOCALES = {
        he: loadHeCatalog,
        en: loadEnCatalog,
        ja: loadJaCatalog,
        fr: loadFrCatalog,
        de: loadDeCatalog,
        zh: loadZhCatalog,
        ar: loadArCatalog,
        hi: loadHiCatalog,
        es: loadEsCatalog,
        ru: loadRuCatalog,
        uk: loadUkCatalog,
        no: loadNoCatalog,
    };

    const RTL_LOCALES = { he: true, ar: true };

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

    function normalizeLocale(locale) {
        if (locale && LOCALES[locale]) {
            return locale;
        }
        return null;
    }

    function setLocale(locale) {
        const code = normalizeLocale(locale);
        if (code) {
            activeLocale = code;
        }
    }

    function getLocale(locale) {
        return locale || activeLocale;
    }

    function parseCookieHeader(cookieHeader, name) {
        if (!cookieHeader || !name) {
            return null;
        }
        const parts = String(cookieHeader).split(";");
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const eq = part.indexOf("=");
            if (eq < 0) {
                continue;
            }
            const key = part.slice(0, eq).trim();
            if (key !== name) {
                continue;
            }
            try {
                return decodeURIComponent(part.slice(eq + 1).trim());
            } catch {
                return part.slice(eq + 1).trim();
            }
        }
        return null;
    }

    function resolveRequestLocale(req) {
        const header = req && req.headers ? req.headers.cookie : "";
        return normalizeLocale(parseCookieHeader(header, LOCALE_COOKIE)) || DEFAULT_LOCALE;
    }

    function readBrowserStoredLocale() {
        if (typeof document === "undefined") {
            return null;
        }
        try {
            if (typeof localStorage !== "undefined") {
                const fromStorage = normalizeLocale(localStorage.getItem(LOCALE_STORAGE_KEY));
                if (fromStorage) {
                    return fromStorage;
                }
            }
        } catch {
            /* ignore */
        }
        return normalizeLocale(parseCookieHeader(document.cookie, LOCALE_COOKIE));
    }

    function writeBrowserStoredLocale(locale) {
        const code = normalizeLocale(locale);
        if (!code || typeof document === "undefined") {
            return false;
        }
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(LOCALE_STORAGE_KEY, code);
            }
        } catch {
            /* ignore */
        }
        const secure =
            typeof location !== "undefined" && location.protocol === "https:" ? ";Secure" : "";
        document.cookie =
            LOCALE_COOKIE +
            "=" +
            encodeURIComponent(code) +
            ";Path=/;Max-Age=" +
            LOCALE_COOKIE_MAX_AGE_SEC +
            ";SameSite=Lax" +
            secure;
        return true;
    }

    /**
     * Persist and activate a locale. Optionally reloads so SSR/EJS and one-shot
     * UI mounts pick up the new language.
     * @param {string} locale
     * @param {{ reload?: boolean }} [options]
     * @returns {boolean}
     */
    function changeLocale(locale, options) {
        const code = normalizeLocale(locale);
        if (!code) {
            return false;
        }
        setLocale(code);
        writeBrowserStoredLocale(code);
        applyDocumentLocale();
        if (typeof document !== "undefined") {
            try {
                document.dispatchEvent(
                    new CustomEvent("shmerling-locale-changed", {
                        detail: { locale: code },
                    }),
                );
            } catch {
                /* ignore */
            }
        }
        const shouldReload = !options || options.reload !== false;
        if (shouldReload && typeof location !== "undefined" && location.reload) {
            location.reload();
        }
        return true;
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

    /**
     * Map ChessGame color tokens ("white"/"black"/"White"/"Black") to the active locale.
     * @param {string|null|undefined} color
     * @param {string} [locale]
     * @returns {string}
     */
    function localizeColorName(color, locale) {
        const raw = color == null ? "" : String(color).trim().toLowerCase();
        if (raw === "white") {
            return t("common.white", null, locale);
        }
        if (raw === "black") {
            return t("common.black", null, locale);
        }
        return color == null ? "" : String(color);
    }

    /**
     * Map ChessGame / protocol English draw-reason tokens to the active locale.
     * @param {string|null|undefined} reason
     * @param {string} [locale]
     * @returns {string}
     */
    function localizeDrawReason(reason, locale) {
        const raw = reason == null ? "" : String(reason).trim();
        if (!raw) {
            return t("common.draw", null, locale);
        }
        const known = {
            Stalemate: "play.drawReasons.stalemate",
            "50 Moves": "play.drawReasons.fiftyMoves",
            "insufficient Materials": "play.drawReasons.insufficientMaterial",
            "Threefold Repetition": "play.drawReasons.threefoldRepetition",
        };
        if (known[raw]) {
            return t(known[raw], null, locale);
        }
        const offerMatch = raw.match(/^(White|Black) player's draw offer accepted$/i);
        if (offerMatch) {
            const byKey =
                offerMatch[1].toLowerCase() === "white" ? "common.white" : "common.black";
            return t(
                "play.drawReasons.drawOfferAccepted",
                { by: t(byKey, null, locale) },
                locale,
            );
        }
        return raw;
    }

    const api = {
        t: t,
        format: format,
        setLocale: setLocale,
        getLocale: getLocale,
        normalizeLocale: normalizeLocale,
        resolveRequestLocale: resolveRequestLocale,
        readBrowserStoredLocale: readBrowserStoredLocale,
        writeBrowserStoredLocale: writeBrowserStoredLocale,
        changeLocale: changeLocale,
        localizeColorName: localizeColorName,
        localizeDrawReason: localizeDrawReason,
        getStrings: getStrings,
        isRtl: isRtl,
        getHtmlLang: getHtmlLang,
        getHtmlDir: getHtmlDir,
        applyDocumentLocale: applyDocumentLocale,
        DEFAULT_LOCALE: DEFAULT_LOCALE,
        LOCALE_COOKIE: LOCALE_COOKIE,
        LOCALE_STORAGE_KEY: LOCALE_STORAGE_KEY,
        LOCALES: Object.keys(LOCALES),
    };

    global.ShmerlingStrings = api;
    if (typeof document !== "undefined") {
        try {
            const stored = readBrowserStoredLocale();
            if (stored) {
                setLocale(stored);
            }
            applyDocumentLocale(document);
        } catch {
            /* ignore */
        }
    }

    if (typeof module === "object" && module && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
