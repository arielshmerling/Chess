const assert = require("assert");
const {
    DEFAULT_ACTIVE_THEME,
    addSeedThemes,
    normalizeStore,
    pickHiddenThemeIds,
    mergeThemeStores,
    resolveAvailableActiveTheme,
} = require("../src/desktop/themeSchema");

describe("unified theme catalog", function () {
    it("represents Blue and Dark as ordinary catalog entries", function () {
        const store = addSeedThemes({ activeTheme: "dark", themes: [] });

        assert.strictEqual(store.activeTheme, "custom:dark");
        assert.deepStrictEqual(
            store.themes.slice(0, 2).map((theme) => theme.id),
            ["blue", "dark"],
        );
        assert.ok(store.themes[0].vars["--body-background"]);
        assert.ok(store.themes[1].vars["--body-background"]);
    });

    it("migrates legacy active theme identifiers", function () {
        assert.strictEqual(normalizeStore({ activeTheme: "blue" }).activeTheme, "custom:blue");
        assert.strictEqual(normalizeStore({ activeTheme: "dark" }).activeTheme, "custom:dark");
        assert.strictEqual(
            normalizeStore({ activeTheme: "custom:personal" }).activeTheme,
            "custom:personal",
        );
    });

    it("keeps deleted seed and bundled themes hidden", function () {
        const bundled = addSeedThemes({
            activeTheme: DEFAULT_ACTIVE_THEME,
            themes: [{ id: "extra", name: "Extra", vars: {}, updatedAt: 1 }],
        });
        const visible = normalizeStore({
            activeTheme: "custom:extra",
            themes: bundled.themes.filter((theme) => theme.id === "extra"),
        });
        const hidden = pickHiddenThemeIds(bundled, visible, []);
        const merged = mergeThemeStores(bundled, visible, hidden);

        assert.deepStrictEqual(hidden.sort(), ["blue", "dark"]);
        assert.deepStrictEqual(merged.themes.map((theme) => theme.id), ["extra"]);
    });

    it("allows deleting every catalog theme and retains an emergency active id", function () {
        const bundled = addSeedThemes({ themes: [] });
        const empty = normalizeStore({ activeTheme: "custom:blue", themes: [] });
        const hidden = pickHiddenThemeIds(bundled, empty, []);
        const merged = mergeThemeStores(bundled, empty, hidden);

        assert.deepStrictEqual(hidden.sort(), ["blue", "dark"]);
        assert.deepStrictEqual(merged.themes, []);
        assert.strictEqual(merged.activeTheme, DEFAULT_ACTIVE_THEME);
    });

    it("selects another catalog entry after deleting the active theme", function () {
        const resolved = resolveAvailableActiveTheme({
            activeTheme: "custom:deleted",
            themes: [{ id: "remaining", name: "Remaining", vars: {}, updatedAt: 1 }],
        });

        assert.strictEqual(resolved.activeTheme, "custom:remaining");
    });
});
