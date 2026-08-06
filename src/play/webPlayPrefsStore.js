/**
 * Web Play UI preferences stored on the User document (Mongo).
 * Theme *catalog* (definitions) is site-wide; each user only stores activeTheme.
 */

const path = require("path");
const fs = require("fs").promises;
const { User } = require("../modules/user/model");
const { ThemeCatalog, SITE_CATALOG_ID } = require("./themeCatalogModel");
const {
    DEFAULT_ACTIVE_THEME,
    normalizeStore,
    normalizeActiveThemeId,
    normalizeHiddenThemeIds,
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

function shouldSyncThemesToRepo() {
    return process.env.SHMERLING_SYNC_CUSTOM_THEMES === "1";
}

async function writeBundledThemesFile(store) {
    const payload = {
        activeTheme: store.activeTheme || DEFAULT_ACTIVE_THEME,
        themes: store.themes || [],
    };
    await fs.writeFile(BUNDLED_THEMES_PATH, JSON.stringify(payload, null, 2), "utf8");
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

/**
 * Per-user preference: which theme is selected (not catalog definitions).
 */
async function readUserThemePreference(userId) {
    const user = await User.findById(userId).select("playCustomThemes").lean();
    const raw = (user && user.playCustomThemes) || {};
    return {
        activeTheme: normalizeActiveThemeId(raw.activeTheme),
    };
}

async function writeUserActiveTheme(userId, activeTheme) {
    const nextActive = normalizeActiveThemeId(activeTheme);
    await User.findByIdAndUpdate(userId, {
        playCustomThemes: {
            activeTheme: nextActive,
            themes: [],
            hiddenThemeIds: [],
        },
    });
    return nextActive;
}

/**
 * Site-wide catalog from Mongo, or null if never published by an Admin.
 */
async function readSharedCatalogDoc() {
    const doc = await ThemeCatalog.findById(SITE_CATALOG_ID).lean();
    if (!doc) {
        return null;
    }
    return {
        themes: Array.isArray(doc.themes) ? doc.themes : [],
        hiddenThemeIds: normalizeHiddenThemeIds(doc.hiddenThemeIds),
        updatedAt: doc.updatedAt || null,
    };
}

/**
 * Effective catalog for everyone: bundled seeds + site-wide Admin overrides.
 */
async function readSiteThemeCatalog() {
    const bundled = await readBundledThemesStore();
    const shared = await readSharedCatalogDoc();
    if (!shared) {
        return {
            bundled,
            store: normalizeStore({
                activeTheme: bundled.activeTheme,
                themes: bundled.themes,
            }),
            hiddenThemeIds: [],
            fromShared: false,
        };
    }
    const overlay = normalizeStore({
        activeTheme: bundled.activeTheme,
        themes: shared.themes,
    });
    const merged = mergeThemeStores(bundled, overlay, shared.hiddenThemeIds);
    return {
        bundled,
        store: merged,
        hiddenThemeIds: shared.hiddenThemeIds,
        fromShared: true,
    };
}

async function writeSiteThemeCatalog(store, options = {}) {
    const bundled = await readBundledThemesStore();
    const previous = await readSharedCatalogDoc();
    const normalized = resolveAvailableActiveTheme(store || DEFAULT_THEMES);
    const hiddenThemeIds = pickHiddenThemeIds(
        bundled,
        normalized,
        previous ? previous.hiddenThemeIds : [],
    );
    const catalogThemes = normalized.themes || [];

    await ThemeCatalog.findByIdAndUpdate(
        SITE_CATALOG_ID,
        {
            _id: SITE_CATALOG_ID,
            themes: catalogThemes,
            hiddenThemeIds,
            updatedAt: new Date(),
            updatedByUserId: options.userId != null ? options.userId : null,
        },
        { upsert: true, setDefaultsOnInsert: true },
    );

    const merged = mergeThemeStores(
        bundled,
        normalizeStore({ activeTheme: normalized.activeTheme, themes: catalogThemes }),
        hiddenThemeIds,
    );

    if (shouldSyncThemesToRepo()) {
        await writeBundledThemesFile(merged);
    }

    return {
        store: merged,
        hiddenThemeIds,
    };
}

async function readCustomThemes(userId) {
    const site = await readSiteThemeCatalog();
    const pref = await readUserThemePreference(userId);
    return resolveAvailableActiveTheme({
        activeTheme: pref.activeTheme,
        themes: site.store.themes,
    });
}

/**
 * Admin: publish the full catalog site-wide; also save this admin's activeTheme.
 */
async function writeCustomThemes(userId, store) {
    const normalized = resolveAvailableActiveTheme(store || DEFAULT_THEMES);
    const published = await writeSiteThemeCatalog(normalized, { userId });
    await writeUserActiveTheme(userId, normalized.activeTheme);
    return resolveAvailableActiveTheme({
        activeTheme: normalized.activeTheme,
        themes: published.store.themes,
    });
}

/**
 * Non-admins may change which theme is active, but not the catalog.
 */
async function writeActiveThemeOnly(userId, activeTheme) {
    const site = await readSiteThemeCatalog();
    const requested = normalizeActiveThemeId(activeTheme);
    const requestedId = requested.slice(7);
    const nextActive = site.store.themes.some((theme) => theme.id === requestedId)
        ? requested
        : site.store.activeTheme || DEFAULT_ACTIVE_THEME;
    await writeUserActiveTheme(userId, nextActive);
    return resolveAvailableActiveTheme({
        activeTheme: nextActive,
        themes: site.store.themes,
    });
}

module.exports = {
    readUiSettings,
    writeUiSettings,
    readCustomThemes,
    writeCustomThemes,
    writeActiveThemeOnly,
};
