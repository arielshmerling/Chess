/**
 * Keeps repo `data/` and desktop userData opening books in sync (newer file wins).
 * Previously userData always overwrote repo on every start, clobbering dev edits in `data/`.
 */

const fs = require("fs");
const path = require("path");
const runtime = require("./runtime");

const REPO_DATA_DIR = path.join(__dirname, "..", "..", "data");
const OPENING_BOOK_BASENAME = "opening-book-states.json";
const OPENING_BOOK_2_BASENAME = "opening-book-2-states.json";
const OPENING_BOOK_LINES_BASENAME = "opening-book-lines.txt";

function getRepoOpeningBookPath() {
    return path.join(REPO_DATA_DIR, OPENING_BOOK_BASENAME);
}

function getRepoOpeningBook2Path() {
    return path.join(REPO_DATA_DIR, OPENING_BOOK_2_BASENAME);
}

function getRepoOpeningBookLinesPath() {
    return path.join(REPO_DATA_DIR, OPENING_BOOK_LINES_BASENAME);
}

function getUserOpeningBookPathSafe(basename) {
    if (runtime.getUserDataRoot()) {
        return path.join(runtime.getUserDataRoot(), basename);
    }
    if (process.env.SHMERLING_USER_DATA) {
        return path.join(process.env.SHMERLING_USER_DATA, basename);
    }
    return null;
}

function syncOpeningBookPair(repoPath, userPath) {
    const repoExists = fs.existsSync(repoPath);
    const userExists = userPath && fs.existsSync(userPath);

    if (!repoExists && !userExists) {
        return;
    }

    if (repoExists && !userExists) {
        if (userPath) {
            fs.mkdirSync(path.dirname(userPath), { recursive: true });
            fs.copyFileSync(repoPath, userPath);
        }
        return;
    }

    if (userExists && !repoExists) {
        fs.mkdirSync(REPO_DATA_DIR, { recursive: true });
        fs.copyFileSync(userPath, repoPath);
        return;
    }

    const repoMtime = fs.statSync(repoPath).mtimeMs;
    const userMtime = fs.statSync(userPath).mtimeMs;
    if (repoMtime >= userMtime) {
        fs.copyFileSync(repoPath, userPath);
    } else {
        fs.copyFileSync(userPath, repoPath);
    }
}

function syncOpeningBookForSharedLoader() {
    syncOpeningBookPair(
        getRepoOpeningBookPath(),
        getUserOpeningBookPathSafe(OPENING_BOOK_BASENAME),
    );
    syncOpeningBookPair(
        getRepoOpeningBook2Path(),
        getUserOpeningBookPathSafe(OPENING_BOOK_2_BASENAME),
    );
    syncOpeningBookPair(
        getRepoOpeningBookLinesPath(),
        getUserOpeningBookPathSafe(OPENING_BOOK_LINES_BASENAME),
    );
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
