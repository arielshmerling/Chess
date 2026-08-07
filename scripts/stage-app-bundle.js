/**
 * Stage a slim desktop server bundle into desktop/app-bundle/ for electron-builder.
 * After staging, runs scripts/verify-desktop-bundle.js (real require() smoke test).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DESKTOP = path.join(ROOT, "desktop");
const BUNDLE = path.join(DESKTOP, "app-bundle");

/** Files copied from src/ to app-bundle/src/ (flat root of src). */
const DESKTOP_ROOT_FILES = [
    "app-desktop.js",
    "clientStatic.js",
    "ChessGame.js",
    "brain41.js",
    "brain42.js",
    "brain43.js",
    "brain43RootPool.js",
    "brain43RootEvalWorker.js",
    "brainSearchTime.js",
    "brainSearchProgress.js",
    "mateScore.js",
    "openingBookLines.js",
    "brainOpeningBook.js",
    "gameStateCompact.js",
    "themes.js",
    "pieceSets.js",
    "utils.js",
    "favicon.ico",
];

/** Nested files under src/ required at runtime by the desktop Express/IPC stack. */
const DESKTOP_SRC_FILES = [
    "modules/game/brainConfigService.js",
    "modules/user/userTypes.js",
    "modules/user/roles.js",
    "play/bookmarkShape.js",
    "play/brainApi.js",
    "play/brainGuards.js",
    "play/servePlayHtml.js",
    "desktop/playEnginesApi.js",
    "security/helmetOptions.js",
    "security/rateLimit.js",
    "security/concurrencyGate.js",
    "utils/catchAsync.js",
    "utils/ExpressError.js",
];

const DESKTOP_BRAIN_CONFIGS = ["brain41.json", "brain42.json", "brain43.json"];

const DESKTOP_UI_EXCLUDE = new Set([]);

/** Desktop server modules that pull Mongo / full web game stack — keep out of the slim bundle. */
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
    "a11y.css",
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
    if (!fs.existsSync(from)) {
        throw new Error(`[stage-app-bundle] Source missing: ${from}`);
    }
    ensureDir(path.dirname(to));
    fs.copyFileSync(from, to);
}

function copyDirFiltered(srcDir, destDir, options = {}) {
    const { excludeNames = new Set(), excludeTest = true } = options;
    if (!fs.existsSync(srcDir)) {
        throw new Error(`[stage-app-bundle] Source dir missing: ${srcDir}`);
    }
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
    try {
        require("esbuild");
    } catch (err) {
        throw new Error(
            "[stage-app-bundle] Missing root dependency esbuild (needed to build Play shell bundles). "
                + "From the repo root run: npm ci\n"
                + (err && err.message ? err.message : err),
        );
    }

    console.log("[stage-app-bundle] Building Play shell bundles…");
    execSync("node ./scripts/build-play-shell.js", {
        cwd: ROOT,
        stdio: "inherit",
    });

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

    copyDirFiltered(
        path.join(ROOT, "src", "validation"),
        path.join(BUNDLE, "src", "validation"),
    );
    copyDirFiltered(
        path.join(ROOT, "src", "strings"),
        path.join(BUNDLE, "src", "strings"),
    );
    copyDirFiltered(
        path.join(ROOT, "src", "play-ui"),
        path.join(BUNDLE, "src", "play-ui"),
    );
    copyDirFiltered(
        path.join(ROOT, "src", "session"),
        path.join(BUNDLE, "src", "session"),
    );
    copyDirFiltered(
        path.join(ROOT, "src", "engines"),
        path.join(BUNDLE, "src", "engines"),
    );
    copyDirFiltered(
        path.join(ROOT, "src", "adapters"),
        path.join(BUNDLE, "src", "adapters"),
    );
    copyDirFiltered(
        path.join(ROOT, "src", "a11y"),
        path.join(BUNDLE, "src", "a11y"),
    );

    // Optional static dir referenced by routes (404s are fine if empty).
    const mobileSrc = path.join(ROOT, "src", "mobile");
    if (fs.existsSync(mobileSrc)) {
        copyDirFiltered(mobileSrc, path.join(BUNDLE, "src", "mobile"));
    } else {
        ensureDir(path.join(BUNDLE, "src", "mobile"));
    }

    ensureDir(path.join(BUNDLE, "data"));
    for (const name of ["opening-book-lines.txt", "desktop-custom-themes.json", "play-engines.json"]) {
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

    console.log("[stage-app-bundle] Verifying staged bundle can load…");
    execSync("node ../scripts/verify-desktop-bundle.js", {
        cwd: DESKTOP,
        stdio: "inherit",
    });

    console.log("[stage-app-bundle] Done:", BUNDLE);
}

main();
