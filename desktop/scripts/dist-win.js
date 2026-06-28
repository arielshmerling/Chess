/**
 * Build the Windows NSIS installer. On Apple Silicon Macs, NSIS requires Rosetta
 * (electron-builder ships an x86_64 makensis binary).
 */
const { execSync, spawnSync } = require("child_process");
const path = require("path");

const DESKTOP = path.join(__dirname, "..");

function isAppleSiliconMac() {
    return process.platform === "darwin" && process.arch === "arm64";
}

function rosettaAvailable() {
    return spawnSync("arch", ["-x86_64", "true"], { stdio: "ignore" }).status === 0;
}

function printAppleSiliconHelp() {
    console.error(`
[dist:win] Cannot build the NSIS installer on Apple Silicon without Rosetta.
electron-builder's makensis tool is Intel (x86_64) only.

Options:
  1. Portable zip (no installer, works on Apple Silicon):
     npm run dist:win:zip

  2. Install Rosetta, then retry:
     softwareupdate --install-rosetta --agree-to-license

  3. Release installers are built on GitHub Actions (windows-latest).
`);
}

function main() {
    if (isAppleSiliconMac() && !rosettaAvailable()) {
        printAppleSiliconHelp();
        process.exit(1);
    }

    execSync("electron-builder --win --x64", {
        cwd: DESKTOP,
        stdio: "inherit",
    });
}

main();
