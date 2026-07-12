/**
 * Build the Windows NSIS installer. On Apple Silicon Macs, NSIS requires Rosetta
 * (electron-builder ships an x86_64 makensis binary).
 */
const { execSync, spawnSync } = require("child_process");
const path = require("path");

const DESKTOP = path.join(__dirname, "..", "desktop");

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

Prefer releasing via GitHub Actions instead of building locally:
  npm run desktop:git:release

Or install Rosetta and retry:
  softwareupdate --install-rosetta --agree-to-license
`);
}

function main() {
    if (isAppleSiliconMac() && !rosettaAvailable()) {
        printAppleSiliconHelp();
        process.exit(1);
    }

    // Publish is handled by softprops/action-gh-release in CI, not electron-builder.
    execSync("electron-builder --win --x64 --publish never", {
        cwd: DESKTOP,
        stdio: "inherit",
    });
}

main();
