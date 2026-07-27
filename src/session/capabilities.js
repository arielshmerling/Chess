/**
 * Declared capabilities per mode.
 * Dual export for Node tests and browser Play shell.
 */
(function (global) {
    "use strict";

    function loadContracts() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./contracts");
            } catch {
                /* fall through */
            }
        }
        return global.ShmerlingSessionContracts || {
            MODE_IDS: {
                LOCAL_ENGINE: "localEngine",
                ONLINE: "online",
                PRACTICE: "practice",
                REVIEW: "review",
                WATCH: "watch",
                POSITION_SETUP: "positionSetup",
            },
        };
    }

    const { MODE_IDS } = loadContracts();

    /** @type {import("./contracts").ModeCapabilities} */
    const NONE = Object.freeze({
        undo: false,
        redo: false,
        resign: false,
        draw: false,
        rematch: false,
        engine: false,
        network: false,
        reviewNav: false,
        positionSetup: false,
        brainConfig: false,
        watchers: false,
        chat: false,
    });

    /**
     * @param {Partial<import("./contracts").ModeCapabilities>} partial
     * @returns {import("./contracts").ModeCapabilities}
     */
    function caps(partial) {
        return Object.freeze(Object.assign({}, NONE, partial));
    }

    const MODE_CAPABILITIES = Object.freeze({
        [MODE_IDS.LOCAL_ENGINE]: caps({
            undo: true,
            redo: true,
            resign: true,
            draw: false,
            rematch: true,
            engine: true,
            network: false,
            reviewNav: false,
            positionSetup: false,
            watchers: false,
            chat: false,
        }),
        /* Phase 4–5: draw + rematch for players; live watch uses MODE_IDS.WATCH. */
        [MODE_IDS.ONLINE]: caps({
            undo: false,
            redo: false,
            resign: true,
            draw: true,
            rematch: true,
            engine: false,
            network: true,
            reviewNav: false,
            positionSetup: false,
            watchers: false,
            chat: false,
        }),
        /* rematch:true = local "New game" after finish (not online rematch offers). */
        [MODE_IDS.PRACTICE]: caps({
            undo: true,
            redo: true,
            resign: true,
            draw: false,
            rematch: true,
            engine: false,
            network: false,
            reviewNav: false,
            positionSetup: false,
            watchers: false,
            chat: false,
        }),
        [MODE_IDS.REVIEW]: caps({
            undo: false,
            redo: false,
            resign: false,
            draw: false,
            rematch: false,
            engine: false,
            network: false,
            reviewNav: true,
            positionSetup: false,
            watchers: false,
            chat: false,
        }),
        [MODE_IDS.WATCH]: caps({
            undo: false,
            redo: false,
            resign: false,
            draw: false,
            rematch: false,
            engine: false,
            network: true,
            reviewNav: false,
            positionSetup: false,
            watchers: true,
            chat: false,
        }),
        [MODE_IDS.POSITION_SETUP]: caps({
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
        }),
        [MODE_IDS.CONFIGURATION]: caps({
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
        }),
    });

    /**
     * @param {string} modeId
     * @returns {import("./contracts").ModeCapabilities}
     */
    function getModeCapabilities(modeId) {
        const found = MODE_CAPABILITIES[modeId];
        if (!found) {
            return caps({});
        }
        return found;
    }

    const Capabilities = {
        MODE_CAPABILITIES: MODE_CAPABILITIES,
        getModeCapabilities: getModeCapabilities,
    };

    global.ShmerlingSessionCapabilities = Capabilities;

    if (typeof module === "object" && module && module.exports) {
        module.exports = Capabilities;
    }
})(typeof window !== "undefined" ? window : globalThis);
