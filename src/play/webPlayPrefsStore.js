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

function sameThemeContent(a, b) {
    if (!a || !b || a.name !== b.name) {
        return false;
    }
    const keys = Object.keys(a.vars || {});
    if (keys.length !== Object.keys(b.vars || {}).length) {
        return false;
    }
    return keys.every((key) => a.vars[key] === b.vars[key]);
}

/**
 * Themes worth storing on the user document: everything the client sent except
 * bundled themes it left untouched. An edited bundled theme must be kept, or the
 * user's changes are silently dropped and the bundled copy wins on the next read.
 */
function pickUserThemes(bundled, store) {
    const bundledById = new Map(bundled.themes.map((theme) => [theme.id, theme]));
    return store.themes.filter((theme) => {
        const original = bundledById.get(theme.id);
        return !original || !sameThemeContent(theme, original);
    });
}

function normalizeHiddenThemeIds(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.filter((id) => typeof id === "string" && id !== "");
}

/**
 * Bundled themes the user deleted. They are absent from the user's theme list,
 * so without this list the merge below would keep resurrecting them.
 * @param {{ themes: Array<{id: string}> }} bundled
 * @param {{ themes: Array<{id: string}> }} store Themes the client just sent
 * @param {string[]} previouslyHidden
 */
function pickHiddenThemeIds(bundled, store, previouslyHidden) {
    const sentIds = new Set(store.themes.map((theme) => theme.id));
    const hidden = new Set(previouslyHidden);
    // An empty list is more likely a client that failed to load than a real
    // "delete everything", so only infer new deletions from a populated list.
    if (sentIds.size > 0) {
        for (const theme of bundled.themes) {
            if (!sentIds.has(theme.id)) {
                hidden.add(theme.id);
            }
        }
    }
    for (const id of sentIds) {
        hidden.delete(id);
    }
    return Array.from(hidden);
}

function mergeThemeStores(bundled, user, hiddenThemeIds) {
    const hidden = new Set(normalizeHiddenThemeIds(hiddenThemeIds));
    const byId = new Map();
    for (const theme of bundled.themes) {
        if (!hidden.has(theme.id)) {
            byId.set(theme.id, theme);
        }
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
    const normalized = normalizeStore(store || DEFAULT_THEMES);
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
    const nextActive =
        activeTheme === "blue"
        || activeTheme === "dark"
        || (typeof activeTheme === "string" && activeTheme.indexOf("custom:") === 0)
            ? activeTheme
            : stored.store.activeTheme || "blue";
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
