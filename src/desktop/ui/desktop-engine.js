/**
 * Desktop AI — Electron IPC when available, otherwise web HTTP brain API.
 */
(function () {
    "use strict";

    function isElectronPlayPage() {
        return !!(
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.isElectronPlayPage === "function"
            && window.ShmerlingPlayShell.isElectronPlayPage()
        );
    }

    async function parseJsonResponse(response) {
        const body = await response.json().catch(function () {
            return null;
        });
        if (!response.ok) {
            const message = (body && body.message) || response.statusText || "Engine request failed";
            throw new Error(message);
        }
        return body;
    }

    async function postBrain(path, payload) {
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

    async function abortSearch() {
        if (isElectronPlayPage()) {
            if (window.shmerling && typeof window.shmerling.invoke === "function") {
                try {
                    await window.shmerling.invoke("brain:abortSearch");
                } catch (err) {
                    console.warn("[Shmerling] Could not abort engine search:", err);
                }
            }
            return;
        }
        try {
            await postBrain("/api/brain/abort-search", {});
        } catch (err) {
            console.warn("[Shmerling] Could not abort engine search:", err);
        }
    }

    async function computeMove(opts) {
        if (isElectronPlayPage()) {
            if (window.shmerling && typeof window.shmerling.invoke === "function") {
                let unsubscribe = null;
                if (typeof window.shmerling.on === "function") {
                    unsubscribe = window.shmerling.on("brain:searchProgress", function (data) {
                        if (data && data.message) {
                            console.log(data.message);
                        }
                    });
                }
                try {
                    return await window.shmerling.invoke("brain:computeMove", opts);
                } finally {
                    if (typeof unsubscribe === "function") {
                        unsubscribe();
                    }
                }
            }
            throw new Error("Desktop engine is not available. Restart the Shmerling Chess app.");
        }
        const body = await postBrain("/api/brain/compute-move", opts);
        return body && body.move != null ? body.move : null;
    }

    async function evaluatePosition(opts) {
        if (isElectronPlayPage()) {
            if (window.shmerling && typeof window.shmerling.invoke === "function") {
                return window.shmerling.invoke("brain:evaluatePosition", opts);
            }
            throw new Error("Desktop engine is not available. Restart the Shmerling Chess app.");
        }
        const body = await postBrain("/api/brain/evaluate-position", opts);
        return body && body.result != null ? body.result : body;
    }

    window.DesktopEngine = { computeMove, evaluatePosition, abortSearch };
})();
