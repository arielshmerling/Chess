/**
 * ConfigurationMode — brain parameter dock (Phase 7).
 *
 * Presentation stays in DesktopBrainConfig; this plugin owns session
 * identity + capabilities while the config dock is open.
 */
(function (global) {
    "use strict";

    function loadToolDock() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./toolDockMode");
            } catch {
                /* fall through */
            }
        }
        return global.ShmerlingToolDockMode;
    }

    /**
     * @param {object} [options]
     * @param {(msg: string, kind?: string) => void} [options.onStatus]
     */
    function create(options) {
        return loadToolDock().create(
            {
                modeIdKey: "CONFIGURATION",
                fallbackModeId: "configuration",
                statusKey: "session.configurationModeEdit",
                fallbackCaps: {
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
                },
            },
            options,
        );
    }

    const ConfigurationMode = { create: create };

    global.ShmerlingConfigurationMode = ConfigurationMode;

    if (typeof module === "object" && module && module.exports) {
        module.exports = ConfigurationMode;
    }
})(typeof window !== "undefined" ? window : globalThis);
