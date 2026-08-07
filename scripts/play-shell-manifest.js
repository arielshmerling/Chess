/**
 * Ordered Play shell script lists for bundling (IIFE globals, preserve order).
 * Locale catalogs are injected per-request and are not bundled here.
 */
"use strict";

const path = require("path");

const ROOT = path.join(__dirname, "..");

function abs(rel) {
    return path.join(ROOT, rel);
}

/** Core chess + theme primitives (needed before session/shell). */
const PLAY_CORE = [
    "src/validation/positionValidation.js",
    "src/ChessGame.js",
    "src/themes.js",
    "src/pieceSets.js",
].map(abs);

/** Session + play-ui modules. */
const PLAY_SESSION = [
    "src/play-ui/moves-panel.js",
    "src/play-ui/clocks-controller.js",
    "src/play-ui/saved-games-model.js",
    "src/play-ui/saved-games-list.js",
    "src/play-ui/review-model.js",
    "src/play-ui/review-nav.js",
    "src/play-ui/session-mode.js",
    "src/play-ui/dock-mode-chrome.js",
    "src/play-ui/action-rail.js",
    "src/play-ui/status-bar.js",
    "src/play-ui/engine-turn.js",
    "src/play-ui/evaluation-display.js",
    "src/play-ui/action-buttons-policy.js",
    "src/play-ui/launch-options.js",
    "src/play-ui/keyboard-shortcuts.js",
    "src/play-ui/bookmark-helpers.js",
    "src/play-ui/play-chat-panel.js",
    "src/play-ui/right-dock-mode.js",
    "src/session/eventBus.js",
    "src/session/contracts.js",
    "src/session/capabilities.js",
    "src/session/sessionLoaders.js",
    "src/session/gameSession.js",
    "src/session/localEngineMode.js",
    "src/session/reviewMode.js",
    "src/session/practiceMode.js",
    "src/session/toolDockMode.js",
    "src/session/positionSetupMode.js",
    "src/session/configurationMode.js",
    "src/session/onlineProtocol.js",
    "src/session/wsTransport.js",
    "src/session/onlineMode.js",
    "src/session/spServerSync.js",
].map(abs);

/** Desktop Play shell UI (ends with desktop-play.js). */
const PLAY_SHELL = [
    "src/desktop/ui/play-shell-detect.js",
    "src/desktop/ui/desktop-theme-keys.js",
    "src/desktop/ui/desktop-custom-theme.js",
    "src/desktop/ui/desktop-theme.js",
    "src/desktop/ui/desktop-chrome.js",
    "src/desktop/ui/desktop-api.js",
    "src/desktop/ui/desktop-game-settings.js",
    "src/desktop/ui/desktop-prefs-gameplay.js",
    "src/desktop/ui/desktop-fullscreen.js",
    "src/desktop/ui/desktop-prefs-display.js",
    "src/desktop/ui/desktop-prefs-language.js",
    "src/adapters/brainHttp.js",
    "src/adapters/brainIpc.js",
    "src/adapters/createEnginePort.js",
    "src/desktop/ui/desktop-engine.js",
    "src/desktop/ui/desktop-game-log.js",
    "src/a11y/focusTrap.js",
    "src/a11y/bindUiActions.js",
    "src/a11y/enhanceClickables.js",
    "src/desktop/ui/desktop-dialog.js",
    "src/desktop/ui/desktop-context-menu.js",
    "src/desktop/ui/desktop-start-menu.js",
    "src/desktop/ui/desktop-board.js",
    "src/desktop/ui/desktop-board-scale.js",
    "src/desktop/ui/desktop-dock-panels.js",
    "src/desktop/ui/desktop-position-setup.js",
    "src/desktop/ui/desktop-brain-config.js",
    "src/desktop/ui/desktop-game-run.js",
    "src/desktop/ui/desktop-position-validation.js",
    "src/desktop/ui/desktop-play-resume.js",
    "src/desktop/ui/desktop-play.js",
].map(abs);

const BUNDLE_GROUPS = [
    { name: "play-core.js", files: PLAY_CORE },
    { name: "play-session.js", files: PLAY_SESSION },
    { name: "play-shell.js", files: PLAY_SHELL },
];

const SUPPORTED_LOCALES = [
    "en",
    "he",
    "ja",
    "fr",
    "de",
    "zh",
    "ar",
    "hi",
    "es",
    "ru",
    "uk",
    "no",
    "bn",
    "pt",
];

module.exports = {
    ROOT,
    PLAY_CORE,
    PLAY_SESSION,
    PLAY_SHELL,
    BUNDLE_GROUPS,
    SUPPORTED_LOCALES,
};
