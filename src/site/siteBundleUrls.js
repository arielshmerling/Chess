/**
 * Versioned URLs for site shell bundles (cache-bust by file mtime).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const BUNDLES_DIR = path.join(__dirname, "../assets/bundles");

function fileMtimeVersion(filePath) {
    try {
        return String(Math.floor(fs.statSync(filePath).mtimeMs));
    } catch {
        return "0";
    }
}

function bundleUrl(name) {
    const v = fileMtimeVersion(path.join(BUNDLES_DIR, name));
    return "/bundles/" + name + "?v=" + v;
}

function getSiteBundleUrls() {
    return {
        shell: bundleUrl("site-shell.js"),
        chrome: bundleUrl("site-chrome.js"),
        social: bundleUrl("site-social.js"),
    };
}

module.exports = {
    getSiteBundleUrls,
    bundleUrl,
};
