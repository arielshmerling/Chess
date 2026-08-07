#!/usr/bin/env node
/**
 * Mocha launcher for categorized suites (see test/suite-manifest.js).
 *
 * Usage:
 *   node scripts/run-mocha.js default|all|heavy|light|pgn|brain|brain-all [-- mocha-args...]
 *   npm run test:heavy -- --grep "placeholder"
 */
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const manifest = require("../test/suite-manifest");
const mode = process.argv[2] || "default";
const extra = process.argv.slice(3).filter(function (arg) {
    return arg !== "--";
});

const mochaBin = path.join(root, "node_modules", "mocha", "bin", "mocha.js");
const args = ["--exit", "--require", "./test/_teardownWorkers.js"];

function pushIgnore(files) {
    files.forEach(function (file) {
        args.push("--ignore", file);
    });
}

function pushFiles(files) {
    args.push(...files);
}

switch (mode) {
    case "default":
        /* All mocha tests except PGN + heavy (used by npm run test). */
        args.push("./test/**/*.test.js");
        pushIgnore(manifest.ignoreDefault);
        break;
    case "all":
        /* All mocha tests except PGN (includes heavy). npm run test:all then adds test:web. */
        args.push("./test/**/*.test.js");
        pushIgnore(manifest.ignoreAll);
        break;
    case "heavy":
        pushFiles(manifest.heavy);
        break;
    case "light":
        pushFiles(manifest.light);
        break;
    case "pgn":
        pushFiles(manifest.pgn);
        break;
    case "brain":
        pushFiles(manifest.brainFast);
        break;
    case "brain-all":
        pushFiles(manifest.brainAll);
        break;
    default:
        console.error(
            "Usage: node scripts/run-mocha.js default|all|heavy|light|pgn|brain|brain-all [-- mocha-args...]",
        );
        process.exit(2);
}

args.push(...extra);

const result = spawnSync(process.execPath, [mochaBin, ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
});

process.exit(result.status == null ? 1 : result.status);
