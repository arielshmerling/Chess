const fs = require("fs");
const path = require("path");

const CONFIG_DIR = path.join(__dirname, "..", "..", "config", "brains");

const PAWN_FILE_LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"];

const DEFAULT_BRAIN42_PAWN_FILE_VALUES = {
    openingMidGame: {
        a: 0.75,
        b: 1,
        c: 1.25,
        d: 1.5,
        e: 1.5,
        f: 1.25,
        g: 1,
        h: 0.75,
    },
    endGame: {
        a: 1.5,
        b: 1.25,
        c: 1,
        d: 0.75,
        e: 0.75,
        f: 1,
        g: 1.25,
        h: 1.5,
    },
};

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
            /** Rooks on open file on invading row (rank 7 for white, rank 2 for black): count as multiplier × rook piece value vs base (e.g. 1.25 = +25% rook value each). */
            bestOpenRookOnSeventhMultiplier: 1.25,
            /** Friendly rook on any fully open file counts as multiplier × rook value (default 1.125 = +12.5%). */
            veryGoodOpenRookMultiplier: 1.125,
            /** Friendly rook on a closed file (any pawn on that file): value scaled by multiplier (< 1 = penalty); default 0.75 ⇒ −25% per rook. */
            poorClosedFileRookMultiplier: 0.75,
        },
    },
    brain42: {
        gamePhase: {
            /** Switch to midGame after this many full moves (both sides). */
            midGameAfterMoves: 10,
            /** Switch to endGame when the opponent has at most this many pieces on the board. */
            endGameOpponentMaxPieces: 8,
        },
        /** Pawn value multipliers by file (× base pawn score). openingMidGame = start + mid; endGame = end phase. */
        pawnFileValues: DEFAULT_BRAIN42_PAWN_FILE_VALUES,
        startGame: {
            pieceScores: { pawn: 1, rook: 5, knight: 3, bishop: 3.25, queen: 9, king: 10000 },
            specialEvaluations: {
                doublePawnPenalty: 0.25,
                pawnAdvancedBonus: 0.2,
                firstKingMovePenalty: 0.1,
                firstRookMovePenalty: 0.1,
                pawnsChainCountPenalty: 0.5,
                drawMaterialDiffThreshold: 3,
                drawScoreWhenAhead: -5,
                drawScoreWhenBehind: 5,
                drawScoreWhenEven: -0.1,
                bestOpenRookOnSeventhMultiplier: 1.25,
                veryGoodOpenRookMultiplier: 1.125,
                poorClosedFileRookMultiplier: 0.75,
            },
        },
        midGame: {
            pieceScores: { pawn: 1, rook: 5, knight: 3, bishop: 3.25, queen: 9, king: 10000 },
            specialEvaluations: {
                doublePawnPenalty: 0.25,
                pawnAdvancedBonus: 0.2,
                firstKingMovePenalty: 0.1,
                firstRookMovePenalty: 0.1,
                pawnsChainCountPenalty: 0.5,
                drawMaterialDiffThreshold: 3,
                drawScoreWhenAhead: -5,
                drawScoreWhenBehind: 5,
                drawScoreWhenEven: -0.1,
                bestOpenRookOnSeventhMultiplier: 1.25,
                veryGoodOpenRookMultiplier: 1.125,
                poorClosedFileRookMultiplier: 0.75,
            },
        },
        endGame: {
            pieceScores: { pawn: 1, rook: 5, knight: 3, bishop: 3.25, queen: 9, king: 10000 },
            specialEvaluations: {
                doublePawnPenalty: 0.25,
                pawnAdvancedBonus: 0.2,
                firstKingMovePenalty: 0.1,
                firstRookMovePenalty: 0.1,
                pawnsChainCountPenalty: 0.5,
                drawMaterialDiffThreshold: 3,
                drawScoreWhenAhead: -5,
                drawScoreWhenBehind: 5,
                drawScoreWhenEven: -0.1,
                bestOpenRookOnSeventhMultiplier: 1.25,
                veryGoodOpenRookMultiplier: 1.125,
                poorClosedFileRookMultiplier: 0.75,
            },
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

function sanitizeBrain41StylePhaseSettings(fallbackPhase, rawPhase) {
    const pieceScores = { ...fallbackPhase.pieceScores };
    const inputPieceScores = rawPhase && rawPhase.pieceScores ? rawPhase.pieceScores : {};
    for (const key of SCORE_KEYS) {
        const parsed = Number(inputPieceScores[key]);
        if (Number.isFinite(parsed)) {
            pieceScores[key] = parsed;
        }
    }
    const specialEvaluations = { ...fallbackPhase.specialEvaluations };
    const rawSe = rawPhase && rawPhase.specialEvaluations ? rawPhase.specialEvaluations : {};
    const doublePawnPenalty = Number(rawSe.doublePawnPenalty ?? specialEvaluations.doublePawnPenalty);
    if (Number.isFinite(doublePawnPenalty)) {
        specialEvaluations.doublePawnPenalty = doublePawnPenalty;
    }
    const pawnAdvancedBonus = Number(rawSe.pawnAdvancedBonus ?? specialEvaluations.pawnAdvancedBonus);
    if (Number.isFinite(pawnAdvancedBonus)) {
        specialEvaluations.pawnAdvancedBonus = pawnAdvancedBonus;
    }
    const firstKingMovePenalty = Number(rawSe.firstKingMovePenalty ?? specialEvaluations.firstKingMovePenalty);
    if (Number.isFinite(firstKingMovePenalty)) {
        specialEvaluations.firstKingMovePenalty = firstKingMovePenalty;
    }
    const firstRookMovePenalty = Number(rawSe.firstRookMovePenalty ?? specialEvaluations.firstRookMovePenalty);
    if (Number.isFinite(firstRookMovePenalty)) {
        specialEvaluations.firstRookMovePenalty = firstRookMovePenalty;
    }
    const pawnsChainCountPenalty = Number(rawSe.pawnsChainCountPenalty ?? specialEvaluations.pawnsChainCountPenalty);
    if (Number.isFinite(pawnsChainCountPenalty)) {
        specialEvaluations.pawnsChainCountPenalty = pawnsChainCountPenalty;
    }
    const drawMaterialDiffThreshold = Number(
        rawSe.drawMaterialDiffThreshold ?? specialEvaluations.drawMaterialDiffThreshold,
    );
    if (Number.isFinite(drawMaterialDiffThreshold)) {
        specialEvaluations.drawMaterialDiffThreshold = drawMaterialDiffThreshold;
    }
    const drawScoreWhenAhead = Number(rawSe.drawScoreWhenAhead ?? specialEvaluations.drawScoreWhenAhead);
    if (Number.isFinite(drawScoreWhenAhead)) {
        specialEvaluations.drawScoreWhenAhead = drawScoreWhenAhead;
    }
    const drawScoreWhenBehind = Number(rawSe.drawScoreWhenBehind ?? specialEvaluations.drawScoreWhenBehind);
    if (Number.isFinite(drawScoreWhenBehind)) {
        specialEvaluations.drawScoreWhenBehind = drawScoreWhenBehind;
    }
    const drawScoreWhenEven = Number(rawSe.drawScoreWhenEven ?? specialEvaluations.drawScoreWhenEven);
    if (Number.isFinite(drawScoreWhenEven)) {
        specialEvaluations.drawScoreWhenEven = drawScoreWhenEven;
    }
    const bestOpenRookOnSeventhMultiplier = Number(
        rawSe.bestOpenRookOnSeventhMultiplier ?? specialEvaluations.bestOpenRookOnSeventhMultiplier,
    );
    if (Number.isFinite(bestOpenRookOnSeventhMultiplier)) {
        specialEvaluations.bestOpenRookOnSeventhMultiplier = bestOpenRookOnSeventhMultiplier;
    }
    const veryGoodOpenRookMultiplier = Number(
        rawSe.veryGoodOpenRookMultiplier ?? specialEvaluations.veryGoodOpenRookMultiplier,
    );
    if (Number.isFinite(veryGoodOpenRookMultiplier)) {
        specialEvaluations.veryGoodOpenRookMultiplier = veryGoodOpenRookMultiplier;
    }
    const poorClosedFileRookMultiplier = Number(
        rawSe.poorClosedFileRookMultiplier ?? specialEvaluations.poorClosedFileRookMultiplier,
    );
    if (Number.isFinite(poorClosedFileRookMultiplier)) {
        specialEvaluations.poorClosedFileRookMultiplier = poorClosedFileRookMultiplier;
    }
    return { pieceScores, specialEvaluations };
}

function sanitizePawnFileTable(fallbackTable, rawTable) {
    const out = { ...fallbackTable };
    const raw = rawTable && typeof rawTable === "object" ? rawTable : {};
    for (let i = 0; i < PAWN_FILE_LETTERS.length; i++) {
        const file = PAWN_FILE_LETTERS[i];
        const parsed = Number(raw[file]);
        if (Number.isFinite(parsed)) {
            out[file] = parsed;
        }
    }
    return out;
}

function sanitizePawnFileValues(fallback, raw) {
    const fb = fallback || DEFAULT_BRAIN42_PAWN_FILE_VALUES;
    const input = raw && typeof raw === "object" ? raw : {};
    return {
        openingMidGame: sanitizePawnFileTable(
            fb.openingMidGame,
            input.openingMidGame,
        ),
        endGame: sanitizePawnFileTable(fb.endGame, input.endGame),
    };
}

function sanitizeBrain42Config(rawConfig) {
    const fallback = getDefaultConfig("brain42");
    let raw = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    if (raw.pieceScores && !raw.startGame) {
        raw = {
            ...raw,
            startGame: {
                pieceScores: raw.pieceScores,
                specialEvaluations: raw.specialEvaluations,
            },
        };
    }
    const fbPhase = fallback.gamePhase || {};
    const rawPhase = raw.gamePhase || {};
    const midMoves = Number(rawPhase.midGameAfterMoves ?? fbPhase.midGameAfterMoves);
    const endPieces = Number(rawPhase.endGameOpponentMaxPieces ?? fbPhase.endGameOpponentMaxPieces);
    const gamePhase = {
        midGameAfterMoves: Number.isFinite(midMoves) ? midMoves : 10,
        endGameOpponentMaxPieces: Number.isFinite(endPieces) ? endPieces : 8,
    };
    const pawnFileValues = sanitizePawnFileValues(fallback.pawnFileValues, raw.pawnFileValues);
    const startFallback = fallback.startGame || fallback;
    const startRaw = raw.startGame || startFallback;
    const startGame = sanitizeBrain41StylePhaseSettings(startFallback, startRaw);
    const midGame = sanitizeBrain41StylePhaseSettings(
        fallback.midGame || startFallback,
        raw.midGame || startRaw,
    );
    const endGame = sanitizeBrain41StylePhaseSettings(
        fallback.endGame || startFallback,
        raw.endGame || startRaw,
    );
    return { gamePhase, pawnFileValues, startGame, midGame, endGame };
}

function sanitizeBrainConfig(engineName, rawConfig) {
    const safeEngine = ALLOWED_BRAINS.includes(engineName) ? engineName : "brain4";
    if (safeEngine === "brain42") {
        return sanitizeBrain42Config(rawConfig);
    }
    const fallback = getDefaultConfig(safeEngine);
    const pieceScores = { ...fallback.pieceScores };
    const inputPieceScores = rawConfig && rawConfig.pieceScores ? rawConfig.pieceScores : {};
    for (const key of SCORE_KEYS) {
        const parsed = Number(inputPieceScores[key]);
        if (Number.isFinite(parsed)) {
            pieceScores[key] = parsed;
        }
    }
    if (safeEngine === "brain41") {
        return sanitizeBrain41StylePhaseSettings(fallback, rawConfig);
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
    PAWN_FILE_LETTERS,
    getDefaultConfig,
    loadBrainConfig,
    saveBrainConfig,
    sanitizeBrainConfig,
    sanitizeBrain42Config,
};
