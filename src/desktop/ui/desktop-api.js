/**
 * Desktop HTTP client (fetch). Web play still uses axios via chessboard.js.
 */
(function (global) {
    "use strict";

    var DEFAULT_TIMEOUT_MS = 12000;

    async function parseJsonResponse(response) {
        const body = await response.json().catch(function () {
            return null;
        });
        if (!response.ok) {
            const message = (body && body.message) || response.statusText || "Request failed";
            const err = new Error(message);
            err.status = response.status;
            err.body = body;
            throw err;
        }
        return body;
    }

    /**
     * @param {string} path
     * @param {RequestInit} options
     * @param {number} [timeoutMs]
     */
    async function fetchJson(path, options, timeoutMs) {
        const ms =
            typeof timeoutMs === "number" && timeoutMs > 0
                ? timeoutMs
                : DEFAULT_TIMEOUT_MS;
        const ctrl =
            typeof AbortController !== "undefined" ? new AbortController() : null;
        let timer = null;
        if (ctrl) {
            timer = setTimeout(function () {
                try {
                    ctrl.abort();
                } catch {
                    /* ignore */
                }
            }, ms);
        }
        try {
            const response = await fetch(
                path,
                Object.assign({}, options || {}, ctrl ? { signal: ctrl.signal } : {}),
            );
            return await parseJsonResponse(response);
        } catch (err) {
            if (err && (err.name === "AbortError" || err.code === "ABORT_ERR")) {
                throw new Error("Request timed out");
            }
            throw err;
        } finally {
            if (timer != null) {
                clearTimeout(timer);
            }
        }
    }

    async function get(path, timeoutMs) {
        return fetchJson(
            path,
            {
                method: "GET",
                credentials: "same-origin",
                headers: { Accept: "application/json" },
            },
            timeoutMs,
        );
    }

    async function post(path, payload, timeoutMs) {
        return fetchJson(
            path,
            {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload || {}),
            },
            timeoutMs,
        );
    }

    global.DesktopApi = {
        get: get,
        post: post,
        DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
    };
})(window);
