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
            pawnsChainCountPenalty: 0.1,
            drawMaterialDiffThreshold: 3,
            drawScoreWhenAhead: -5,
            drawScoreWhenBehind: 5,
            drawScoreWhenEven: -0.1,
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
        const pawnsChainCountPenalty = Number(rawConfig && rawConfig.specialEvaluations
            ? rawConfig.specialEvaluations.pawnsChainCountPenalty
            : specialEvaluations.pawnsChainCountPenalty);
        if (Number.isFinite(pawnsChainCountPenalty)) {
            specialEvaluations.pawnsChainCountPenalty = pawnsChainCountPenalty;
        }
        const drawMaterialDiffThreshold = Number(rawConfig && rawConfig.specialEvaluations
            ? rawConfig.specialEvaluations.drawMaterialDiffThreshold
            : specialEvaluations.drawMaterialDiffThreshold);
        if (Number.isFinite(drawMaterialDiffThreshold)) {
            specialEvaluations.drawMaterialDiffThreshold = drawMaterialDiffThreshold;
        }
        const drawScoreWhenAhead = Number(rawConfig && rawConfig.specialEvaluations
            ? rawConfig.specialEvaluations.drawScoreWhenAhead
            : specialEvaluations.drawScoreWhenAhead);
        if (Number.isFinite(drawScoreWhenAhead)) {
            specialEvaluations.drawScoreWhenAhead = drawScoreWhenAhead;
        }
        const drawScoreWhenBehind = Number(rawConfig && rawConfig.specialEvaluations
            ? rawConfig.specialEvaluations.drawScoreWhenBehind
            : specialEvaluations.drawScoreWhenBehind);
        if (Number.isFinite(drawScoreWhenBehind)) {
            specialEvaluations.drawScoreWhenBehind = drawScoreWhenBehind;
        }
        const drawScoreWhenEven = Number(rawConfig && rawConfig.specialEvaluations
            ? rawConfig.specialEvaluations.drawScoreWhenEven
            : specialEvaluations.drawScoreWhenEven);
        if (Number.isFinite(drawScoreWhenEven)) {
            specialEvaluations.drawScoreWhenEven = drawScoreWhenEven;
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
        console.log(`[BrainConfig] Wrote default ${safeEngine} to ${filePath}: ${JSON.stringify(defaults)}`);
        return defaults;
    }
    try {
        const raw = fs.readFileSync(filePath, "utf8");
        const loaded = sanitizeBrainConfig(safeEngine, JSON.parse(raw));
        console.log(`[BrainConfig] Loaded ${safeEngine} from ${filePath}: ${JSON.stringify(loaded)}`);
        return loaded;
    } catch (error) {
        console.error(`[BrainConfig] Failed reading ${safeEngine} config, using defaults:`, error);
        const fallback = getDefaultConfig(safeEngine);
        console.log(`[BrainConfig] Using defaults for ${safeEngine}: ${JSON.stringify(fallback)}`);
        return fallback;
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
