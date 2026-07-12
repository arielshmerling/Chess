const assert = require("assert");
const {
    createDesktopTestRuntime,
    destroyDesktopTestRuntime,
} = require("./helpers/desktopRuntime");

describe("syncDataPaths on web server", function () {
    let savedMode;

    beforeEach(function () {
        savedMode = process.env.SHMERLING_MODE;
        delete process.env.SHMERLING_MODE;
        delete require.cache[require.resolve("../src/desktop/runtime")];
        delete require.cache[require.resolve("../src/desktop/syncDataPaths")];
    });

    afterEach(function () {
        if (savedMode === undefined) {
            delete process.env.SHMERLING_MODE;
        } else {
            process.env.SHMERLING_MODE = savedMode;
        }
        delete require.cache[require.resolve("../src/desktop/runtime")];
        delete require.cache[require.resolve("../src/desktop/syncDataPaths")];
    });

    it("does not throw when syncing paths outside desktop mode", function () {
        const { syncDesktopPathsForSharedModules } = require("../src/desktop/syncDataPaths");
        assert.doesNotThrow(function () {
            syncDesktopPathsForSharedModules();
        });
    });
});

describe("syncDataPaths in desktop mode", function () {
    let tempDir;

    afterEach(function () {
        destroyDesktopTestRuntime(tempDir);
        tempDir = null;
        delete require.cache[require.resolve("../src/desktop/syncDataPaths")];
    });

    it("still syncs when desktop runtime is initialized", function () {
        const ctx = createDesktopTestRuntime();
        tempDir = ctx.tempDir;
        const { syncDesktopPathsForSharedModules } = require("../src/desktop/syncDataPaths");
        assert.doesNotThrow(function () {
            syncDesktopPathsForSharedModules();
        });
    });
});
