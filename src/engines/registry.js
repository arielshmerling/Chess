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

function tryLocalBin(name) {
    if (!name || !String(name).trim()) {
        return null;
    }
    const base = String(name).trim();
    const names = [base];
    if (process.platform === "win32" && !/\.exe$/i.test(base)) {
        names.push(`${base}.exe`);
    }
    for (let i = 0; i < names.length; i += 1) {
        const localBin = path.join(process.cwd(), "bin", names[i]);
        try {
            if (fs.existsSync(localBin)) {
                fs.accessSync(localBin, fs.constants.X_OK);
                return localBin;
            }
        } catch {
            /* try next */
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
        return fromEnv;
    }
    // Prefer repo-local binary (e.g. scripts/install-stockfish-linux.sh → bin/stockfish).
    const local =
        tryLocalBin(def.localBinName) || tryLocalBin(def.commandFallback);
    if (local) {
        return local;
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
};
