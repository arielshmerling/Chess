/**
 * Keep data/desktop-custom-themes.json out of test side-effects.
 *
 * With SHMERLING_SYNC_CUSTOM_THEMES=1 (often set in .env for desktop/dev),
 * web theme API tests rewrite the bundled catalog from Mongo and leave the
 * working tree dirty. Tests must not sync to the repo, and must restore the
 * tracked file if anything still touched it.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const THEMES_REL = "data/desktop-custom-themes.json";
const THEMES_ABS = path.join(ROOT, THEMES_REL);

function disableRepoSync() {
    /* Use empty string (not delete): dotenv.config() would reload =1 from .env. */
    process.env.SHMERLING_SYNC_CUSTOM_THEMES = "";
}

function themesFileDirtyVsHead() {
    const result = spawnSync(
        "git",
        ["diff", "--quiet", "--", THEMES_REL],
        { cwd: ROOT, encoding: "utf8" },
    );
    if (result.status === 0) {
        return false;
    }
    if (result.status === 1) {
        return true;
    }
    return fs.existsSync(THEMES_ABS);
}

/**
 * Restore the bundled themes file to HEAD when tests left it dirty.
 * @returns {{ restored: boolean, reason: string }}
 */
function restoreBundledThemes() {
    if (!themesFileDirtyVsHead()) {
        return { restored: false, reason: "clean" };
    }
    const result = spawnSync(
        "git",
        ["checkout", "HEAD", "--", THEMES_REL],
        { cwd: ROOT, encoding: "utf8" },
    );
    if (result.status !== 0) {
        const detail = (result.stderr || result.stdout || "").trim();
        console.warn(
            "[bundledThemesGuard] Could not restore " + THEMES_REL +
                (detail ? ": " + detail : ""),
        );
        return { restored: false, reason: "git-failed" };
    }
    console.log("[bundledThemesGuard] Restored " + THEMES_REL + " from HEAD");
    return { restored: true, reason: "git" };
}

module.exports = {
    THEMES_REL,
    THEMES_ABS,
    disableRepoSync,
    restoreBundledThemes,
    themesFileDirtyVsHead,
};
