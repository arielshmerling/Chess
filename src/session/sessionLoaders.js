/**
 * Shared Node/browser loaders for session modules (dual-export packages).
 */
(function (global) {
    "use strict";

    function tryNodeRequire(relPath) {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require(relPath);
            } catch {
                return undefined;
            }
        }
        return undefined;
    }

    function loadCapabilities() {
        const mod = tryNodeRequire("./capabilities");
        if (mod) {
            return mod;
        }
        return global.ShmerlingSessionCapabilities || null;
    }

    function loadT() {
        const mod = tryNodeRequire("../strings/t-bridge");
        if (mod && typeof mod.t === "function") {
            return mod.t;
        }
        return typeof global.ShmerlingT === "function"
            ? global.ShmerlingT
            : function (key) {
                  return key;
              };
    }

    function loadContracts(fallback) {
        const mod = tryNodeRequire("./contracts");
        if (mod) {
            return mod;
        }
        return global.ShmerlingSessionContracts || fallback || { MODE_IDS: {} };
    }

    function loadEventBus() {
        const mod = tryNodeRequire("./eventBus");
        if (mod) {
            return mod;
        }
        return global.ShmerlingSessionEventBus || null;
    }

    const api = {
        loadCapabilities: loadCapabilities,
        loadT: loadT,
        loadContracts: loadContracts,
        loadEventBus: loadEventBus,
    };

    global.ShmerlingSessionLoaders = api;

    if (typeof module === "object" && module && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
