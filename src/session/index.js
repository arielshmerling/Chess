/**
 * Session package entry.
 * Phase 0: contracts + capabilities.
 * Phase 2 complete (single-player ports-clean): GameSession, LocalEngineMode,
 * ReviewMode (nav), event bus. Phase 3+: OnlineMode and further modes.
 */

"use strict";

const { MODE_IDS } = require("./contracts");
const { MODE_CAPABILITIES, getModeCapabilities } = require("./capabilities");
const EventBus = require("./eventBus");
const GameSession = require("./gameSession");
const LocalEngineMode = require("./localEngineMode");
const ReviewMode = require("./reviewMode");

module.exports = {
    MODE_IDS,
    MODE_CAPABILITIES,
    getModeCapabilities,
    EventBus,
    GameSession,
    LocalEngineMode,
    ReviewMode,
};
