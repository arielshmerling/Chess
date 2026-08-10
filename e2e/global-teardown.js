/**
 * Playwright global teardown: restore bundled themes if the e2e server
 * rewrote data/desktop-custom-themes.json (SHMERLING_SYNC_CUSTOM_THEMES).
 */
"use strict";

const {
    restoreBundledThemes,
} = require("../test/helpers/bundledThemesGuard");

module.exports = async function globalTeardown() {
    restoreBundledThemes();
};
