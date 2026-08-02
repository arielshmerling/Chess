/**
 * Admin enable/disable overrides for Prefer-Play engines.
 * Persisted at data/prefer-play-engines.json (default: all enabled).
 */

"use strict";

const fs = require("fs").promises;
const path = require("path");

const STORE_PATH = path.join(__dirname, "../../data/prefer-play-engines.json");

/** @type {Set<string>|null} */
let disabledCache = null;
/** @type {Promise<Set<string>>|null} */
let loadPromise = null;

function normalizeDisabledIds(raw) {
    if (!raw || typeof raw !== "object") {
        return [];
    }
    const list = Array.isArray(raw.disabledIds) ? raw.disabledIds : [];
    const out = [];
    const seen = new Set();
    for (let i = 0; i < list.length; i += 1) {
        const id = typeof list[i] === "string" ? list[i].trim() : "";
        if (!id || seen.has(id)) {
            continue;
        }
        seen.add(id);
        out.push(id);
    }
    out.sort();
    return out;
}

async function readStoreFromDisk() {
    try {
        const raw = JSON.parse(await fs.readFile(STORE_PATH, "utf8"));
        return { disabledIds: normalizeDisabledIds(raw) };
    } catch (err) {
        if (err && err.code === "ENOENT") {
            return { disabledIds: [] };
        }
        throw err;
    }
}

async function writeStore(store) {
    const payload = {
        disabledIds: normalizeDisabledIds(store),
    };
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    disabledCache = new Set(payload.disabledIds);
    return payload;
}

async function getDisabledSet() {
    if (disabledCache) {
        return disabledCache;
    }
    if (!loadPromise) {
        loadPromise = readStoreFromDisk()
            .then((store) => {
                disabledCache = new Set(store.disabledIds);
                return disabledCache;
            })
            .finally(() => {
                loadPromise = null;
            });
    }
    return loadPromise;
}

async function isEngineEnabled(id) {
    const disabled = await getDisabledSet();
    return !disabled.has(id);
}

/**
 * @param {string} id
 * @param {boolean} enabled
 */
async function setEngineEnabled(id, enabled) {
    const store = await readStoreFromDisk();
    const set = new Set(store.disabledIds);
    if (enabled) {
        set.delete(id);
    } else {
        set.add(id);
    }
    return writeStore({ disabledIds: [...set] });
}

/** Test helper: clear in-memory cache (does not delete the file). */
function clearCache() {
    disabledCache = null;
    loadPromise = null;
}

/** Test helper: replace store contents and refresh cache. */
async function replaceStoreForTests(store) {
    return writeStore(store || { disabledIds: [] });
}

module.exports = {
    STORE_PATH,
    getDisabledSet,
    isEngineEnabled,
    setEngineEnabled,
    clearCache,
    replaceStoreForTests,
};
