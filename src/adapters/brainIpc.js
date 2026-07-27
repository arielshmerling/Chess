/**
 * Electron IPC brain adapter (desktop Play shell).
 * Dual export for Node tests and browser.
 *
 * @param {object} [options]
 * @param {{ invoke?: Function, on?: Function }} [options.ipc]
 */
(function (global) {
    "use strict";

    /**
     * @param {object} [options]
     * @returns {{ computeMove: Function, evaluatePosition: Function, abortSearch: Function }}
     */
    function create(options) {
        const opts = options || {};
        const ipc = opts.ipc || null;

        function requireIpc() {
            if (!ipc || typeof ipc.invoke !== "function") {
                throw new Error(
                    "Desktop engine is not available. Restart the Shmerling Chess app.",
                );
            }
            return ipc;
        }

        async function abortSearch() {
            try {
                const api = requireIpc();
                await api.invoke("brain:abortSearch");
            } catch (err) {
                if (typeof console !== "undefined" && console.warn) {
                    console.warn("[Shmerling] Could not abort engine search:", err);
                }
            }
        }

        async function computeMove(computeOpts) {
            const api = requireIpc();
            let unsubscribe = null;
            if (typeof api.on === "function") {
                unsubscribe = api.on("brain:searchProgress", function (data) {
                    if (data && data.message && typeof console !== "undefined" && console.log) {
                        console.log(data.message);
                    }
                });
            }
            try {
                return await api.invoke("brain:computeMove", computeOpts);
            } finally {
                if (typeof unsubscribe === "function") {
                    unsubscribe();
                }
            }
        }

        async function evaluatePosition(evalOpts) {
            const api = requireIpc();
            return api.invoke("brain:evaluatePosition", evalOpts);
        }

        return {
            computeMove: computeMove,
            evaluatePosition: evaluatePosition,
            abortSearch: abortSearch,
        };
    }

    const BrainIpc = { create: create };

    global.ShmerlingBrainIpc = BrainIpc;

    if (typeof module === "object" && module && module.exports) {
        module.exports = BrainIpc;
    }
})(typeof window !== "undefined" ? window : globalThis);
