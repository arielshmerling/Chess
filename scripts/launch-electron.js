/**
 * Launch Electron. On macOS dev, use Shmerling Chess.app so Dock shows the right name.
 * Branding is ensured only when missing (after Electron upgrade / first setup).
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { ensureBrandedApp, APP_NAME } = require("./patch-electron-app-name");

const DESKTOP = path.join(__dirname, "..", "desktop");

function resolveElectronPath() {
    if (process.platform === "darwin") {
        ensureBrandedApp();
        const branded = path.join(
            DESKTOP,
            "node_modules",
            "electron",
            "dist",
            `${APP_NAME}.app`,
            "Contents",
            "MacOS",
            "Electron",
        );
        if (fs.existsSync(branded)) {
            return branded;
        }
    }
    return require("electron");
}

const electronPath = resolveElectronPath();
const args = process.argv.slice(2);
if (args.length === 0) {
    args.push(".");
}

const child = spawn(electronPath, args, {
    cwd: DESKTOP,
    stdio: "inherit",
    env: process.env,
});

let childClosed = false;
child.on("close", (code, signal) => {
    childClosed = true;
    if (code === null) {
        console.error(electronPath, "exited with signal", signal);
        process.exit(1);
    }
    process.exit(code);
});

child.on("error", (err) => {
    console.error("[launch-electron]", err.message);
    process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM", "SIGUSR2"]) {
    process.on(signal, () => {
        if (!childClosed) {
            child.kill(signal);
        }
    });
}
