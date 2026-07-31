/**
 * Desktop custom themes: bundled JSON (shipped with app) + user overrides (userData).
 */

const fs = require("fs").promises;
const runtime = require("./runtime");
const {
    DEFAULT_ACTIVE_THEME,
    normalizeStore,
    completeThemeVars,
    normalizeHiddenThemeIds,
    pickUserThemes,
    pickHiddenThemeIds,
    resolveAvailableActiveTheme,
    mergeThemeStores,
    addSeedThemes,
} = require("./themeSchema");

const DEFAULT_STORE = {
    activeTheme: DEFAULT_ACTIVE_THEME,
    themes: [],
};

async function readJsonFile(filePath) {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
}

async function readBundledStore() {
    const filePath = runtime.getBundledCustomThemesPath();
    try {
        return addSeedThemes(await readJsonFile(filePath));
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return addSeedThemes({ ...DEFAULT_STORE, themes: [] });
        }
        throw error;
    }
}

async function readUserStore() {
    const filePath = runtime.getCustomThemesFilePath();
    try {
        const raw = await readJsonFile(filePath);
        return {
            ...normalizeStore(raw),
            hiddenThemeIds: normalizeHiddenThemeIds(raw.hiddenThemeIds),
        };
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return { ...DEFAULT_STORE, themes: [], hiddenThemeIds: [] };
        }
        throw error;
    }
}

function mergeStores(bundled, user) {
    return mergeThemeStores(bundled, user, user.hiddenThemeIds);
}

async function readAll() {
    const bundled = await readBundledStore();
    const user = await readUserStore();
    return normalizeStore(mergeStores(bundled, user));
}

function shouldSyncThemesToRepo() {
    return process.env.SHMERLING_SYNC_CUSTOM_THEMES === "1";
}

async function writeBundledStore(store) {
    const bundledPath = runtime.getBundledCustomThemesPath();
    const payload = {
        activeTheme: store.activeTheme || DEFAULT_STORE.activeTheme,
        themes: store.themes || [],
    };
    await fs.writeFile(bundledPath, JSON.stringify(payload, null, 2), "utf8");
}

async function writeAll(store) {
    const filePath = runtime.getCustomThemesFilePath();
    const bundled = await readBundledStore();
    const previousUser = await readUserStore();
    const normalized = resolveAvailableActiveTheme(store || DEFAULT_STORE);
    const userStore = {
        activeTheme: normalized.activeTheme,
        themes: pickUserThemes(bundled, normalized),
        hiddenThemeIds: pickHiddenThemeIds(
            bundled,
            normalized,
            previousUser.hiddenThemeIds,
        ),
    };
    await fs.writeFile(filePath, JSON.stringify(userStore, null, 2), "utf8");

    if (shouldSyncThemesToRepo()) {
        await writeBundledStore(normalized);
    }

    return mergeStores(await readBundledStore(), userStore);
}

module.exports = {
    readAll,
    writeAll,
    normalizeStore,
    completeThemeVars,
    readBundledStore,
    readUserStore,
};
