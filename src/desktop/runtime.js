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
    seedOpeningBookLinesIfMissing();
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

function requireUserDataRoot() {
    ensureInitialized();
    if (!userDataRoot) {
        throw new Error("desktop runtime: userDataRoot is not initialized");
    }
    return userDataRoot;
}

function getBookmarksFilePath() {
    return path.join(requireUserDataRoot(), "bookmarks.json");
}

function getGamesDir() {
    return path.join(requireUserDataRoot(), "games");
}

function getSettingsFilePath() {
    return path.join(requireUserDataRoot(), "settings.json");
}

function getCustomThemesFilePath() {
    return path.join(requireUserDataRoot(), "custom-themes.json");
}

/** Shipped preset themes (edit to bundle themes with the product). */
function getBundledCustomThemesPath() {
    return path.join(__dirname, "..", "..", "data", "desktop-custom-themes.json");
}

function getBrainConfigDir() {
    return path.join(requireUserDataRoot(), "brain-config");
}

function getBundledOpeningBookLinesPath() {
    return path.join(__dirname, "..", "..", "data", "opening-book-lines.txt");
}

function getUserOpeningBookLinesPath() {
    return path.join(requireUserDataRoot(), "opening-book-lines.txt");
}

/**
 * Line-based opening book (prefix lookup).
 * @returns {string}
 */
function resolveOpeningBookLinesPath() {
    const userCopy = getUserOpeningBookLinesPath();
    if (fs.existsSync(userCopy)) {
        return userCopy;
    }
    return getBundledOpeningBookLinesPath();
}

function seedOpeningBookLinesIfMissing() {
    if (!userDataRoot) {
        return;
    }
    const dest = path.join(userDataRoot, "opening-book-lines.txt");
    if (fs.existsSync(dest)) {
        return;
    }
    const bundled = getBundledOpeningBookLinesPath();
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
    return "brain43";
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
    getBundledOpeningBookLinesPath,
    getUserOpeningBookLinesPath,
    resolveOpeningBookLinesPath,
    getHomePath,
    normalizeEngine,
};
