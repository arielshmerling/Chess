/**
 * Desktop installer manifest for the welcome page (/downloads/*).
 */
const fs = require("fs");
const path = require("path");

const MANIFEST_PATH = path.join(__dirname, "..", "assets", "downloads", "manifest.json");

function loadDesktopDownloadsManifest() {
    try {
        const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
        const data = JSON.parse(raw);
        const downloads = Array.isArray(data.downloads) ? data.downloads : [];
        return {
            version: data.version || "",
            updatedAt: data.updatedAt || "",
            downloads: downloads.filter(function (d) {
                return d && d.url && d.label && d.platform;
            }),
        };
    } catch {
        return { version: "", updatedAt: "", downloads: [] };
    }
}

module.exports = { loadDesktopDownloadsManifest, MANIFEST_PATH };
