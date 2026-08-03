/**
 * Smoke-test the staged desktop/app-bundle by requiring the same modules
 * Electron main loads at startup. Fails CI if any relative require is missing.
 *
 * Usage (from repo root, after staging):
 *   node scripts/verify-desktop-bundle.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BUNDLE = path.join(ROOT, "desktop", "app-bundle");

const ENTRY_MODULES = [
    "src/app-desktop.js",
    "src/engines/engineService.js",
    "src/desktop/desktopBrainService.js",
    "src/desktop/runtime.js",
    "src/desktop/gameHistoryStore.js",
    "src/desktop/preloadOpeningBook.js",
    "src/desktop/configureApp.js",
    "src/desktop/routes.js",
    "src/utils.js",
    "src/modules/user/roles.js",
    "src/clientStatic.js",
    "src/security/helmetOptions.js",
    "src/play/bookmarkShape.js",
    "server-desktop.js",
];

const requireRe = /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

function resolveRelative(fromFile, spec) {
    let resolved = path.resolve(path.dirname(fromFile), spec);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        return resolved;
    }
    if (fs.existsSync(resolved + ".js")) {
        return resolved + ".js";
    }
    const indexJs = path.join(resolved, "index.js");
    if (fs.existsSync(indexJs)) {
        return indexJs;
    }
    return null;
}

function walkRelativeRequires(fileAbs, visited, missing) {
    if (visited.has(fileAbs)) {
        return;
    }
    visited.add(fileAbs);
    if (!fs.existsSync(fileAbs) || !fileAbs.endsWith(".js")) {
        missing.add(path.relative(BUNDLE, fileAbs));
        return;
    }
    const text = fs.readFileSync(fileAbs, "utf8");
    let match;
    requireRe.lastIndex = 0;
    while ((match = requireRe.exec(text))) {
        const spec = match[1];
        const resolved = resolveRelative(fileAbs, spec);
        if (!resolved) {
            missing.add(`${path.relative(BUNDLE, fileAbs)} → require("${spec}")`);
            continue;
        }
        if (!resolved.startsWith(BUNDLE + path.sep) && resolved !== BUNDLE) {
            continue;
        }
        // Skip node_modules inside bundle
        if (resolved.includes(`${path.sep}node_modules${path.sep}`)) {
            continue;
        }
        walkRelativeRequires(resolved, visited, missing);
    }
}

function assertFilesExist() {
    const missing = [];
    for (const rel of ENTRY_MODULES) {
        const full = path.join(BUNDLE, rel);
        if (!fs.existsSync(full)) {
            missing.push(rel);
        }
    }
    if (missing.length) {
        throw new Error(
            `[verify-desktop-bundle] Missing staged files:\n  - ${missing.join("\n  - ")}`,
        );
    }
}

function assertRelativeGraph() {
    const visited = new Set();
    const missing = new Set();
    for (const rel of ENTRY_MODULES) {
        walkRelativeRequires(path.join(BUNDLE, rel), visited, missing);
    }
    if (missing.size) {
        throw new Error(
            `[verify-desktop-bundle] Broken relative requires:\n  - ${[...missing].sort().join("\n  - ")}`,
        );
    }
    console.log(`[verify-desktop-bundle] Relative graph OK (${visited.size} files)`);
}

function assertRequireEntries() {
    process.env.SHMERLING_MODE = "desktop";
    process.env.SHMERLING_USER_DATA =
        process.env.SHMERLING_USER_DATA
        || path.join(ROOT, ".shmerling-desktop-dev");
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || "verify-desktop-bundle";

    const failures = [];
    for (const rel of [
        "src/utils.js",
        "src/modules/user/roles.js",
        "src/clientStatic.js",
        "src/security/helmetOptions.js",
        "src/play/bookmarkShape.js",
        "src/engines/engineService.js",
        "src/app-desktop.js",
        "src/desktop/configureApp.js",
        "src/desktop/routes.js",
    ]) {
        const abs = path.join(BUNDLE, rel);
        try {
            // Fresh load each time is unnecessary; cache is fine.
            require(abs);
            console.log(`[verify-desktop-bundle] require OK ${rel}`);
        } catch (err) {
            failures.push(`${rel}: ${err && err.message ? err.message : err}`);
        }
    }
    if (failures.length) {
        throw new Error(
            `[verify-desktop-bundle] require() failed:\n  - ${failures.join("\n  - ")}`,
        );
    }
}

function main() {
    if (!fs.existsSync(BUNDLE)) {
        throw new Error(
            `[verify-desktop-bundle] Bundle not found at ${BUNDLE}. Run stage-app-bundle.js first.`,
        );
    }
    assertFilesExist();
    assertRelativeGraph();
    assertRequireEntries();
    console.log("[verify-desktop-bundle] All checks passed.");
}

try {
    main();
} catch (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
}
