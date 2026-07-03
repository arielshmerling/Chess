/**
 * Stage a slim desktop server bundle into desktop/app-bundle/ for electron-builder.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DESKTOP = path.join(__dirname, "..");
const ROOT = path.join(DESKTOP, "..");
const BUNDLE = path.join(DESKTOP, "app-bundle");

const DESKTOP_ROOT_FILES = [
    "app-desktop.js",
    "ChessGame.js",
    "brain41.js",
    "brain42.js",
    "brain43.js",
    "brain43RootPool.js",
    "brain43RootEvalWorker.js",
    "brainSearchTime.js",
    "openingBookJson.js",
    "openingBookLoader.js",
    "gameStateCompact.js",
    "themes.js",
    "pieceSets.js",
    "favicon.ico",
];

const DESKTOP_SRC_FILES = [
    "modules/game/brainConfigService.js",
    "utils/catchAsync.js",
    "utils/ExpressError.js",
    "utils.js",
];

const DESKTOP_BRAIN_CONFIGS = ["brain41.json", "brain42.json", "brain43.json"];

const DESKTOP_UI_PAGES = ["play.html", "error.html"];

const DESKTOP_UI_EXCLUDE = new Set([]);

const DESKTOP_SERVER_EXCLUDE = new Set([
    "gameApi.js",
    "gameStore.js",
    "gameInfo.js",
    "registerGameEvents.js",
    "applyBookmark.js",
    "patchSinglePlayerBrain.js",
    "patchDesktopGameProtocol.js",
    "index.js",
]);

const DESKTOP_ASSETS = [
    "app.css",
    "images/logo.png",
    "images/shmerling.png",
];

const DESKTOP_PIECE_SETS = ["obsidian-court", "storm-ivory", "ember-regalia", "imperishable-army"];

const DESKTOP_NPM_DEPS = {
    express: "^4.21.0",
    "cookie-session": "^2.1.0",
    dotenv: "^16.4.7",
    helmet: "^8.0.0",
};

function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function copyFile(from, to) {
    ensureDir(path.dirname(to));
    fs.copyFileSync(from, to);
}

function copyDirFiltered(srcDir, destDir, options = {}) {
    const { excludeNames = new Set(), excludeTest = true } = options;
    ensureDir(destDir);
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        if (excludeNames.has(entry.name)) {
            continue;
        }
        if (excludeTest && entry.name.includes(".test.")) {
            continue;
        }
        const from = path.join(srcDir, entry.name);
        const to = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyDirFiltered(from, to, options);
        } else if (entry.isFile()) {
            copyFile(from, to);
        }
    }
}

function copyIntoBundle(relativePath) {
    const from = path.join(ROOT, "src", relativePath);
    const to = path.join(BUNDLE, "src", relativePath);
    copyFile(from, to);
}

function main() {
    console.log("[stage-app-bundle] Staging slim desktop bundle…");

    removeDir(BUNDLE);
    ensureDir(BUNDLE);

    copyFile(
        path.join(ROOT, "server-desktop.js"),
        path.join(BUNDLE, "server-desktop.js"),
    );

    for (const name of DESKTOP_ROOT_FILES) {
        copyFile(path.join(ROOT, "src", name), path.join(BUNDLE, "src", name));
    }

    for (const rel of DESKTOP_SRC_FILES) {
        copyIntoBundle(rel);
    }

    ensureDir(path.join(BUNDLE, "src", "config", "brains"));
    for (const name of DESKTOP_BRAIN_CONFIGS) {
        copyIntoBundle(path.join("config", "brains", name));
    }

    const desktopDir = path.join(ROOT, "src", "desktop");
    const desktopDest = path.join(BUNDLE, "src", "desktop");
    copyDirFiltered(desktopDir, desktopDest, { excludeNames: DESKTOP_SERVER_EXCLUDE });

    const uiDir = path.join(desktopDir, "ui");
    const uiDest = path.join(desktopDest, "ui");
    copyDirFiltered(uiDir, uiDest, { excludeNames: DESKTOP_UI_EXCLUDE });

    ensureDir(path.join(BUNDLE, "data"));
    for (const name of ["opening-book-states.json", "desktop-custom-themes.json"]) {
        const src = path.join(ROOT, "data", name);
        if (fs.existsSync(src)) {
            copyFile(src, path.join(BUNDLE, "data", name));
        }
    }

    ensureDir(path.join(BUNDLE, "src", "assets"));
    for (const rel of DESKTOP_ASSETS) {
        copyFile(
            path.join(ROOT, "src", "assets", rel),
            path.join(BUNDLE, "src", "assets", rel),
        );
    }
    for (const setId of DESKTOP_PIECE_SETS) {
        copyDirFiltered(
            path.join(ROOT, "src", "assets", "images", "pieces", setId),
            path.join(BUNDLE, "src", "assets", "images", "pieces", setId),
            { excludeTest: false },
        );
    }

    const bundlePkg = {
        name: "shmerling-desktop-server",
        private: true,
        version: "1.0.0",
        dependencies: DESKTOP_NPM_DEPS,
    };
    fs.writeFileSync(
        path.join(BUNDLE, "package.json"),
        JSON.stringify(bundlePkg, null, 2) + "\n",
        "utf8",
    );

    console.log("[stage-app-bundle] Installing desktop production dependencies…");
    execSync("npm install --omit=dev --no-audit --no-fund", {
        cwd: BUNDLE,
        stdio: "inherit",
    });

    console.log("[stage-app-bundle] Done:", BUNDLE);
}

main();
