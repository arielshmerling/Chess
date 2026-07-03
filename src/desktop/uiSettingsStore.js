/**
 * Desktop UI preferences (piece set, etc.) stored in userData settings.json.
 */

const fs = require("fs").promises;
const runtime = require("./runtime");

const THINKING_TIME_OPTIONS = [2, 5, 10, 15, 20, 30, 60, 120];

const DEFAULT_SETTINGS = {
    pieceSet: "storm-ivory",
    dockPanels: {
        leftCollapsed: true,
        rightCollapsed: true,
    },
    gamePreferences: {
        mouse: "drag",
        thinkingTimeSeconds: 10,
        showAvailableMoves: true,
        immediateResign: false,
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

function normalizeThinkingTimeSeconds(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_SETTINGS.gamePreferences.thinkingTimeSeconds;
    }
    if (THINKING_TIME_OPTIONS.includes(parsed)) {
        return parsed;
    }
    if (parsed >= 1 && parsed <= THINKING_TIME_OPTIONS.length) {
        return THINKING_TIME_OPTIONS[Math.min(parsed - 1, THINKING_TIME_OPTIONS.length - 1)];
    }
    let nearest = THINKING_TIME_OPTIONS[0];
    let nearestDist = Math.abs(parsed - nearest);
    for (let i = 1; i < THINKING_TIME_OPTIONS.length; i += 1) {
        const dist = Math.abs(parsed - THINKING_TIME_OPTIONS[i]);
        if (dist < nearestDist) {
            nearest = THINKING_TIME_OPTIONS[i];
            nearestDist = dist;
        }
    }
    return nearest;
}

function normalizeGamePreferences(gamePreferences) {
    const input = gamePreferences && typeof gamePreferences === "object" ? gamePreferences : {};
    return {
        mouse: input.mouse === "double" ? "double" : "drag",
        thinkingTimeSeconds: normalizeThinkingTimeSeconds(input.thinkingTimeSeconds),
        showAvailableMoves: input.showAvailableMoves !== false,
        immediateResign: input.immediateResign === true,
    };
}

function normalizeSettings(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    return {
        pieceSet: normalizePieceSet(input.pieceSet),
        dockPanels: normalizeDockPanels(input.dockPanels),
        gamePreferences: normalizeGamePreferences(input.gamePreferences),
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
        gamePreferences: {
            ...current.gamePreferences,
            ...(patch.gamePreferences && typeof patch.gamePreferences === "object"
                ? patch.gamePreferences
                : {}),
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
