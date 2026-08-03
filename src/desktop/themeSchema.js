/**
 * Desktop theme variable keys and completion against built-in presets.
 * Only variables referenced by the desktop app are stored in custom themes.
 */

const path = require("path");
const { blueTheme, darkTheme } = require("./builtinThemes");
const { THEME_VAR_KEYS } = require(path.join(__dirname, "ui", "desktop-theme-keys"));

const DEFAULT_ACTIVE_THEME = "custom:custom-mr45iwvr";

function sanitizeThemeVarValue(value) {
    if (typeof value !== "string") {
        return value == null ? "" : String(value);
    }
    return value.trim().replace(/;+\s*$/g, "");
}

function getBuiltinTheme(themeId) {
    return themeId === "dark" ? { ...darkTheme } : { ...blueTheme };
}

function createSeedThemeEntries() {
    return [
        {
            id: "blue",
            name: "Blue",
            vars: completeThemeVars(blueTheme, "blue"),
            updatedAt: 0,
        },
        {
            id: "dark",
            name: "Dark",
            vars: completeThemeVars(darkTheme, "dark"),
            updatedAt: 0,
        },
    ];
}

function normalizeActiveThemeId(activeTheme) {
    if (activeTheme === "blue" || activeTheme === "dark") {
        return "custom:" + activeTheme;
    }
    if (typeof activeTheme === "string" && activeTheme.indexOf("custom:") === 0) {
        return activeTheme;
    }
    return DEFAULT_ACTIVE_THEME;
}

/**
 * Fill every desktop theme key; drop unknown keys.
 * @param {Record<string, string>|null|undefined} overlay
 * @param {"blue"|"dark"} [fallbackThemeId]
 */
function completeThemeVars(overlay, fallbackThemeId = "blue") {
    const base = getBuiltinTheme(fallbackThemeId === "dark" ? "dark" : "blue");
    const out = {};
    for (const key of THEME_VAR_KEYS) {
        const fromOverlay =
            overlay && overlay[key] != null && String(overlay[key]).trim() !== ""
                ? overlay[key]
                : null;
        const value = fromOverlay != null ? fromOverlay : base[key];
        out[key] = sanitizeThemeVarValue(value != null ? value : "");
    }
    return out;
}

function normalizeThemeEntry(entry, fallbackThemeId = "blue") {
    if (!entry || typeof entry.id !== "string") {
        return null;
    }
    return {
        id: entry.id,
        name: typeof entry.name === "string" ? entry.name : "New theme",
        vars: completeThemeVars(entry.vars, fallbackThemeId),
        updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : Date.now(),
    };
}

function normalizeStore(raw, fallbackThemeId = "blue") {
    const store = {
        activeTheme: DEFAULT_ACTIVE_THEME,
        themes: [],
    };
    if (!raw || typeof raw !== "object") {
        return store;
    }
    store.activeTheme = normalizeActiveThemeId(raw.activeTheme);
    if (Array.isArray(raw.themes)) {
        store.themes = raw.themes
            .map((t) => normalizeThemeEntry(t, fallbackThemeId))
            .filter(Boolean);
    }
    return store;
}

function normalizeHiddenThemeIds(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.filter((id) => typeof id === "string" && id !== "");
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

function pickUserThemes(bundled, store) {
    const bundledById = new Map(bundled.themes.map((theme) => [theme.id, theme]));
    return store.themes.filter((theme) => {
        const original = bundledById.get(theme.id);
        return !original || !sameThemeContent(theme, original);
    });
}

function pickHiddenThemeIds(bundled, store, previouslyHidden) {
    const sentIds = new Set(store.themes.map((theme) => theme.id));
    const hidden = new Set(normalizeHiddenThemeIds(previouslyHidden));
    for (const theme of bundled.themes) {
        if (!sentIds.has(theme.id)) {
            hidden.add(theme.id);
        }
    }
    for (const id of sentIds) {
        hidden.delete(id);
    }
    return Array.from(hidden);
}

function resolveAvailableActiveTheme(store) {
    const normalized = normalizeStore(store);
    const activeId = normalized.activeTheme.slice(7);
    if (normalized.themes.some((theme) => theme.id === activeId)) {
        return normalized;
    }
    return {
        ...normalized,
        activeTheme: normalized.themes.length
            ? "custom:" + normalized.themes[0].id
            : DEFAULT_ACTIVE_THEME,
    };
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
    return resolveAvailableActiveTheme({
        activeTheme: user.activeTheme || bundled.activeTheme || DEFAULT_ACTIVE_THEME,
        themes: Array.from(byId.values()),
    });
}

function addSeedThemes(store) {
    const normalized = normalizeStore(store);
    const byId = new Map(createSeedThemeEntries().map((theme) => [theme.id, theme]));
    for (const theme of normalized.themes) {
        byId.set(theme.id, theme);
    }
    return normalizeStore({
        activeTheme: normalized.activeTheme,
        themes: Array.from(byId.values()),
    });
}

module.exports = {
    DEFAULT_ACTIVE_THEME,
    THEME_VAR_KEYS,
    sanitizeThemeVarValue,
    getBuiltinTheme,
    createSeedThemeEntries,
    normalizeActiveThemeId,
    completeThemeVars,
    normalizeThemeEntry,
    normalizeStore,
    normalizeHiddenThemeIds,
    pickUserThemes,
    pickHiddenThemeIds,
    resolveAvailableActiveTheme,
    mergeThemeStores,
    addSeedThemes,
};
