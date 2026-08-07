/**
 * Central lists for npm test scripts (see package.json + scripts/run-mocha.js).
 *
 * - pgn: only `npm run test:pgn` (excluded from every other mocha suite)
 * - heavy: slow suites (`npm run test:heavy`); also included in `test:all` mocha phase
 * - test:all = mocha (except pgn, including heavy) then `test:web` (API + e2e)
 * - brainFast / brainHeavy: `test:brain` vs `test:brain:all`
 * - light: quick unit subset aimed at finishing under ~1 minute
 */
"use strict";

const pgn = ["test/chess.pgn.test.js"];

const brainHeavy = [
    "test/brain41.shortSearch.test.js",
    "test/brain42_43.midgameSearch.test.js",
    "test/brain42.mateInThree.test.js",
    "test/brain42.searchRegression.test.js",
    "test/brain43.mateInThree.test.js",
    "test/brain43.searchSoundness.test.js",
    "test/brain.legacy.test.js",
];

const brainFast = [
    "test/brain41.pawnEval.test.js",
    "test/brain42.advancedPawn.test.js",
    "test/brain42.adaptiveDepth.test.js",
    "test/brain42.gamePhase.test.js",
    "test/brainConfigService.test.js",
    "test/brainHttpApi.test.js",
    "test/desktopBrainService.test.js",
];

/** Slow non-PGN suites (engine search, real timers, reconnect). */
const heavy = brainHeavy.concat([
    "test/loginFlow.test.js",
    "test/presence.test.js",
    "test/session.onlineMode.heavy.test.js",
    "test/gameHistoryStore.test.js",
]);

/**
 * Fast unit / characterization subset (no PGN, no heavy search, no web HTTP/e2e).
 * Keep this list tight so `npm run test:light` stays under ~1 minute.
 */
const light = [
    "test/strings.test.js",
    "test/themeSchema.test.js",
    "test/customThemeStore.test.js",
    "test/positionValidation.test.js",
    "test/positionValidation.coverage.test.js",
    "test/bookmarkShape.test.js",
    "test/playPaths.test.js",
    "test/session.phase0.test.js",
    "test/session.practiceMode.test.js",
    "test/session.positionSetupMode.test.js",
    "test/adapters.brainHttp.test.js",
    "test/adapters.brainIpc.test.js",
    "test/adapters.createEnginePort.test.js",
    "test/rematchColors.test.js",
    "test/rematchPeerLeft.test.js",
    "test/timeoutGameOver.test.js",
    "test/playUi.movesPanel.test.js",
    "test/playUi.clocksController.test.js",
    "test/playUi.savedGamesModel.test.js",
    "test/playUi.savedGamesList.test.js",
    "test/playUi.reviewModel.test.js",
    "test/playUi.reviewNav.test.js",
    "test/playUi.sessionMode.test.js",
    "test/playUi.dockModeChrome.test.js",
    "test/playUi.actionRail.test.js",
    "test/playUi.statusBar.test.js",
    "test/playUi.engineTurn.test.js",
    "test/playUi.phase1Remainder.test.js",
    "test/playChatPanel.test.js",
    "test/playUi.rightDockMode.test.js",
    "test/servePlayHtml.test.js",
    "test/a11y.focusTrap.test.js",
    "test/a11y.bindUiActions.test.js",
    "test/security.helpers.test.js",
    "test/security.concurrencyGate.test.js",
    "test/engines.fenCodec.test.js",
    "test/engines.enablement.test.js",
    "test/pgnReader.test.js",
    "test/mateScore.test.js",
    "test/gameStateCompact.test.js",
    "test/friendInviteOptions.test.js",
    "test/loginVersion.test.js",
    "test/syncDataPaths.test.js",
    "test/runtime.test.js",
    "test/desktop.ipcChannels.test.js",
    "test/openingBook.desktopPath.test.js",
];

/** Ignored by `npm run test` / default mocha (heavy + pgn). */
const ignoreDefault = pgn.concat(heavy);

/** Ignored by `npm run test:all` (pgn only). */
const ignoreAll = pgn.slice();

module.exports = {
    pgn: pgn,
    heavy: heavy,
    brainFast: brainFast,
    brainHeavy: brainHeavy,
    brainAll: brainFast.concat(brainHeavy),
    light: light,
    ignoreDefault: ignoreDefault,
    ignoreAll: ignoreAll,
};
