/**
 * PracticeMode — local self-play / Debug (Phase 6).
 *
 * Both sides are human; no engine and no network. Undo/redo are single-ply
 * (classic PracticeGame), unlike LocalEngineMode's human+engine pairs.
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
                MODE_IDS: { PRACTICE: "practice" },
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
            (contracts.MODE_IDS && contracts.MODE_IDS.PRACTICE) || "practice";

        let session = null;

        function capabilities() {
            if (capsApi && typeof capsApi.getModeCapabilities === "function") {
                return capsApi.getModeCapabilities(modeId);
            }
            return {
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
            /* no engine reply */
        }

        function attach(sess) {
            session = sess;
            if (session && typeof session.setEngine === "function") {
                session.setEngine(null);
            }
            if (session && typeof session.emit === "function") {
                session.emit("capabilitiesChanged", capabilities());
            }
            status("Practice — both sides", "info");
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
            /** Single-ply undo (Practice / Debug). */
            undoPly: true,
            redoPly: true,
        };
    }

    const PracticeMode = { create: create };

    global.ShmerlingPracticeMode = PracticeMode;

    if (typeof module === "object" && module && module.exports) {
        module.exports = PracticeMode;
    }
})(typeof window !== "undefined" ? window : globalThis);
