/**
 * macOS dev: patch Electron.app display name and About-window icon for `electron .`.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const APP_NAME = "Shmerling Chess";
const ELECTRON_APP = path.join(
    __dirname,
    "..",
    "node_modules",
    "electron",
    "dist",
    "Electron.app",
);
const INFO_PLIST = path.join(ELECTRON_APP, "Contents", "Info.plist");
const ELECTRON_ICNS = path.join(ELECTRON_APP, "Contents", "Resources", "electron.icns");
const OUR_ICNS = path.join(__dirname, "..", "build", "icon.icns");

function patchPlist() {
    if (process.platform !== "darwin") {
        return;
    }
    if (!fs.existsSync(INFO_PLIST)) {
        console.warn("[patch-electron-app-name] Electron.app not found; skip");
        return;
    }
    const buddy = "/usr/libexec/PlistBuddy";
    const keys = ["CFBundleDisplayName", "CFBundleName"];
    for (const key of keys) {
        const cmd = `${buddy} -c 'Set :${key} "${APP_NAME}"' "${INFO_PLIST}"`;
        try {
            execSync(cmd, { stdio: "pipe" });
        } catch {
            execSync(
                `${buddy} -c 'Add :${key} string "${APP_NAME}"' "${INFO_PLIST}"`,
                { stdio: "pipe" },
            );
        }
    }
    console.log(`[patch-electron-app-name] Set "${APP_NAME}" on Electron.app Info.plist`);
}

function patchAboutIcon() {
    if (process.platform !== "darwin") {
        return;
    }
    if (!fs.existsSync(OUR_ICNS)) {
        console.warn("[patch-electron-app-name] build/icon.icns missing; run prepare:icons");
        return;
    }
    if (!fs.existsSync(path.dirname(ELECTRON_ICNS))) {
        return;
    }
    fs.copyFileSync(OUR_ICNS, ELECTRON_ICNS);
    console.log("[patch-electron-app-name] Replaced electron.icns with app icon");
}

patchPlist();
patchAboutIcon();
