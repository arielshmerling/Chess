/**
 * Desktop custom themes: bundled JSON (shipped with app) + user overrides (userData).
 */

const fs = require("fs").promises;
const runtime = require("./runtime");
const {
    normalizeStore,
    normalizeThemeEntry,
    completeThemeVars,
} = require("./themeSchema");

const DEFAULT_STORE = {
    activeTheme: "blue",
    themes: [],
};

async function readJsonFile(filePath) {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
}

async function readBundledStore() {
    const filePath = runtime.getBundledCustomThemesPath();
    try {
        return normalizeStore(await readJsonFile(filePath));
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return { ...DEFAULT_STORE, themes: [] };
        }
        throw error;
    }
}

async function readUserStore() {
    const filePath = runtime.getCustomThemesFilePath();
    try {
        return normalizeStore(await readJsonFile(filePath));
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return { ...DEFAULT_STORE, themes: [] };
        }
        throw error;
    }
}

function mergeStores(bundled, user) {
    const byId = new Map();
    for (const theme of bundled.themes) {
        byId.set(theme.id, theme);
    }
    for (const theme of user.themes) {
        byId.set(theme.id, theme);
    }
    const activeTheme = user.activeTheme || bundled.activeTheme || "blue";
    return {
        activeTheme,
        themes: Array.from(byId.values()),
    };
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
    const userStore = {
        activeTheme:
            store && store.activeTheme ? store.activeTheme : DEFAULT_STORE.activeTheme,
        themes: [],
    };
    if (store && Array.isArray(store.themes)) {
        userStore.themes = store.themes
            .map((t) => normalizeThemeEntry(t, "blue"))
            .filter(Boolean);
    }
    await fs.writeFile(filePath, JSON.stringify(userStore, null, 2), "utf8");

    if (shouldSyncThemesToRepo()) {
        await writeBundledStore(userStore);
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
