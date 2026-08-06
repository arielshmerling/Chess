#!/usr/bin/env node
/**
 * Run mocha with either the heavy suite list or the default glob (heavy files ignored).
 *
 * Usage:
 *   node scripts/run-mocha.js heavy
 *   node scripts/run-mocha.js default
 *   node scripts/run-mocha.js heavy --grep "placeholder"
 *   npm run test:heavy -- --grep "placeholder"
 */
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const heavyFiles = require("../test/heavy-files");
const mode = process.argv[2] || "default";
const extra = process.argv.slice(3).filter(function (arg) {
    return arg !== "--";
});

const mochaBin = path.join(root, "node_modules", "mocha", "bin", "mocha.js");
const args = ["--exit", "--require", "./test/_teardownWorkers.js"];

if (mode === "heavy") {
    args.push(...heavyFiles);
} else if (mode === "default") {
    args.push("./test/**/*.test.js");
    heavyFiles.forEach(function (file) {
        args.push("--ignore", file);
    });
} else {
    console.error("Usage: node scripts/run-mocha.js heavy|default [-- mocha-args...]");
    process.exit(2);
}

args.push(...extra);

const result = spawnSync(process.execPath, [mochaBin, ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
});

process.exit(result.status == null ? 1 : result.status);
