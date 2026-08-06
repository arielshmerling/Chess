/**
 * Suites whose individual cases routinely exceed ~1s (engine search, real timers, PGN replay).
 * Listed here so npm run test:heavy / test:all / test:coverage stay in sync.
 */
"use strict";

module.exports = [
    "test/chess.pgn.test.js",
    "test/brain41.shortSearch.test.js",
    "test/brain42_43.midgameSearch.test.js",
    "test/brain42.mateInThree.test.js",
    "test/brain42.searchRegression.test.js",
    "test/brain43.mateInThree.test.js",
    "test/brain43.searchSoundness.test.js",
    "test/loginFlow.test.js",
    "test/presence.test.js",
    "test/session.onlineMode.heavy.test.js",
    "test/gameHistoryStore.test.js",
];
