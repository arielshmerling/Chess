#!/usr/bin/env node
/**
 * On Render (or when INSTALL_STOCKFISH=1), ensure ./bin/stockfish exists.
 * Prefers a system/apt Stockfish (Aptfile) when available — much lighter on free tier.
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

if (process.platform !== "linux" && !force) {
    console.warn(
        "[maybe-install-stockfish] Skipping: not Linux (platform=" + process.platform + ")",
    );
    process.exit(0);
}

function uciOk(binPath) {
    const result = spawnSync(binPath, [], {
        input: "uci\nquit\n",
        encoding: "utf8",
        timeout: 45000,
        env: process.env,
    });
    const stdout = String(result.stdout || "");
    return stdout.split(/\r?\n/).includes("uciok");
}

function linkOrCopy(src) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    try {
        if (fs.existsSync(out)) {
            fs.unlinkSync(out);
        }
    } catch {
        /* ignore */
    }
    try {
        fs.symlinkSync(src, out);
    } catch {
        fs.copyFileSync(src, out);
        fs.chmodSync(out, 0o755);
    }
}

const systemCandidates = [
    process.env.STOCKFISH_SYSTEM_PATH,
    "/usr/games/stockfish",
    "/usr/bin/stockfish",
].filter(Boolean);

for (const candidate of systemCandidates) {
    if (fs.existsSync(candidate)) {
        console.log("[maybe-install-stockfish] Trying system binary:", candidate);
        if (uciOk(candidate)) {
            linkOrCopy(candidate);
            console.log("[maybe-install-stockfish] Using system Stockfish at", out, "->", candidate);
            process.exit(0);
        }
        console.warn("[maybe-install-stockfish] System binary failed UCI:", candidate);
    }
}

if (!force && fs.existsSync(out)) {
    try {
        fs.accessSync(out, fs.constants.X_OK);
        if (uciOk(out)) {
            console.log("[maybe-install-stockfish] Already present and UCI-ok:", out);
            process.exit(0);
        }
        console.warn("[maybe-install-stockfish] Existing binary failed UCI; reinstalling…");
    } catch {
        /* reinstall */
    }
}

if (!fs.existsSync(script)) {
    console.error("[maybe-install-stockfish] Missing script:", script);
    process.exit(1);
}

console.log("[maybe-install-stockfish] Installing official Linux binary…");
const result = spawnSync("bash", [script], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
});
process.exit(result.status == null ? 1 : result.status);
