/**
 * Desktop HTTP client (fetch). Web play still uses axios via chessboard.js.
 */
(function (global) {
    "use strict";

    async function parseJsonResponse(response) {
        const body = await response.json().catch(function () {
            return null;
        });
        if (!response.ok) {
            const message = (body && body.message) || response.statusText || "Request failed";
            throw new Error(message);
        }
        return body;
    }

    async function get(path) {
        const response = await fetch(path, {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
        });
        return parseJsonResponse(response);
    }

    async function post(path, payload) {
        const response = await fetch(path, {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload || {}),
        });
        return parseJsonResponse(response);
    }

    global.DesktopApi = { get: get, post: post };
})(window);
