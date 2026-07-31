/**
 * Web Play UI preferences stored on the User document (Mongo).
 */

const path = require("path");
const fs = require("fs").promises;
const { User } = require("../modules/user/model");
const {
    DEFAULT_ACTIVE_THEME,
    normalizeStore,
    normalizeActiveThemeId,
    normalizeHiddenThemeIds,
    pickUserThemes,
    pickHiddenThemeIds,
    resolveAvailableActiveTheme,
    mergeThemeStores,
    addSeedThemes,
} = require("../desktop/themeSchema");
const { normalizeSettings, DEFAULT_SETTINGS } = require("../desktop/uiSettingsStore");

const DEFAULT_THEMES = {
    activeTheme: DEFAULT_ACTIVE_THEME,
    themes: [],
};

const BUNDLED_THEMES_PATH = path.join(__dirname, "../../data/desktop-custom-themes.json");

async function readBundledThemesStore() {
    try {
        const raw = await fs.readFile(BUNDLED_THEMES_PATH, "utf8");
        return addSeedThemes(JSON.parse(raw));
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return addSeedThemes({ ...DEFAULT_THEMES });
        }
        throw error;
    }
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

async function readStoredCustomThemes(userId) {
    const user = await User.findById(userId).select("playCustomThemes").lean();
    const raw = (user && user.playCustomThemes) || { ...DEFAULT_THEMES };
    return {
        store: normalizeStore(raw),
        hiddenThemeIds: normalizeHiddenThemeIds(raw.hiddenThemeIds),
    };
}

async function readCustomThemes(userId) {
    const bundled = await readBundledThemesStore();
    const stored = await readStoredCustomThemes(userId);
    return mergeThemeStores(bundled, stored.store, stored.hiddenThemeIds);
}

async function writeCustomThemes(userId, store) {
    const bundled = await readBundledThemesStore();
    const stored = await readStoredCustomThemes(userId);
    const normalized = resolveAvailableActiveTheme(store || DEFAULT_THEMES);
    const userOnly = normalizeStore({
        activeTheme: normalized.activeTheme,
        themes: pickUserThemes(bundled, normalized),
    });
    const hiddenThemeIds = pickHiddenThemeIds(bundled, normalized, stored.hiddenThemeIds);
    await User.findByIdAndUpdate(userId, {
        playCustomThemes: { ...userOnly, hiddenThemeIds },
    });
    return mergeThemeStores(bundled, userOnly, hiddenThemeIds);
}

/**
 * Members may change which theme is active, but not create/edit/delete themes.
 */
async function writeActiveThemeOnly(userId, activeTheme) {
    const bundled = await readBundledThemesStore();
    const stored = await readStoredCustomThemes(userId);
    const available = mergeThemeStores(bundled, stored.store, stored.hiddenThemeIds);
    const requested = normalizeActiveThemeId(activeTheme);
    const requestedId = requested.slice(7);
    const nextActive = available.themes.some((theme) => theme.id === requestedId)
        ? requested
        : available.activeTheme || DEFAULT_ACTIVE_THEME;
    const userOnly = normalizeStore({
        activeTheme: nextActive,
        themes: stored.store.themes,
    });
    await User.findByIdAndUpdate(userId, {
        playCustomThemes: { ...userOnly, hiddenThemeIds: stored.hiddenThemeIds },
    });
    return mergeThemeStores(bundled, userOnly, stored.hiddenThemeIds);
}

module.exports = {
    readUiSettings,
    writeUiSettings,
    readCustomThemes,
    writeCustomThemes,
    writeActiveThemeOnly,
    pickUserThemes,
    pickHiddenThemeIds,
};
