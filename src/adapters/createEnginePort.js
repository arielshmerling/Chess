/**
 * Factory: EnginePort from HTTP or IPC brain adapters (Phase 9).
 * Dual export for Node tests and browser.
 */
(function (global) {
    "use strict";

    function loadBrainHttp() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./brainHttp");
            } catch {
                /* fall through */
            }
        }
        return global.ShmerlingBrainHttp || null;
    }

    function loadBrainIpc() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./brainIpc");
            } catch {
                /* fall through */
            }
        }
        return global.ShmerlingBrainIpc || null;
    }

    /**
     * @param {object} [options]
     * @param {boolean} [options.isElectron]
     * @param {object} [options.http] - passed to BrainHttp.create
     * @param {object} [options.ipc] - passed to BrainIpc.create as { ipc }
     * @returns {{ computeMove: Function, evaluatePosition: Function, abortSearch: Function }}
     */
    function create(options) {
        const opts = options || {};
        if (opts.isElectron) {
            const BrainIpc = loadBrainIpc();
            if (!BrainIpc || typeof BrainIpc.create !== "function") {
                throw new Error("Brain IPC adapter is not available");
            }
            return BrainIpc.create({ ipc: opts.ipc });
        }
        const BrainHttp = loadBrainHttp();
        if (!BrainHttp || typeof BrainHttp.create !== "function") {
            throw new Error("Brain HTTP adapter is not available");
        }
        return BrainHttp.create(opts.http || {});
    }

    const CreateEnginePort = { create: create };

    global.ShmerlingCreateEnginePort = CreateEnginePort;

    if (typeof module === "object" && module && module.exports) {
        module.exports = CreateEnginePort;
    }
})(typeof window !== "undefined" ? window : globalThis);
