/**
 * Opening book file loader (JSON / JSONL). Shared by brain42 and gamesManager.
 */
const fs = require("fs").promises;
const path = require("path");
const {
    openingBookStateToLookupKey,
    parseBookMove,
} = require("./openingBookJson");

const OPENING_BOOK_BASENAME = "opening-book-states.json";
const OPENING_BOOK_2_BASENAME = "opening-book-2-states.json";

function resolveOpeningBookFilePath() {
    if (process.env.SHMERLING_MODE === "desktop") {
        const runtime = require("./desktop/runtime");
        runtime.ensureInitialized();
        return runtime.resolveOpeningBookPath();
    }
    return path.join(__dirname, "..", "data", OPENING_BOOK_BASENAME);
}

function resolveOpeningBook2FilePath() {
    if (process.env.SHMERLING_MODE === "desktop") {
        const runtime = require("./desktop/runtime");
        runtime.ensureInitialized();
        return runtime.resolveOpeningBook2Path();
    }
    return path.join(__dirname, "..", "data", OPENING_BOOK_2_BASENAME);
}

function parseOpeningBookMove(move) {
    return parseBookMove(move);
}

function normalizeOpeningBookEntries(raw) {
    const out = [];
    const list = Array.isArray(raw)
        ? raw
        : raw && Array.isArray(raw.entries)
          ? raw.entries
          : [];
    for (const entry of list) {
        const stateKey = openingBookStateToLookupKey(entry && entry.state);
        if (!stateKey) {
            continue;
        }
        const move = parseOpeningBookMove(entry.move);
        if (!move) {
            continue;
        }
        const weight = Number(entry && entry.weight);
        out.push({
            state: stateKey,
            move,
            weight: Number.isFinite(weight) && weight > 0 ? Math.floor(weight) : 1,
        });
    }
    return out;
}

function parseOpeningBookFileText(text) {
    const trimmed = text.trim();
    if (!trimmed) {
        return [];
    }
    if (trimmed.startsWith("{") && trimmed.includes('"entries"')) {
        return normalizeOpeningBookEntries(JSON.parse(trimmed));
    }
    if (trimmed.startsWith("[")) {
        return normalizeOpeningBookEntries(JSON.parse(trimmed));
    }
    const entries = [];
    const lines = trimmed.split("\n");
    for (const line of lines) {
        const row = line.trim();
        if (!row) {
            continue;
        }
        let parsed;
        try {
            parsed = JSON.parse(row);
        } catch {
            continue;
        }
        if (parsed && parsed.generatedAt && !parsed.state) {
            continue;
        }
        const stateKey = openingBookStateToLookupKey(parsed && parsed.state);
        const move = parseOpeningBookMove(parsed && parsed.move);
        if (!stateKey || !move) {
            continue;
        }
        const weight = Number(parsed && parsed.weight);
        entries.push({
            state: stateKey,
            move,
            weight: Number.isFinite(weight) && weight > 0 ? Math.floor(weight) : 1,
        });
    }
    return entries;
}

async function loadOpeningBookEntries(filePath) {
    const jsonPath = filePath || resolveOpeningBookFilePath();
    try {
        const text = await fs.readFile(jsonPath, "utf8");
        return parseOpeningBookFileText(text);
    } catch (e) {
        if (e && e.code === "ENOENT") {
            return [];
        }
        console.warn(`[opening book] Failed to read ${path.basename(jsonPath)}:`, e.message || e);
        return [];
    }
}

/** Load primary + secondary opening books and merge entry lists (weights combined in brain). */
async function loadMergedOpeningBookEntries() {
    const paths = [resolveOpeningBookFilePath(), resolveOpeningBook2FilePath()];
    const merged = [];
    for (let i = 0; i < paths.length; i++) {
        const entries = await loadOpeningBookEntries(paths[i]);
        if (entries.length) {
            console.log(
                `[opening book] Loaded ${entries.length} entries from ${path.basename(paths[i])}`,
            );
            merged.push(...entries);
        }
    }
    return merged;
}

module.exports = {
    OPENING_BOOK_BASENAME,
    OPENING_BOOK_2_BASENAME,
    resolveOpeningBookFilePath,
    resolveOpeningBook2FilePath,
    loadOpeningBookEntries,
    loadMergedOpeningBookEntries,
    parseOpeningBookFileText,
};
