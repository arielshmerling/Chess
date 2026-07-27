/**
 * Declared capabilities per mode (Phase 0 — documentation + tests).
 * Shells will read these from the active GameMode in later phases.
 *
 * @module session/capabilities
 */

"use strict";

const { MODE_IDS } = require("./contracts");

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

/**
 * Intended capabilities for each mode id.
 * Update deliberately when product rules change; covered by unit tests.
 */
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
    /* Phase 3 core online; draw/rematch/watchers/chat expand in Phase 4. */
    [MODE_IDS.ONLINE]: caps({
        undo: false,
        redo: false,
        resign: true,
        draw: false,
        rematch: false,
        engine: false,
        network: true,
        reviewNav: false,
        positionSetup: false,
        watchers: false,
        chat: false,
    }),
    [MODE_IDS.PRACTICE]: caps({
        undo: true,
        redo: true,
        resign: true,
        draw: false,
        rematch: false,
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

module.exports = {
    MODE_CAPABILITIES,
    getModeCapabilities,
};
