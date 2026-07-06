/**
 * Builds desktop app icons from src/favicon.ico (macOS uses sips + iconutil).
 * Skips when outputs are newer than the favicon (postinstall / manual runs).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const FAVICON = path.join(ROOT, "src", "favicon.ico");
const BUILD = path.join(__dirname, "..", "build");

function run(cmd) {
    execSync(cmd, { stdio: "pipe" });
}

function requiredOutputs() {
    const outputs = [path.join(BUILD, "icon.ico")];
    if (process.platform === "darwin") {
        outputs.push(path.join(BUILD, "icon.png"), path.join(BUILD, "icon.icns"));
    } else if (process.platform === "win32") {
        outputs.push(path.join(BUILD, "icon.png"));
    }
    return outputs;
}

function iconsUpToDate() {
    let faviconMtime;
    try {
        faviconMtime = fs.statSync(FAVICON).mtimeMs;
    } catch {
        return false;
    }
    for (const filePath of requiredOutputs()) {
        if (!fs.existsSync(filePath)) {
            return false;
        }
        if (fs.statSync(filePath).mtimeMs < faviconMtime) {
            return false;
        }
    }
    return true;
}

function copyFaviconIco() {
    fs.copyFileSync(FAVICON, path.join(BUILD, "icon.ico"));
}

function writeWindowsIconPng(iconPng) {
    const favicon = FAVICON.replace(/'/g, "''");
    const out = iconPng.replace(/'/g, "''");
    const scriptPath = path.join(BUILD, "extract-icon.ps1");
    const script = [
        "Add-Type -AssemblyName System.Drawing",
        `$icon = New-Object System.Drawing.Icon('${favicon}')`,
        "$bmp = $icon.ToBitmap()",
        "$size = 512",
        "$scaled = New-Object System.Drawing.Bitmap($size, $size)",
        "$g = [System.Drawing.Graphics]::FromImage($scaled)",
        "$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic",
        "$g.DrawImage($bmp, 0, 0, $size, $size)",
        "$g.Dispose()",
        "$bmp.Dispose()",
        "$icon.Dispose()",
        `$scaled.Save('${out}', [System.Drawing.Imaging.ImageFormat]::Png)`,
        "$scaled.Dispose()",
    ].join("\n");
    fs.writeFileSync(scriptPath, script, "utf8");
    try {
        run(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`);
    } finally {
        fs.unlinkSync(scriptPath);
    }
}

function main() {
    if (!fs.existsSync(FAVICON)) {
        console.error("[prepare-icons] Missing", FAVICON);
        process.exit(1);
    }
    if (iconsUpToDate()) {
        console.log("[prepare-icons] Icons up to date (favicon unchanged)");
        return;
    }

    fs.mkdirSync(BUILD, { recursive: true });
    copyFaviconIco();

    if (process.platform !== "darwin") {
        if (process.platform === "win32") {
            writeWindowsIconPng(path.join(BUILD, "icon.png"));
            console.log("[prepare-icons] Wrote icon.ico and icon.png from favicon");
        } else {
            console.log("[prepare-icons] Copied icon.ico (run on macOS/Windows to also generate icon.png/icon.icns)");
        }
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

    let icnsOk = false;
    try {
        run(`iconutil -c icns "${iconset}" -o "${path.join(BUILD, "icon.icns")}"`);
        icnsOk = true;
    } catch (err) {
        console.warn("[prepare-icons] icon.icns generation failed:", err.message);
    }
    fs.rmSync(iconset, { recursive: true, force: true });
    if (fs.existsSync(srcPng)) {
        fs.unlinkSync(srcPng);
    }

    console.log(
        icnsOk
            ? "[prepare-icons] Wrote icon.ico, icon.png, icon.icns from favicon"
            : "[prepare-icons] Wrote icon.ico and icon.png from favicon",
    );
}

main();
