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
        CONFIGURATION: "configuration",
    });

    /**
     * Injected brain / engine boundary used by LocalEngineMode (Phase 9).
     * Session core never calls fetch('/api/…') — shells inject Http or Ipc ports.
     *
     * @typedef {object} EnginePort
     * @property {(opts: object) => Promise<object|null>} computeMove
     * @property {(opts: object) => Promise<object|*>} [evaluatePosition]
     * @property {() => Promise<void>} [abortSearch]
     */

    /**
     * Online match transport (Phase 3+). Injected into OnlineMode.
     *
     * @typedef {object} MatchTransport
     * @property {(url: string) => void} [connect]
     * @property {(msg: object) => void} [send]
     * @property {() => void} [close]
     */

    const Contracts = {
        MODE_IDS: MODE_IDS,
    };

    global.ShmerlingSessionContracts = Contracts;

    if (typeof module === "object" && module && module.exports) {
        module.exports = Contracts;
    }
})(typeof window !== "undefined" ? window : globalThis);
