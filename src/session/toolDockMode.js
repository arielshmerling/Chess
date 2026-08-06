/**
 * Shared factory for PositionSetupMode / ConfigurationMode (Phase 7 tool docks).
 */
(function (global) {
    "use strict";

    function loadLoaders() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./sessionLoaders");
            } catch {
                /* fall through */
            }
        }
        return global.ShmerlingSessionLoaders || null;
    }

    /**
     * @param {object} spec
     * @param {string} spec.modeIdKey - MODE_IDS key (e.g. "POSITION_SETUP")
     * @param {string} spec.fallbackModeId
     * @param {string} spec.statusKey - i18n key shown on attach
     * @param {object} spec.fallbackCaps - caps when capabilities API is missing
     * @param {object} [options]
     * @param {(msg: string, kind?: string) => void} [options.onStatus]
     */
    function create(spec, options) {
        const cfg = spec || {};
        const opts = options || {};
        const loaders = loadLoaders();
        const capsApi = loaders && loaders.loadCapabilities ? loaders.loadCapabilities() : null;
        const t =
            loaders && loaders.loadT
                ? loaders.loadT()
                : function (key) {
                      return key;
                  };
        const fallbackContracts = { MODE_IDS: {} };
        fallbackContracts.MODE_IDS[cfg.modeIdKey] = cfg.fallbackModeId;
        const contracts =
            loaders && loaders.loadContracts
                ? loaders.loadContracts(fallbackContracts)
                : fallbackContracts;
        const modeId =
            (contracts.MODE_IDS && contracts.MODE_IDS[cfg.modeIdKey]) ||
            cfg.fallbackModeId;

        let session = null;

        function capabilities() {
            if (capsApi && typeof capsApi.getModeCapabilities === "function") {
                return capsApi.getModeCapabilities(modeId);
            }
            return Object.assign({}, cfg.fallbackCaps || {});
        }

        function status(message, kind) {
            if (typeof opts.onStatus === "function") {
                opts.onStatus(message, kind);
            } else if (session && typeof session.emit === "function") {
                session.emit("info", message, kind || "info");
            }
        }

        function afterMove() {
            /* tool docks do not apply play moves */
        }

        function attach(sess) {
            session = sess;
            if (session && typeof session.setEngine === "function") {
                session.setEngine(null);
            }
            if (session && typeof session.emit === "function") {
                session.emit("capabilitiesChanged", capabilities());
            }
            if (cfg.statusKey) {
                status(t(cfg.statusKey), "info");
            }
        }

        function detach() {
            session = null;
        }

        return {
            id: modeId,
            capabilities: capabilities,
            attach: attach,
            detach: detach,
            afterMove: afterMove,
        };
    }

    const ToolDockMode = { create: create };

    global.ShmerlingToolDockMode = ToolDockMode;

    if (typeof module === "object" && module && module.exports) {
        module.exports = ToolDockMode;
    }
})(typeof window !== "undefined" ? window : globalThis);
