/**
 * Session package entry (Phase 0).
 * Contracts + capability tables only; orchestration arrives in later phases.
 */

"use strict";

const { MODE_IDS } = require("./contracts");
const { MODE_CAPABILITIES, getModeCapabilities } = require("./capabilities");

module.exports = {
    MODE_IDS,
    MODE_CAPABILITIES,
    getModeCapabilities,
};
