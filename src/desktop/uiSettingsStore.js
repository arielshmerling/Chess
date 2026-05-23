/**
 * Desktop UI preferences (piece set, etc.) stored in userData settings.json.
 */

const fs = require("fs").promises;
const runtime = require("./runtime");

const DEFAULT_SETTINGS = {
    pieceSet: "obsidian-court",
};

const VALID_PIECE_SETS = new Set([
    "obsidian-court",
    "storm-ivory",
    "ember-regalia",
]);

function normalizePieceSet(pieceSet) {
    if (typeof pieceSet === "string" && VALID_PIECE_SETS.has(pieceSet)) {
        return pieceSet;
    }
    return DEFAULT_SETTINGS.pieceSet;
}

function normalizeSettings(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    return {
        pieceSet: normalizePieceSet(input.pieceSet),
    };
}

async function readAll() {
    const filePath = runtime.getSettingsFilePath();
    try {
        const raw = await fs.readFile(filePath, "utf8");
        return normalizeSettings(JSON.parse(raw));
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return { ...DEFAULT_SETTINGS };
        }
        throw error;
    }
}

async function writeAll(partial) {
    const current = await readAll();
    const next = normalizeSettings({
        ...current,
        ...(partial && typeof partial === "object" ? partial : {}),
    });
    const filePath = runtime.getSettingsFilePath();
    await fs.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
    return next;
}

module.exports = {
    readAll,
    writeAll,
    normalizeSettings,
    DEFAULT_SETTINGS,
};
