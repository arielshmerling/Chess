/**
 * HTTP brain adapter (web Play shell).
 * Dual export for Node tests and browser.
 *
 * @param {object} [options]
 * @param {(path: string, payload?: object) => Promise<object|null>} [options.postJson]
 */
(function (global) {
    "use strict";

    /**
     * @param {Response} response
     * @returns {Promise<object|null>}
     */
    async function defaultParseJsonResponse(response) {
        const body = await response.json().catch(function () {
            return null;
        });
        if (!response.ok) {
            const message =
                (body && body.message) || response.statusText || "Engine request failed";
            const err = new Error(message);
            err.status = response.status;
            if (body && body.code) {
                err.code = body.code;
            }
            throw err;
        }
        return body;
    }

    /**
     * @param {string} path
     * @param {object} [payload]
     * @returns {Promise<object|null>}
     */
    async function defaultPostJson(path, payload) {
        const response = await fetch(path, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload || {}),
        });
        return defaultParseJsonResponse(response);
    }

    /**
     * @param {object} [options]
     * @returns {{ computeMove: Function, evaluatePosition: Function, abortSearch: Function }}
     */
    function create(options) {
        const opts = options || {};
        const postJson =
            typeof opts.postJson === "function" ? opts.postJson : defaultPostJson;

        async function abortSearch() {
            try {
                await postJson("/api/brain/abort-search", {});
            } catch (err) {
                if (typeof console !== "undefined" && console.warn) {
                    console.warn("[Shmerling] Could not abort engine search:", err);
                }
            }
        }

        async function computeMove(computeOpts) {
            const body = await postJson("/api/brain/compute-move", computeOpts);
            return body && body.move != null ? body.move : null;
        }

        async function evaluatePosition(evalOpts) {
            const body = await postJson("/api/brain/evaluate-position", evalOpts);
            return body && body.result != null ? body.result : body;
        }

        return {
            computeMove: computeMove,
            evaluatePosition: evaluatePosition,
            abortSearch: abortSearch,
        };
    }

    const BrainHttp = {
        create: create,
        defaultPostJson: defaultPostJson,
        defaultParseJsonResponse: defaultParseJsonResponse,
    };

    global.ShmerlingBrainHttp = BrainHttp;

    if (typeof module === "object" && module && module.exports) {
        module.exports = BrainHttp;
    }
})(typeof window !== "undefined" ? window : globalThis);
