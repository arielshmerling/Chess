/**
 * Ordered site (home / list / friends / login shell) script lists for bundling.
 * Locale catalogs stay per-request via locale-scripts.ejs.
 * Play (/play) bundles are separate — do not add Play-only modules here.
 */
"use strict";

const path = require("path");

const ROOT = path.join(__dirname, "..");

function abs(rel) {
    return path.join(ROOT, rel);
}

/** Shared by every site page (login, home, list, …). */
const SITE_SHELL = [
    "src/themes.js",
    "src/pieceSets.js",
    "src/lobby.js",
    "src/a11y/focusTrap.js",
    "src/a11y/bindUiActions.js",
    "src/a11y/enhanceClickables.js",
    "src/siteDialogs.js",
].map(abs);

/** Logged-in desktop topbar prefs / theme chrome. */
const SITE_CHROME = [
    "src/desktop/ui/play-shell-detect.js",
    "src/desktop/ui/desktop-theme-keys.js",
    "src/desktop/ui/desktop-custom-theme.js",
    "src/desktop/ui/desktop-theme.js",
    "src/desktop/ui/desktop-api.js",
    "src/desktop/ui/desktop-game-settings.js",
    "src/desktop/ui/desktop-prefs-gameplay.js",
    "src/desktop/ui/desktop-fullscreen.js",
    "src/desktop/ui/desktop-prefs-display.js",
    "src/desktop/ui/desktop-prefs-language.js",
    "src/desktop/ui/desktop-chrome.js",
].map(abs);

/** Friends / presence / home active-games cards. */
const SITE_SOCIAL = [
    "src/lobbyPresence.js",
    "src/friendInviteOptions.js",
    "src/friendGameInvite.js",
    "src/activeGamesHome.js",
].map(abs);

const BUNDLE_GROUPS = [
    { name: "site-shell.js", files: SITE_SHELL },
    { name: "site-chrome.js", files: SITE_CHROME },
    { name: "site-social.js", files: SITE_SOCIAL },
];

module.exports = {
    ROOT,
    SITE_SHELL,
    SITE_CHROME,
    SITE_SOCIAL,
    BUNDLE_GROUPS,
};
