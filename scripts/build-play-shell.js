/**
 * Build minified Play shell bundles (concatenate IIFE sources in order via esbuild).
 *
 * Usage: node scripts/build-play-shell.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");
const { BUNDLE_GROUPS, ROOT } = require("./play-shell-manifest");

const OUT_DIR = path.join(ROOT, "src", "desktop", "ui", "bundles");

async function buildGroup(group) {
    for (const file of group.files) {
        if (!fs.existsSync(file)) {
            throw new Error("[build-play-shell] Missing source: " + file);
        }
    }
    const combined = group.files
        .map(function (file) {
            return fs.readFileSync(file, "utf8");
        })
        .join("\n;\n");

    /* No module format: keep top-level IIFE globals on window. */
    const minified = await esbuild.transform(combined, {
        minify: true,
        target: ["es2018"],
        legalComments: "none",
        loader: "js",
    });

    const outPath = path.join(OUT_DIR, group.name);
    fs.writeFileSync(outPath, minified.code, "utf8");
    const bytes = Buffer.byteLength(minified.code, "utf8");
    console.log(
        "[build-play-shell]",
        group.name,
        (bytes / 1024).toFixed(1) + " KiB",
        "(" + group.files.length + " files)",
    );
    return outPath;
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const group of BUNDLE_GROUPS) {
        await buildGroup(group);
    }
    console.log("[build-play-shell] Wrote bundles to", OUT_DIR);
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
