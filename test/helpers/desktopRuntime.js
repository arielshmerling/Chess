/**
 * Isolated desktop runtime for unit tests (temp userData directory).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const RUNTIME_PATH = path.resolve(__dirname, "../../src/desktop/runtime");
const BOOKMARK_STORE_PATH = path.resolve(__dirname, "../../src/desktop/bookmarkStore");
const GAME_HISTORY_STORE_PATH = path.resolve(__dirname, "../../src/desktop/gameHistoryStore");

function clearDesktopModuleCache() {
    delete require.cache[RUNTIME_PATH];
    delete require.cache[BOOKMARK_STORE_PATH];
    delete require.cache[GAME_HISTORY_STORE_PATH];
}

/**
 * @returns {{ tempDir: string, runtime: object }}
 */
function createDesktopTestRuntime() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shmerling-test-"));
    process.env.SHMERLING_MODE = "desktop";
    process.env.SHMERLING_USER_DATA = tempDir;
    clearDesktopModuleCache();
    const runtime = require("../../src/desktop/runtime");
    runtime.init({ userDataPath: tempDir });
    return { tempDir, runtime };
}

function destroyDesktopTestRuntime(tempDir) {
    clearDesktopModuleCache();
    if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    delete process.env.SHMERLING_MODE;
    delete process.env.SHMERLING_USER_DATA;
}

module.exports = {
    createDesktopTestRuntime,
    destroyDesktopTestRuntime,
    clearDesktopModuleCache,
};
