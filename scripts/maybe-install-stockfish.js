#!/usr/bin/env node
/**
 * On Render (or when INSTALL_STOCKFISH=1), ensure ./bin/stockfish exists.
 * Skips local macOS/Windows so Homebrew STOCKFISH_PATH keeps working.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const out = path.join(root, "bin", "stockfish");
const script = path.join(root, "scripts", "install-stockfish-linux.sh");

const force = process.env.INSTALL_STOCKFISH === "1";
const onRender = process.env.RENDER === "true";

if (!force && !onRender) {
    process.exit(0);
}

if (!force && fs.existsSync(out)) {
    try {
        fs.accessSync(out, fs.constants.X_OK);
        console.log("[maybe-install-stockfish] Already present:", out);
        process.exit(0);
    } catch {
        /* reinstall */
    }
}

if (process.platform !== "linux" && !force) {
    console.warn(
        "[maybe-install-stockfish] Skipping: not Linux (platform=" + process.platform + ")",
    );
    process.exit(0);
}

if (!fs.existsSync(script)) {
    console.error("[maybe-install-stockfish] Missing script:", script);
    process.exit(1);
}

console.log("[maybe-install-stockfish] Installing Stockfish for Render/Linux…");
const result = spawnSync("bash", [script], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
});
process.exit(result.status == null ? 1 : result.status);
