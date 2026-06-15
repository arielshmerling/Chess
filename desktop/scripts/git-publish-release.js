#!/usr/bin/env node
/**
 * Bump desktop/package.json version, commit, tag, and push to trigger GitHub Release.
 *
 * Version format: M.DD.HH.MM (month.day.hour.minute), e.g. 6.14.18.58
 *
 * Usage (from repo root):
 *   npm run desktop:git:release
 *   npm run desktop:git:release -- --dry-run
 *   npm run desktop:git:release -- --force
 *   npm run desktop:git:release -- --version=6.14.18.58
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const DESKTOP_PKG = path.join(ROOT, "desktop", "package.json");
const DESKTOP_PKG_REL = "desktop/package.json";

function run(cmd) {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function runCapture(cmd) {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
}

function buildReleaseVersion(date = new Date()) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${month}.${day}.${hours}.${minutes}`;
}

function parseArgs(argv) {
    const versionArg = argv.find((arg) => arg.startsWith("--version="));
    return {
        dryRun: argv.includes("--dry-run"),
        force: argv.includes("--force"),
        version: versionArg ? versionArg.slice("--version=".length) : null,
    };
}

function assertMainBranch() {
    const branch = runCapture("git rev-parse --abbrev-ref HEAD");
    if (branch !== "main") {
        throw new Error(`desktop:git:release must run on main (current branch: ${branch})`);
    }
}

function assertCleanWorkingTree() {
    const status = runCapture("git status --porcelain");
    if (status) {
        throw new Error(
            "Working tree must be clean before publishing. Commit or stash your changes first.",
        );
    }
}

function tagExists(tag) {
    try {
        execSync(`git rev-parse refs/tags/${tag}`, {
            cwd: ROOT,
            stdio: ["ignore", "pipe", "ignore"],
        });
        return true;
    } catch {
        return false;
    }
}

function remoteTagExists(tag) {
    const out = runCapture(`git ls-remote --tags origin refs/tags/${tag}`);
    return out.length > 0;
}

function updateDesktopVersion(version) {
    const pkg = JSON.parse(fs.readFileSync(DESKTOP_PKG, "utf8"));
    const previous = pkg.version;
    pkg.version = version;
    fs.writeFileSync(DESKTOP_PKG, `${JSON.stringify(pkg, null, 2)}\n`);
    return previous;
}

function planStep(label) {
    console.log(`[git-publish-release] ${label}`);
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const version = options.version || buildReleaseVersion();
    const tag = `v${version}`;

    assertMainBranch();
    if (!options.dryRun) {
        assertCleanWorkingTree();
    }

    if (tagExists(tag) && !options.force) {
        throw new Error(
            `Tag ${tag} already exists locally. Use --force to replace it, or wait for a new version.`,
        );
    }

    if (remoteTagExists(tag) && !options.force) {
        throw new Error(
            `Tag ${tag} already exists on origin. Use --force to replace it, or wait for a new version.`,
        );
    }

    planStep(`Version: ${version}`);
    planStep(`Tag: ${tag}`);
    planStep(`Installer: Shmerling-Chess-${version}-win-setup.exe`);

    if (options.dryRun) {
        planStep("Dry run only. No files or git state were changed.");
        return;
    }

    const previousVersion = updateDesktopVersion(version);
    planStep(`Updated ${DESKTOP_PKG_REL} (${previousVersion} -> ${version})`);

    if (options.force) {
        if (tagExists(tag)) {
            run(`git tag -d ${tag}`);
        }
        if (remoteTagExists(tag)) {
            run(`git push origin :refs/tags/${tag}`);
        }
    }

    run(`git add ${DESKTOP_PKG_REL}`);
    run(`git commit -m "$(cat <<'EOF'
Release ${tag}

EOF
)"`);
    run(`git tag ${tag}`);
    run(`git push origin main`);
    run(`git push origin ${tag}`);

    planStep(`Published ${tag}. GitHub Actions will build Shmerling-Chess-${version}-win-setup.exe`);
    planStep("Release page: https://github.com/arielshmerling/chess/releases");
}

try {
    main();
} catch (error) {
    console.error(`[git-publish-release] ${error.message}`);
    process.exit(1);
}
