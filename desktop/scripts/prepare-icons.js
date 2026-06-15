/**
 * Builds desktop app icons from src/favicon.ico (macOS uses sips + iconutil).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const FAVICON = path.join(ROOT, "src", "favicon.ico");
const BUILD = path.join(__dirname, "..", "build");

function run(cmd) {
    execSync(cmd, { stdio: "inherit" });
}

function main() {
    if (!fs.existsSync(FAVICON)) {
        console.error("[prepare-icons] Missing", FAVICON);
        process.exit(1);
    }
    fs.mkdirSync(BUILD, { recursive: true });

    if (process.platform !== "darwin") {
        fs.copyFileSync(FAVICON, path.join(BUILD, "icon.ico"));
        console.log("[prepare-icons] Copied icon.ico (run on macOS to regenerate PNG/ICNS)");
        return;
    }

    const srcPng = path.join(BUILD, "icon-src.png");
    const iconPng = path.join(BUILD, "icon.png");
    const iconset = path.join(BUILD, "icon.iconset");

    run(`sips -s format png "${FAVICON}" --out "${srcPng}"`);
    run(`sips -z 512 512 "${srcPng}" --out "${iconPng}"`);

    if (fs.existsSync(iconset)) {
        fs.rmSync(iconset, { recursive: true });
    }
    fs.mkdirSync(iconset);

    const sizes = [
        ["icon_16x16.png", 16],
        ["icon_16x16@2x.png", 32],
        ["icon_32x32.png", 32],
        ["icon_32x32@2x.png", 64],
        ["icon_128x128.png", 128],
        ["icon_128x128@2x.png", 256],
        ["icon_256x256.png", 256],
        ["icon_256x256@2x.png", 512],
        ["icon_512x512.png", 512],
        ["icon_512x512@2x.png", 1024],
    ];
    for (const [name, size] of sizes) {
        run(`sips -z ${size} ${size} "${iconPng}" --out "${path.join(iconset, name)}"`);
    }

    run(`iconutil -c icns "${iconset}" -o "${path.join(BUILD, "icon.icns")}"`);
    fs.rmSync(iconset, { recursive: true });
    if (fs.existsSync(srcPng)) {
        fs.unlinkSync(srcPng);
    }

    console.log("[prepare-icons] Wrote icon.png, icon.icns");
}

main();
