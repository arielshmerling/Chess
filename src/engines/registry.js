/**
 * Play engine catalog (brains + UCI).
 * Availability for UCI engines is probed at runtime (external process).
 */

"use strict";

const fs = require("fs");
const path = require("path");

const BRAIN_IDS = Object.freeze(["brain43", "brain42", "brain41"]);

/** @typedef {"brain"|"uci"} EngineBackend */

/**
 * @typedef {object} EngineDefinition
 * @property {string} id
 * @property {string} labelKey - i18n key under play.newGameDialog.*
 * @property {string} fallbackLabel
 * @property {EngineBackend} backend
 * @property {boolean} [alwaysAvailable]
 * @property {string} [commandEnv] - env var for executable path (UCI)
 * @property {string} [commandFallback] - PATH name if env unset (UCI)
 * @property {string} [localBinName] - optional ./bin/<name> probe (UCI)
 */

/** @type {EngineDefinition[]} */
const ENGINE_DEFINITIONS = Object.freeze([
    {
        id: "brain43",
        labelKey: "play.newGameDialog.brain43",
        fallbackLabel: "Brain 4.3",
        backend: "brain",
        alwaysAvailable: true,
    },
    {
        id: "brain42",
        labelKey: "play.newGameDialog.brain42",
        fallbackLabel: "Brain 4.2",
        backend: "brain",
        alwaysAvailable: true,
    },
    {
        id: "brain41",
        labelKey: "play.newGameDialog.brain41",
        fallbackLabel: "Brain 4.1",
        backend: "brain",
        alwaysAvailable: true,
    },
    {
        id: "stockfish",
        labelKey: "play.newGameDialog.stockfish",
        fallbackLabel: "Stockfish",
        backend: "uci",
        alwaysAvailable: false,
        commandEnv: "STOCKFISH_PATH",
        commandFallback: "stockfish",
        localBinName: "stockfish",
    },
]);

const byId = new Map(ENGINE_DEFINITIONS.map((e) => [e.id, e]));

function listPlayEngines() {
    return ENGINE_DEFINITIONS.slice();
}

function getEngine(id) {
    return byId.get(id) || null;
}

function isBrainEngine(id) {
    return BRAIN_IDS.indexOf(id) !== -1;
}

function isUciEngine(id) {
    const def = getEngine(id);
    return !!(def && def.backend === "uci");
}

function isExecutableFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
        return false;
    }
    try {
        const st = fs.statSync(filePath);
        if (!st.isFile()) {
            return false;
        }
        fs.accessSync(filePath, fs.constants.X_OK);
        return isCompatibleNativeBinary(filePath);
    } catch {
        // Windows often reports X_OK oddly; existence as a file is enough for .exe
        try {
            if (!fs.statSync(filePath).isFile()) {
                return false;
            }
            return isCompatibleNativeBinary(filePath);
        } catch {
            return false;
        }
    }
}

/**
 * Reject binaries built for another OS (e.g. Linux ELF left in ./bin on macOS),
 * so discovery can fall through to Homebrew / PATH Stockfish.
 * @param {string} filePath
 * @returns {boolean}
 */
function isCompatibleNativeBinary(filePath) {
    try {
        const fd = fs.openSync(filePath, "r");
        const buf = Buffer.alloc(4);
        const n = fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);
        if (n < 4) {
            return true;
        }
        const isElf =
            buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46;
        const be = buf.readUInt32BE(0);
        const le = buf.readUInt32LE(0);
        const isMachO =
            be === 0xfeedface ||
            be === 0xfeedfacf ||
            be === 0xcafebabe ||
            be === 0xcafebabf ||
            le === 0xfeedface ||
            le === 0xfeedfacf ||
            le === 0xcafebabe ||
            le === 0xcafebabf;
        const isPe = buf[0] === 0x4d && buf[1] === 0x5a; // MZ
        if (process.platform === "darwin") {
            return !(isElf || isPe);
        }
        if (process.platform === "linux") {
            return !(isMachO || isPe);
        }
        if (process.platform === "win32") {
            return !(isElf || isMachO);
        }
        return true;
    } catch {
        return true;
    }
}

function exeNames(baseName) {
    const base = String(baseName || "").trim();
    if (!base) {
        return [];
    }
    const names = [base];
    if (process.platform === "win32" && !/\.exe$/i.test(base)) {
        names.push(`${base}.exe`);
    }
    return names;
}

function tryLocalBin(name) {
    const names = exeNames(name);
    for (let i = 0; i < names.length; i += 1) {
        const localBin = path.join(process.cwd(), "bin", names[i]);
        if (isExecutableFile(localBin)) {
            return localBin;
        }
    }
    return null;
}

/**
 * Absolute paths where users commonly put Stockfish (especially Windows GUI apps
 * that do not inherit a terminal PATH).
 * @param {NodeJS.ProcessEnv} environ
 * @param {string} [binName]
 * @returns {string[]}
 */
function stockfishCandidatePaths(environ, binName) {
    const names = exeNames(binName || "stockfish");
    const roots = [];
    const userData = environ.SHMERLING_USER_DATA && String(environ.SHMERLING_USER_DATA).trim();
    if (userData) {
        roots.push(path.join(userData, "engines"));
        roots.push(userData);
    }
    const resources = environ.SHMERLING_APP_RESOURCES && String(environ.SHMERLING_APP_RESOURCES).trim();
    if (resources) {
        roots.push(resources);
        roots.push(path.join(resources, "bin"));
        roots.push(path.join(resources, "engines"));
    }
    if (process.platform === "win32") {
        const home = environ.USERPROFILE || environ.HOME || "";
        const local = environ.LOCALAPPDATA || "";
        const pf = environ.ProgramFiles || "C:\\Program Files";
        const pf86 = environ["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
        roots.push(
            path.join(local, "Programs", "Stockfish"),
            path.join(local, "Stockfish"),
            path.join(pf, "Stockfish"),
            path.join(pf86, "Stockfish"),
            path.join(home, "Stockfish"),
            path.join(home, "stockfish"),
            path.join(home, "scoop", "apps", "stockfish", "current"),
            path.join(home, "scoop", "shims"),
            path.join(environ.ChocolateyInstall || "C:\\ProgramData\\chocolatey", "bin"),
        );
    } else {
        roots.push("/usr/local/bin", "/opt/homebrew/bin", "/usr/games", "/usr/bin");
    }

    const out = [];
    const seen = new Set();
    for (let r = 0; r < roots.length; r += 1) {
        const root = roots[r];
        if (!root) {
            continue;
        }
        for (let n = 0; n < names.length; n += 1) {
            const candidate = path.join(root, names[n]);
            if (seen.has(candidate)) {
                continue;
            }
            seen.add(candidate);
            out.push(candidate);
        }
    }
    return out;
}

function findExistingCandidate(environ, binName) {
    const candidates = stockfishCandidatePaths(environ, binName);
    for (let i = 0; i < candidates.length; i += 1) {
        if (isExecutableFile(candidates[i])) {
            return candidates[i];
        }
    }
    return null;
}

function resolveUciCommand(def, env) {
    const environ = env || process.env;
    if (!def || def.backend !== "uci") {
        return null;
    }
    const fromEnv =
        def.commandEnv && typeof environ[def.commandEnv] === "string"
            ? environ[def.commandEnv].trim()
            : "";
    if (fromEnv) {
        // Allow any filename; strip accidental quotes from Windows env editors.
        let cleaned = fromEnv;
        if (
            (cleaned.charAt(0) === '"' && cleaned.charAt(cleaned.length - 1) === '"')
            || (cleaned.charAt(0) === "'" && cleaned.charAt(cleaned.length - 1) === "'")
        ) {
            cleaned = cleaned.slice(1, -1).trim();
        }
        return cleaned || null;
    }
    // Prefer repo-local binary (e.g. scripts/install-stockfish-linux.sh → bin/stockfish).
    const local =
        tryLocalBin(def.localBinName) || tryLocalBin(def.commandFallback);
    if (local) {
        return local;
    }
    if (def.id === "stockfish") {
        const discovered = findExistingCandidate(
            environ,
            def.localBinName || def.commandFallback || "stockfish",
        );
        if (discovered) {
            return discovered;
        }
    }
    if (def.commandFallback && String(def.commandFallback).trim()) {
        const fallback = String(def.commandFallback).trim();
        if (process.platform === "win32" && !/\.exe$/i.test(fallback)) {
            return `${fallback}.exe`;
        }
        return fallback;
    }
    return null;
}

/**
 * Selectable Play engine ids (brains + registered UCI).
 * @returns {string[]}
 */
function playEngineIds() {
    return listPlayEngines().map((e) => e.id);
}

module.exports = {
    BRAIN_IDS,
    ENGINE_DEFINITIONS,
    listPlayEngines,
    getEngine,
    isBrainEngine,
    isUciEngine,
    resolveUciCommand,
    playEngineIds,
    stockfishCandidatePaths,
    findExistingCandidate,
    isCompatibleNativeBinary,
};
