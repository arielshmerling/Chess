/**
 * macOS dev: create Shmerling Chess.app from Electron.app and patch name/icon.
 * Dock hover text follows the .app bundle folder name, not CFBundleName alone.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const APP_NAME = "Shmerling Chess";
const DESKTOP = path.join(__dirname, "..", "desktop");
const ELECTRON_DIST = path.join(DESKTOP, "node_modules", "electron", "dist");
const ELECTRON_APP = path.join(ELECTRON_DIST, "Electron.app");
const BRANDED_APP = path.join(ELECTRON_DIST, `${APP_NAME}.app`);
const VERSION_STAMP = path.join(ELECTRON_DIST, ".shmerling-branded-app-version");
const BUNDLE_COPY_METHOD = "ditto-v1";
const OUR_ICNS = path.join(DESKTOP, "build", "icon.icns");

function electronVersion() {
    return require(path.join(DESKTOP, "node_modules", "electron", "package.json")).version;
}

function brandedAppSymlinksBroken() {
    const frameworkLink = path.join(
        BRANDED_APP,
        "Contents",
        "Frameworks",
        "Electron Framework.framework",
        "Electron Framework",
    );
    if (!fs.existsSync(frameworkLink)) {
        return true;
    }
    try {
        const target = fs.readlinkSync(frameworkLink);
        return path.isAbsolute(target);
    } catch {
        return true;
    }
}

function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function syncBrandedApp() {
    if (!fs.existsSync(ELECTRON_APP)) {
        console.warn("[patch-electron-app-name] Electron.app not found; skip");
        return false;
    }

    const version = electronVersion();
    const stampKey = `${version}:${BUNDLE_COPY_METHOD}`;
    const stamped = fs.existsSync(VERSION_STAMP)
        ? fs.readFileSync(VERSION_STAMP, "utf8").trim()
        : "";

    if (stamped === stampKey && fs.existsSync(BRANDED_APP) && !brandedAppSymlinksBroken()) {
        return true;
    }

    console.log(`[patch-electron-app-name] Creating ${APP_NAME}.app (electron ${version})…`);
    removeDir(BRANDED_APP);
    // ditto preserves macOS bundle symlinks; fs.cpSync breaks them and crashes Electron.
    execSync(`ditto "${ELECTRON_APP}" "${BRANDED_APP}"`, { stdio: "inherit" });
    fs.writeFileSync(VERSION_STAMP, `${stampKey}\n`, "utf8");
    return true;
}

function patchPlist() {
    const infoPlist = path.join(BRANDED_APP, "Contents", "Info.plist");
    if (!fs.existsSync(infoPlist)) {
        return;
    }
    const buddy = "/usr/libexec/PlistBuddy";
    const keys = ["CFBundleDisplayName", "CFBundleName"];
    for (const key of keys) {
        const cmd = `${buddy} -c 'Set :${key} "${APP_NAME}"' "${infoPlist}"`;
        try {
            execSync(cmd, { stdio: "pipe" });
        } catch {
            execSync(
                `${buddy} -c 'Add :${key} string "${APP_NAME}"' "${infoPlist}"`,
                { stdio: "pipe" },
            );
        }
    }
    console.log(`[patch-electron-app-name] Set "${APP_NAME}" on ${APP_NAME}.app Info.plist`);
}

function patchAboutIcon() {
    const electronIcns = path.join(BRANDED_APP, "Contents", "Resources", "electron.icns");
    if (!fs.existsSync(OUR_ICNS)) {
        console.warn("[patch-electron-app-name] build/icon.icns missing; run prepare:icons");
        return;
    }
    if (!fs.existsSync(path.dirname(electronIcns))) {
        return;
    }
    fs.copyFileSync(OUR_ICNS, electronIcns);
    console.log(`[patch-electron-app-name] Replaced icon in ${APP_NAME}.app`);
}

function main() {
    if (process.platform !== "darwin") {
        return;
    }
    if (!syncBrandedApp()) {
        return;
    }
    patchPlist();
    patchAboutIcon();
}

main();
