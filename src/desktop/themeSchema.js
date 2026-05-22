/**
 * Desktop theme variable keys and completion against built-in presets.
 * Only variables referenced by the desktop app are stored in custom themes.
 */

const path = require("path");
const { blueTheme, darkTheme } = require("./builtinThemes");
const { THEME_VAR_KEYS } = require(path.join(__dirname, "ui", "desktop-theme-keys"));

function sanitizeThemeVarValue(value) {
    if (typeof value !== "string") {
        return value == null ? "" : String(value);
    }
    return value.trim().replace(/;+\s*$/g, "");
}

function getBuiltinTheme(themeId) {
    return themeId === "dark" ? { ...darkTheme } : { ...blueTheme };
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
        name: typeof entry.name === "string" ? entry.name : "Custom theme",
        vars: completeThemeVars(entry.vars, fallbackThemeId),
        updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : Date.now(),
    };
}

function normalizeStore(raw, fallbackThemeId = "blue") {
    const store = {
        activeTheme: "blue",
        themes: [],
    };
    if (!raw || typeof raw !== "object") {
        return store;
    }
    const active = raw.activeTheme;
    if (active === "blue" || active === "dark" || (typeof active === "string" && active.indexOf("custom:") === 0)) {
        store.activeTheme = active;
    }
    if (Array.isArray(raw.themes)) {
        store.themes = raw.themes
            .map((t) => normalizeThemeEntry(t, fallbackThemeId))
            .filter(Boolean);
    }
    return store;
}

module.exports = {
    THEME_VAR_KEYS,
    sanitizeThemeVarValue,
    getBuiltinTheme,
    completeThemeVars,
    normalizeThemeEntry,
    normalizeStore,
};
