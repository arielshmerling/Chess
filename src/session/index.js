/**
 * Session package entry.
 * Phase 0: contracts + capabilities.
 * Phase 2: GameSession, LocalEngineMode, ReviewMode.
 * Phase 3: OnlineMode + WsTransport + online protocol helpers.
 * Phase 6: PracticeMode (local self-play / Debug).
 * Phase 7: PositionSetupMode + ConfigurationMode.
 */

"use strict";

const { MODE_IDS } = require("./contracts");
const { MODE_CAPABILITIES, getModeCapabilities } = require("./capabilities");
const EventBus = require("./eventBus");
const GameSession = require("./gameSession");
const LocalEngineMode = require("./localEngineMode");
const ReviewMode = require("./reviewMode");
const OnlineMode = require("./onlineMode");
const OnlineProtocol = require("./onlineProtocol");
const WsTransport = require("./wsTransport");
const PracticeMode = require("./practiceMode");
const PositionSetupMode = require("./positionSetupMode");
const ConfigurationMode = require("./configurationMode");

module.exports = {
    MODE_IDS,
    MODE_CAPABILITIES,
    getModeCapabilities,
    EventBus,
    GameSession,
    LocalEngineMode,
    ReviewMode,
    OnlineMode,
    OnlineProtocol,
    WsTransport,
    PracticeMode,
    PositionSetupMode,
    ConfigurationMode,
};
