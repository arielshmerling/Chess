const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
    createDesktopTestRuntime,
    destroyDesktopTestRuntime,
} = require("./helpers/desktopRuntime");

describe("desktop runtime", function () {
    let tempDir;

    afterEach(function () {
        destroyDesktopTestRuntime(tempDir);
        tempDir = null;
    });

    it("initializes userData paths in desktop mode", function () {
        const ctx = createDesktopTestRuntime();
        tempDir = ctx.tempDir;
        const runtime = ctx.runtime;

        assert.strictEqual(runtime.isDesktopMode(), true);
        assert.strictEqual(runtime.getUserDataRoot(), tempDir);
        assert.strictEqual(runtime.getBookmarksFilePath(), path.join(tempDir, "bookmarks.json"));
        assert.strictEqual(runtime.getGamesDir(), path.join(tempDir, "games"));
        assert.ok(fs.existsSync(path.join(tempDir, "games")));
        assert.ok(fs.existsSync(path.join(tempDir, "brain-config")));
    });

    it("normalizes engine names to allowed desktop engines", function () {
        const ctx = createDesktopTestRuntime();
        tempDir = ctx.tempDir;
        const runtime = ctx.runtime;

        assert.strictEqual(runtime.normalizeEngine("brain42"), "brain42");
        assert.strictEqual(runtime.normalizeEngine("brain43"), "brain43");
        assert.strictEqual(runtime.normalizeEngine("brain41"), "brain41");
        assert.strictEqual(runtime.normalizeEngine("unknown"), "brain41");
    });

    it("uses desktop home path when in desktop mode", function () {
        const ctx = createDesktopTestRuntime();
        tempDir = ctx.tempDir;

        assert.strictEqual(ctx.runtime.getHomePath(), "/app/");
    });
});
