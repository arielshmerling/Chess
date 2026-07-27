/**
 * Session layer contracts (Phase 0).
 *
 * Typedefs + shared MODE_IDS. Dual export for Node tests and browser Play shell.
 */
(function (global) {
    "use strict";

    /**
     * @readonly
     * @enum {string}
     */
    const MODE_IDS = Object.freeze({
        LOCAL_ENGINE: "localEngine",
        ONLINE: "online",
        PRACTICE: "practice",
        REVIEW: "review",
        WATCH: "watch",
        POSITION_SETUP: "positionSetup",
    });

    const Contracts = {
        MODE_IDS: MODE_IDS,
    };

    global.ShmerlingSessionContracts = Contracts;

    if (typeof module === "object" && module && module.exports) {
        module.exports = Contracts;
    }
})(typeof window !== "undefined" ? window : globalThis);
