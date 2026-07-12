/**
 * Zip desktop/dist/win-unpacked for transfer to Windows.
 * Output: desktop/dist/Shmerling-Chess-<version>-win-x64.zip
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DESKTOP = path.join(__dirname, "..", "desktop");
const DIST = path.join(DESKTOP, "dist");
const UNPACKED = path.join(DIST, "win-unpacked");
const VERSION = require(path.join(DESKTOP, "package.json")).version;
const FOLDER_NAME = "Shmerling Chess";
const ZIP_NAME = `Shmerling-Chess-${VERSION}-win-x64.zip`;
const ZIP_PATH = path.join(DIST, ZIP_NAME);
const STAGING = path.join(DIST, FOLDER_NAME);

function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function main() {
    if (!fs.existsSync(UNPACKED)) {
        console.error("[zip-win-unpacked] Missing dist/win-unpacked. Run: npm run dist:win:dir");
        process.exit(1);
    }

    console.log("[zip-win-unpacked] Packaging", UNPACKED);

    if (fs.existsSync(ZIP_PATH)) {
        fs.rmSync(ZIP_PATH);
    }
    removeDir(STAGING);
    fs.cpSync(UNPACKED, STAGING, { recursive: true });

    try {
        if (process.platform === "win32") {
            execSync(
                `powershell -NoProfile -Command "Compress-Archive -Path '${STAGING}' -DestinationPath '${ZIP_PATH}' -Force"`,
                { stdio: "inherit" },
            );
        } else {
            execSync(`zip -r -q "${ZIP_NAME}" "${FOLDER_NAME}"`, {
                cwd: DIST,
                stdio: "inherit",
            });
        }
    } finally {
        removeDir(STAGING);
    }

    const sizeMb = (fs.statSync(ZIP_PATH).size / (1024 * 1024)).toFixed(1);
    console.log(`[zip-win-unpacked] Created ${ZIP_PATH} (${sizeMb} MB)`);
    console.log("[zip-win-unpacked] On Windows: unzip, open the folder, run Shmerling Chess.exe");
}

main();
