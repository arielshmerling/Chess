const fs = require("fs");
const path = require("path");

const CONFIG_DIR = path.join(__dirname, "..", "..", "config", "brains");

const DEFAULT_CONFIGS = {
    brain: {
        pieceScores: { pawn: 1, rook: 5, knight: 3, bishop: 3, queen: 9, king: 10000 },
    },
    brain2: {
        pieceScores: { pawn: 1, rook: 5, knight: 3, bishop: 3, queen: 9, king: 10000 },
    },
    brain3: {
        pieceScores: { pawn: 1, rook: 5, knight: 3, bishop: 3, queen: 9, king: 10000 },
    },
    brain4: {
        pieceScores: { pawn: 1, rook: 5, knight: 3, bishop: 3.25, queen: 9, king: 10000 },
    },
    brain41: {
        pieceScores: { pawn: 1, rook: 5, knight: 3, bishop: 3.25, queen: 9, king: 10000 },
        specialEvaluations: {
            doublePawnPenalty: 0.25,
            pawnAdvancedBonus: 0.2,
            firstKingMovePenalty: 0.1,
            firstRookMovePenalty: 0.1,
        },
    },
    brain5: {
        pieceScores: { pawn: 1, rook: 5, knight: 3, bishop: 3.25, queen: 9, king: 10000 },
    },
};

const ALLOWED_BRAINS = Object.keys(DEFAULT_CONFIGS);
const SCORE_KEYS = ["pawn", "rook", "knight", "bishop", "queen", "king"];

function getConfigPath(engineName) {
    return path.join(CONFIG_DIR, `${engineName}.json`);
}

function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

function getDefaultConfig(engineName) {
    const safeEngine = ALLOWED_BRAINS.includes(engineName) ? engineName : "brain4";
    return JSON.parse(JSON.stringify(DEFAULT_CONFIGS[safeEngine]));
}

function sanitizeBrainConfig(engineName, rawConfig) {
    const safeEngine = ALLOWED_BRAINS.includes(engineName) ? engineName : "brain4";
    const fallback = getDefaultConfig(safeEngine);
    const pieceScores = fallback.pieceScores;
    const inputPieceScores = rawConfig && rawConfig.pieceScores ? rawConfig.pieceScores : {};
    for (const key of SCORE_KEYS) {
        const parsed = Number(inputPieceScores[key]);
        if (Number.isFinite(parsed)) {
            pieceScores[key] = parsed;
        }
    }
    if (safeEngine === "brain41") {
        const specialEvaluations = { ...fallback.specialEvaluations };
        const doublePawnPenalty = Number(rawConfig && rawConfig.specialEvaluations
            ? rawConfig.specialEvaluations.doublePawnPenalty
            : specialEvaluations.doublePawnPenalty);
        if (Number.isFinite(doublePawnPenalty)) {
            specialEvaluations.doublePawnPenalty = doublePawnPenalty;
        }
        const pawnAdvancedBonus = Number(rawConfig && rawConfig.specialEvaluations
            ? rawConfig.specialEvaluations.pawnAdvancedBonus
            : specialEvaluations.pawnAdvancedBonus);
        if (Number.isFinite(pawnAdvancedBonus)) {
            specialEvaluations.pawnAdvancedBonus = pawnAdvancedBonus;
        }
        const firstKingMovePenalty = Number(rawConfig && rawConfig.specialEvaluations
            ? rawConfig.specialEvaluations.firstKingMovePenalty
            : specialEvaluations.firstKingMovePenalty);
        if (Number.isFinite(firstKingMovePenalty)) {
            specialEvaluations.firstKingMovePenalty = firstKingMovePenalty;
        }
        const firstRookMovePenalty = Number(rawConfig && rawConfig.specialEvaluations
            ? rawConfig.specialEvaluations.firstRookMovePenalty
            : specialEvaluations.firstRookMovePenalty);
        if (Number.isFinite(firstRookMovePenalty)) {
            specialEvaluations.firstRookMovePenalty = firstRookMovePenalty;
        }
        return { pieceScores, specialEvaluations };
    }
    return { pieceScores };
}

function loadBrainConfig(engineName) {
    const safeEngine = ALLOWED_BRAINS.includes(engineName) ? engineName : "brain4";
    ensureConfigDir();
    const filePath = getConfigPath(safeEngine);
    if (!fs.existsSync(filePath)) {
        const defaults = getDefaultConfig(safeEngine);
        fs.writeFileSync(filePath, JSON.stringify(defaults, null, 2), "utf8");
        return defaults;
    }
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        return sanitizeBrainConfig(safeEngine, JSON.parse(raw));
    } catch (error) {
        console.error(`[BrainConfig] Failed reading ${safeEngine} config, using defaults:`, error);
        return getDefaultConfig(safeEngine);
    }
}

function saveBrainConfig(engineName, rawConfig) {
    const safeEngine = ALLOWED_BRAINS.includes(engineName) ? engineName : "brain4";
    ensureConfigDir();
    const sanitized = sanitizeBrainConfig(safeEngine, rawConfig);
    fs.writeFileSync(getConfigPath(safeEngine), JSON.stringify(sanitized, null, 2), "utf8");
    return sanitized;
}

module.exports = {
    ALLOWED_BRAINS,
    getDefaultConfig,
    loadBrainConfig,
    saveBrainConfig,
    sanitizeBrainConfig,
};
