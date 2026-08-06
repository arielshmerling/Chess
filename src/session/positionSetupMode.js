/**
 * PositionSetupMode — place pieces / edit board (Phase 7).
 *
 * Presentation stays in DesktopPositionSetup; this plugin owns session
 * identity + capabilities so setup cannot share an OnlineMode attach.
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
                modeIdKey: "POSITION_SETUP",
                fallbackModeId: "positionSetup",
                statusKey: "session.positionSetupPlacePieces",
                fallbackCaps: {
                    undo: false,
                    redo: false,
                    resign: false,
                    draw: false,
                    rematch: false,
                    engine: false,
                    network: false,
                    reviewNav: false,
                    positionSetup: true,
                    brainConfig: false,
                    watchers: false,
                    chat: false,
                },
            },
            options,
        );
    }

    const PositionSetupMode = { create: create };

    global.ShmerlingPositionSetupMode = PositionSetupMode;

    if (typeof module === "object" && module && module.exports) {
        module.exports = PositionSetupMode;
    }
})(typeof window !== "undefined" ? window : globalThis);
