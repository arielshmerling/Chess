/**
 * Mocha require hook: do not sync theme catalog into the repo during tests,
 * and restore data/desktop-custom-themes.json if it was left dirty.
 */
"use strict";

const {
    disableRepoSync,
    restoreBundledThemes,
} = require("./helpers/bundledThemesGuard");

disableRepoSync();

exports.mochaHooks = {
    afterAll: function restoreThemesAfterSuite() {
        restoreBundledThemes();
    },
};
