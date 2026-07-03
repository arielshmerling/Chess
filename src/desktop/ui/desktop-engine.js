/**
 * Desktop AI — calls Electron main process (no WebSocket).
 */
(function () {
    "use strict";

    async function abortSearch() {
        if (window.shmerling && typeof window.shmerling.invoke === "function") {
            try {
                await window.shmerling.invoke("brain:abortSearch");
            } catch (err) {
                console.warn("[Shmerling] Could not abort engine search:", err);
            }
        }
    }

    async function computeMove(opts) {
        if (window.shmerling && typeof window.shmerling.invoke === "function") {
            let unsubscribe = null;
            if (typeof window.shmerling.on === "function") {
                unsubscribe = window.shmerling.on("brain:searchProgress", (data) => {
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

    async function evaluatePosition(opts) {
        if (window.shmerling && typeof window.shmerling.invoke === "function") {
            return window.shmerling.invoke("brain:evaluatePosition", opts);
        }
        throw new Error("Desktop engine is not available. Restart the Shmerling Chess app.");
    }

    window.DesktopEngine = { computeMove, evaluatePosition, abortSearch };
})();
