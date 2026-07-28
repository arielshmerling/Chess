/**
 * ConfigurationMode — brain parameter dock (Phase 7).
 *
 * Presentation stays in DesktopBrainConfig; this plugin owns session
 * identity + capabilities while the config dock is open.
 */
(function (global) {
    "use strict";

    function loadCapabilities() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./capabilities");
            } catch {
                /* fall through */
            }
        }
        return global.ShmerlingSessionCapabilities || null;
    }

    function loadT() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("../strings/t-bridge").t;
            } catch {
                /* fall through */
            }
        }
        return typeof global.ShmerlingT === "function" ? global.ShmerlingT : function (key) {
            return key;
        };
    }

    const t = loadT();

    function loadContracts() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./contracts");
            } catch {
                /* fall through */
            }
        }
        return (
            global.ShmerlingSessionContracts || {
                MODE_IDS: { CONFIGURATION: "configuration" },
            }
        );
    }

    /**
     * @param {object} [options]
     * @param {(msg: string, kind?: string) => void} [options.onStatus]
     */
    function create(options) {
        const opts = options || {};
        const capsApi = loadCapabilities();
        const contracts = loadContracts();
        const modeId =
            (contracts.MODE_IDS && contracts.MODE_IDS.CONFIGURATION) ||
            "configuration";

        let session = null;

        function capabilities() {
            if (capsApi && typeof capsApi.getModeCapabilities === "function") {
                return capsApi.getModeCapabilities(modeId);
            }
            return {
                undo: false,
                redo: false,
                resign: false,
                draw: false,
                rematch: false,
                engine: false,
                network: false,
                reviewNav: false,
                positionSetup: false,
                brainConfig: true,
                watchers: false,
                chat: false,
            };
        }

        function status(message, kind) {
            if (typeof opts.onStatus === "function") {
                opts.onStatus(message, kind);
            } else if (session && typeof session.emit === "function") {
                session.emit("info", message, kind || "info");
            }
        }

        function afterMove() {
            /* no moves in configuration */
        }

        function attach(sess) {
            session = sess;
            if (session && typeof session.setEngine === "function") {
                session.setEngine(null);
            }
            if (session && typeof session.emit === "function") {
                session.emit("capabilitiesChanged", capabilities());
            }
            status(t("session.configurationModeEdit"), "info");
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

    const ConfigurationMode = { create: create };

    global.ShmerlingConfigurationMode = ConfigurationMode;

    if (typeof module === "object" && module && module.exports) {
        module.exports = ConfigurationMode;
    }
})(typeof window !== "undefined" ? window : globalThis);
