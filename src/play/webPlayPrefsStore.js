/**
 * Web Play UI preferences stored on the User document (Mongo).
 */

const path = require("path");
const fs = require("fs").promises;
const { User } = require("../modules/user/model");
const { normalizeStore } = require("../desktop/themeSchema");
const { normalizeSettings, DEFAULT_SETTINGS } = require("../desktop/uiSettingsStore");

const DEFAULT_THEMES = {
    activeTheme: "blue",
    themes: [],
};

const BUNDLED_THEMES_PATH = path.join(__dirname, "../../data/desktop-custom-themes.json");

async function readBundledThemesStore() {
    try {
        const raw = await fs.readFile(BUNDLED_THEMES_PATH, "utf8");
        return normalizeStore(JSON.parse(raw));
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return normalizeStore({ ...DEFAULT_THEMES });
        }
        throw error;
    }
}

function mergeThemeStores(bundled, user) {
    const byId = new Map();
    for (const theme of bundled.themes) {
        byId.set(theme.id, theme);
    }
    for (const theme of user.themes) {
        byId.set(theme.id, theme);
    }
    return normalizeStore({
        activeTheme: user.activeTheme || bundled.activeTheme || "blue",
        themes: Array.from(byId.values()),
    });
}

async function readUiSettings(userId) {
    const user = await User.findById(userId).select("playUiSettings").lean();
    if (!user || !user.playUiSettings) {
        return { ...DEFAULT_SETTINGS };
    }
    return normalizeSettings(user.playUiSettings);
}

async function writeUiSettings(userId, partial) {
    const current = await readUiSettings(userId);
    const patch = partial && typeof partial === "object" ? partial : {};
    const merged = {
        ...current,
        ...patch,
        dockPanels: {
            ...current.dockPanels,
            ...(patch.dockPanels && typeof patch.dockPanels === "object" ? patch.dockPanels : {}),
        },
        gamePreferences: {
            ...current.gamePreferences,
            ...(patch.gamePreferences && typeof patch.gamePreferences === "object"
                ? patch.gamePreferences
                : {}),
        },
    };
    const next = normalizeSettings(merged);
    await User.findByIdAndUpdate(userId, { playUiSettings: next });
    return next;
}

async function readCustomThemes(userId) {
    const bundled = await readBundledThemesStore();
    const user = await User.findById(userId).select("playCustomThemes").lean();
    const userStore = user && user.playCustomThemes
        ? normalizeStore(user.playCustomThemes)
        : normalizeStore({ ...DEFAULT_THEMES });
    return mergeThemeStores(bundled, userStore);
}

async function writeCustomThemes(userId, store) {
    const bundled = await readBundledThemesStore();
    const normalized = normalizeStore(store || DEFAULT_THEMES);
    const userOnly = normalizeStore({
        activeTheme: normalized.activeTheme,
        themes: normalized.themes.filter(function (theme) {
            return !bundled.themes.some(function (builtIn) {
                return builtIn.id === theme.id;
            });
        }),
    });
    await User.findByIdAndUpdate(userId, { playCustomThemes: userOnly });
    return mergeThemeStores(bundled, userOnly);
}

module.exports = {
    readUiSettings,
    writeUiSettings,
    readCustomThemes,
    writeCustomThemes,
};
