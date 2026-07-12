/**
 * Dev launch: install desktop deps only when Electron is missing, then start.
 * Branding (icons / macOS Dock name) is not run here — use `npm run desktop:setup`.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync, spawn } = require("child_process");

const DESKTOP = path.join(__dirname, "..", "desktop");
const ELECTRON_PKG = path.join(DESKTOP, "node_modules", "electron", "package.json");

function runNpm(args) {
    const result = spawnSync("npm", args, {
        cwd: DESKTOP,
        stdio: "inherit",
        env: process.env,
        shell: process.platform === "win32",
    });
    if (result.status !== 0) {
        process.exit(result.status == null ? 1 : result.status);
    }
}

if (!fs.existsSync(ELECTRON_PKG)) {
    console.log("[desktop] Electron not installed — running npm install + setup once…");
    runNpm(["install"]);
    runNpm(["run", "setup"]);
}

const child = spawn("npm", ["start"], {
    cwd: DESKTOP,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.exit(1);
    }
    process.exit(code == null ? 1 : code);
});
