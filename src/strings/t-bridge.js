/**
 * Thin t() bridge for browser scripts and Node unit tests.
 */
(function (global) {
    "use strict";

    /**
     * @param {string} key
     * @param {object|null|undefined} [params]
     * @returns {string}
     */
    function t(key, params) {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./index").t(key, params);
            } catch {
                /* fall through */
            }
        }
        const api = global.ShmerlingStrings;
        if (api && typeof api.t === "function") {
            return api.t(key, params);
        }
        return String(key);
    }

    const bridge = { t: t };

    global.ShmerlingT = t;

    if (typeof module === "object" && module && module.exports) {
        module.exports = bridge;
    }
})(typeof window !== "undefined" ? window : globalThis);
