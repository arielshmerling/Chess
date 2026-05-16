/**
 * Syncs desktop userData opening book into repo data/ for shared brain42 loader.
 */

const fs = require("fs");
const path = require("path");
const runtime = require("./runtime");

const REPO_DATA_DIR = path.join(__dirname, "..", "..", "data");

function syncOpeningBookForSharedLoader() {
    const src = runtime.resolveOpeningBookPath();
    if (!fs.existsSync(src)) {
        return;
    }
    fs.mkdirSync(REPO_DATA_DIR, { recursive: true });
    const dest = path.join(REPO_DATA_DIR, "opening-book-states.bin");
    fs.copyFileSync(src, dest);
}

function syncBrainConfigsForSinglePlayerGame() {
    const srcDir = runtime.getBrainConfigDir();
    const destDir = path.join(__dirname, "..", "config", "brains");
    if (!fs.existsSync(srcDir)) {
        return;
    }
    fs.mkdirSync(destDir, { recursive: true });
    for (const engine of runtime.DESKTOP_ENGINES) {
        const src = path.join(srcDir, `${engine}.json`);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(destDir, `${engine}.json`));
        }
    }
}

function syncDesktopPathsForSharedModules() {
    syncOpeningBookForSharedLoader();
    syncBrainConfigsForSinglePlayerGame();
}

module.exports = { syncDesktopPathsForSharedModules };
