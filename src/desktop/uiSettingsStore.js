/**
 * Desktop UI preferences (piece set, etc.) stored in userData settings.json.
 */

const fs = require("fs").promises;
const runtime = require("./runtime");

const DEFAULT_SETTINGS = {
    pieceSet: "storm-ivory",
    dockPanels: {
        leftCollapsed: true,
        rightCollapsed: true,
    },
};

const VALID_PIECE_SETS = new Set([
    "obsidian-court",
    "storm-ivory",
    "ember-regalia",
    "imperishable-army",
]);

function normalizePieceSet(pieceSet) {
    if (typeof pieceSet === "string" && VALID_PIECE_SETS.has(pieceSet)) {
        return pieceSet;
    }
    return DEFAULT_SETTINGS.pieceSet;
}

function normalizeDockPanels(dockPanels) {
    const input = dockPanels && typeof dockPanels === "object" ? dockPanels : {};
    return {
        leftCollapsed: input.leftCollapsed !== false,
        rightCollapsed: input.rightCollapsed !== false,
    };
}

function normalizeSettings(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    return {
        pieceSet: normalizePieceSet(input.pieceSet),
        dockPanels: normalizeDockPanels(input.dockPanels),
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
    const patch = partial && typeof partial === "object" ? partial : {};
    const merged = {
        ...current,
        ...patch,
        dockPanels: {
            ...current.dockPanels,
            ...(patch.dockPanels && typeof patch.dockPanels === "object" ? patch.dockPanels : {}),
        },
    };
    const next = normalizeSettings(merged);
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
