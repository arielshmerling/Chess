const assert = require("assert");
const fs = require("fs").promises;
const os = require("os");
const path = require("path");
const runtime = require("../src/desktop/runtime");
const customThemeStore = require("../src/desktop/customThemeStore");

describe("desktop custom theme store", function () {
    let tempDir;
    let bundledPath;
    let userPath;
    let originalBundledPath;
    let originalUserPath;
    let originalSync;

    beforeEach(async function () {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "shmerling-themes-"));
        bundledPath = path.join(tempDir, "bundled.json");
        userPath = path.join(tempDir, "user.json");
        await fs.writeFile(
            bundledPath,
            JSON.stringify({
                activeTheme: "custom:extra",
                themes: [{ id: "extra", name: "Extra", vars: {}, updatedAt: 1 }],
            }),
            "utf8",
        );
        originalBundledPath = runtime.getBundledCustomThemesPath;
        originalUserPath = runtime.getCustomThemesFilePath;
        originalSync = process.env.SHMERLING_SYNC_CUSTOM_THEMES;
        runtime.getBundledCustomThemesPath = function () {
            return bundledPath;
        };
        runtime.getCustomThemesFilePath = function () {
            return userPath;
        };
        delete process.env.SHMERLING_SYNC_CUSTOM_THEMES;
    });

    afterEach(async function () {
        runtime.getBundledCustomThemesPath = originalBundledPath;
        runtime.getCustomThemesFilePath = originalUserPath;
        if (originalSync === undefined) {
            delete process.env.SHMERLING_SYNC_CUSTOM_THEMES;
        } else {
            process.env.SHMERLING_SYNC_CUSTOM_THEMES = originalSync;
        }
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("keeps a deleted seeded theme deleted after reloading", async function () {
        const before = await customThemeStore.readAll();
        assert.ok(before.themes.some((theme) => theme.id === "blue"));

        await customThemeStore.writeAll({
            activeTheme: "custom:extra",
            themes: before.themes.filter((theme) => theme.id !== "blue"),
        });

        const after = await customThemeStore.readAll();
        assert.ok(!after.themes.some((theme) => theme.id === "blue"));
        assert.ok(after.themes.some((theme) => theme.id === "dark"));
        assert.ok(after.themes.some((theme) => theme.id === "extra"));
    });
});
