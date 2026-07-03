/**
 * Shmerling desktop (Electron) runtime: paths, mode detection, first-run setup.
 * Web server never sets SHMERLING_MODE — all branches here are inactive online.
 */

const fs = require("fs");
const path = require("path");

/** Fixed 24-hex id (matches WS/Mongo id shape); not stored in MongoDB. */
const GUEST_USER_ID = "00000000000000000000d001";
const GUEST_USER_NAME = "Player";
const DESKTOP_ENGINES = ["brain41", "brain42", "brain43"];

let userDataRoot = null;
let initialized = false;

function isDesktopMode() {
    return process.env.SHMERLING_MODE === "desktop";
}

/**
 * @param {{ userDataPath: string }} opts
 */
function init(opts) {
    if (!isDesktopMode()) {
        return;
    }
    if (!opts || !opts.userDataPath) {
        throw new Error("desktop runtime: userDataPath required");
    }
    userDataRoot = opts.userDataPath;
    fs.mkdirSync(userDataRoot, { recursive: true });
    fs.mkdirSync(path.join(userDataRoot, "games"), { recursive: true });
    fs.mkdirSync(path.join(userDataRoot, "brain-config"), { recursive: true });
    seedBrainConfigsIfMissing();
    seedOpeningBookIfMissing();
    initialized = true;
}

function ensureInitialized() {
    if (!isDesktopMode()) {
        return;
    }
    if (!initialized) {
        const fallback = process.env.SHMERLING_USER_DATA;
        if (fallback) {
            init({ userDataPath: fallback });
        }
    }
}

function getUserDataRoot() {
    ensureInitialized();
    return userDataRoot;
}

function getBookmarksFilePath() {
    ensureInitialized();
    return path.join(userDataRoot, "bookmarks.json");
}

function getGamesDir() {
    ensureInitialized();
    return path.join(userDataRoot, "games");
}

function getSettingsFilePath() {
    ensureInitialized();
    return path.join(userDataRoot, "settings.json");
}

function getCustomThemesFilePath() {
    ensureInitialized();
    return path.join(userDataRoot, "custom-themes.json");
}

/** Shipped preset themes (edit to bundle themes with the product). */
function getBundledCustomThemesPath() {
    return path.join(__dirname, "..", "..", "data", "desktop-custom-themes.json");
}

function getBrainConfigDir() {
    ensureInitialized();
    return path.join(userDataRoot, "brain-config");
}

/** Bundled opening book in the repo / Electron resources. */
function getBundledOpeningBookPath() {
    return path.join(__dirname, "..", "..", "data", "opening-book-states.json");
}

/** Writable copy in userData (used for reads when present). */
function getUserOpeningBookPath() {
    ensureInitialized();
    return path.join(userDataRoot, "opening-book-states.json");
}

/**
 * Opening book path for {@link gamesManagerService} in desktop mode.
 * @returns {string}
 */
function resolveOpeningBookPath() {
    const userCopy = getUserOpeningBookPath();
    if (fs.existsSync(userCopy)) {
        return userCopy;
    }
    return getBundledOpeningBookPath();
}

function seedOpeningBookIfMissing() {
    if (!userDataRoot) {
        return;
    }
    const dest = path.join(userDataRoot, "opening-book-states.json");
    if (fs.existsSync(dest)) {
        return;
    }
    const bundled = getBundledOpeningBookPath();
    if (fs.existsSync(bundled)) {
        fs.copyFileSync(bundled, dest);
    }
}

function seedBrainConfigsIfMissing() {
    if (!userDataRoot) {
        return;
    }
    const brainConfigDir = path.join(userDataRoot, "brain-config");
    const bundledDir = path.join(__dirname, "..", "config", "brains");
    for (const engine of DESKTOP_ENGINES) {
        const dest = path.join(brainConfigDir, `${engine}.json`);
        if (fs.existsSync(dest)) {
            continue;
        }
        const src = path.join(bundledDir, `${engine}.json`);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
        }
    }
}

function getHomePath() {
    return isDesktopMode() ? "/app/play" : "/home";
}

function normalizeEngine(engine) {
    const name = typeof engine === "string" ? engine.trim() : "";
    if (DESKTOP_ENGINES.includes(name)) {
        return name;
    }
    return "brain41";
}

module.exports = {
    GUEST_USER_ID,
    GUEST_USER_NAME,
    DESKTOP_ENGINES,
    isDesktopMode,
    init,
    ensureInitialized,
    getUserDataRoot,
    getBookmarksFilePath,
    getGamesDir,
    getSettingsFilePath,
    getCustomThemesFilePath,
    getBundledCustomThemesPath,
    getBrainConfigDir,
    getBundledOpeningBookPath,
    getUserOpeningBookPath,
    resolveOpeningBookPath,
    getHomePath,
    normalizeEngine,
};
