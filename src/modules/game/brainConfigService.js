const fs = require("fs");
const path = require("path");

const CONFIG_DIR = path.join(__dirname, "..", "..", "config", "brains");
const MAX_SEARCH_DEPTH = 6;
/** Allowed engine thinking times (seconds) for desktop UI. */
const THINKING_TIME_SECONDS_OPTIONS = [2, 5, 10, 15, 20, 30, 60, 120];
const DEFAULT_THINKING_TIME_SECONDS = 10;

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
            doublePawnPenalty: -0.25,
            pawnAdvancedBonus: 0.2,
            firstKingMovePenalty: -0.1,
            firstRookMovePenalty: -0.1,
            pawnsChainCountPenalty: -0.1,
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
        /**
         * Scale search depth from root legal-move count: fewer moves → deeper search (log2 bonus plies),
         * more moves than reference → shallower. Depth increases are scaled by total pieces on the board
         * so checks in the middlegame do not search excessively deep.
         */
        adaptiveDepth: {
            enabled: true,
            /** Typical root branching at base maxDepth; used as the evaluation budget anchor. */
            referenceRootMoves: 30,
            /** Average branching factor per ply for leaf-count estimation (worst case, no pruning). */
            avgBranchingFactor: 32,
            minSearchDepth: 1,
            maxSearchDepth: MAX_SEARCH_DEPTH,
            /** Full root-move depth bonus at or below this total piece count (both colors). */
            fullAdaptiveBelowTotalPieces: 12,
            /** No depth increase from sparse root moves above this total piece count. */
            noAdaptiveAboveTotalPieces: 24,
        },
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
                doublePawnPenalty: -0.25,
                pawnAdvancedBonus: 0.2,
                firstKingMovePenalty: -0.1,
                firstRookMovePenalty: -0.1,
                pawnsChainCountPenalty: -0.5,
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
                doublePawnPenalty: -0.25,
                pawnAdvancedBonus: 0.2,
                firstKingMovePenalty: -0.1,
                firstRookMovePenalty: -0.1,
                pawnsChainCountPenalty: -0.5,
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
                doublePawnPenalty: -0.25,
                pawnAdvancedBonus: 0.2,
                firstKingMovePenalty: -0.1,
                firstRookMovePenalty: -0.1,
                pawnsChainCountPenalty: -0.5,
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
DEFAULT_CONFIGS.brain43 = JSON.parse(JSON.stringify(DEFAULT_CONFIGS.brain42));

const ALLOWED_BRAINS = Object.keys(DEFAULT_CONFIGS);
const SCORE_KEYS = ["pawn", "rook", "knight", "bishop", "queen", "king"];

/**
 * Additive special-eval keys must be ≤ 0 in config (penalties).
 * Legacy files stored magnitudes as positive; this helper negates those once on load.
 * @param {number} value
 * @param {number} fallback
 * @returns {number}
 */
function normalizeSignedPenalty(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    if (parsed > 0) {
        return -parsed;
    }
    return parsed;
}

function getConfigPath(engineName) {
    return path.join(CONFIG_DIR, `${engineName}.json`);
}

function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

function getDefaultConfig(engineName) {
    const safeEngine = ALLOWED_BRAINS.includes(engineName) ? engineName : "brain43";
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
        specialEvaluations.doublePawnPenalty = normalizeSignedPenalty(
            doublePawnPenalty,
            specialEvaluations.doublePawnPenalty,
        );
    }
    const pawnAdvancedBonus = Number(rawSe.pawnAdvancedBonus ?? specialEvaluations.pawnAdvancedBonus);
    if (Number.isFinite(pawnAdvancedBonus)) {
        specialEvaluations.pawnAdvancedBonus = pawnAdvancedBonus;
    }
    const firstKingMovePenalty = Number(rawSe.firstKingMovePenalty ?? specialEvaluations.firstKingMovePenalty);
    if (Number.isFinite(firstKingMovePenalty)) {
        specialEvaluations.firstKingMovePenalty = normalizeSignedPenalty(
            firstKingMovePenalty,
            specialEvaluations.firstKingMovePenalty,
        );
    }
    const firstRookMovePenalty = Number(rawSe.firstRookMovePenalty ?? specialEvaluations.firstRookMovePenalty);
    if (Number.isFinite(firstRookMovePenalty)) {
        specialEvaluations.firstRookMovePenalty = normalizeSignedPenalty(
            firstRookMovePenalty,
            specialEvaluations.firstRookMovePenalty,
        );
    }
    const pawnsChainCountPenalty = Number(rawSe.pawnsChainCountPenalty ?? specialEvaluations.pawnsChainCountPenalty);
    if (Number.isFinite(pawnsChainCountPenalty)) {
        specialEvaluations.pawnsChainCountPenalty = normalizeSignedPenalty(
            pawnsChainCountPenalty,
            specialEvaluations.pawnsChainCountPenalty,
        );
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

function sanitizeAdaptiveDepthSettings(fallback, raw) {
    const fb = fallback && typeof fallback === "object" ? fallback : {};
    const input = raw && typeof raw === "object" ? raw : {};
    const ref = Number(input.referenceRootMoves ?? fb.referenceRootMoves);
    const avg = Number(input.avgBranchingFactor ?? fb.avgBranchingFactor);
    const minD = Number(input.minSearchDepth ?? fb.minSearchDepth);
    const maxD = Number(input.maxSearchDepth ?? fb.maxSearchDepth);
    const fullBelow = Number(input.fullAdaptiveBelowTotalPieces ?? fb.fullAdaptiveBelowTotalPieces);
    const noneAbove = Number(input.noAdaptiveAboveTotalPieces ?? fb.noAdaptiveAboveTotalPieces);
    const enabled = input.enabled !== undefined ? Boolean(input.enabled) : fb.enabled !== false;
    return {
        enabled,
        referenceRootMoves: Number.isFinite(ref) && ref > 0 ? ref : 30,
        avgBranchingFactor: Number.isFinite(avg) && avg > 1 ? avg : 32,
        minSearchDepth: Number.isFinite(minD) && minD >= 1 ? Math.min(MAX_SEARCH_DEPTH, Math.floor(minD)) : 1,
        maxSearchDepth: Number.isFinite(maxD) && maxD >= 1 ? Math.min(MAX_SEARCH_DEPTH, Math.floor(maxD)) : MAX_SEARCH_DEPTH,
        fullAdaptiveBelowTotalPieces:
            Number.isFinite(fullBelow) && fullBelow > 0 ? Math.floor(fullBelow) : 12,
        noAdaptiveAboveTotalPieces:
            Number.isFinite(noneAbove) && noneAbove > 0 ? Math.floor(noneAbove) : 24,
    };
}

function sanitizeBrain42StyleConfig(engineName, rawConfig) {
    const fallback = getDefaultConfig(engineName);
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
    const adaptiveDepth = sanitizeAdaptiveDepthSettings(fallback.adaptiveDepth, raw.adaptiveDepth);
    return { gamePhase, pawnFileValues, adaptiveDepth, startGame, midGame, endGame };
}

function sanitizeBrain42Config(rawConfig) {
    return sanitizeBrain42StyleConfig("brain42", rawConfig);
}

function sanitizeBrain43Config(rawConfig) {
    return sanitizeBrain42StyleConfig("brain43", rawConfig);
}

function sanitizeBrainConfig(engineName, rawConfig) {
    const safeEngine = ALLOWED_BRAINS.includes(engineName) ? engineName : "brain43";
    if (safeEngine === "brain42") {
        return sanitizeBrain42Config(rawConfig);
    }
    if (safeEngine === "brain43") {
        return sanitizeBrain43Config(rawConfig);
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
    const safeEngine = ALLOWED_BRAINS.includes(engineName) ? engineName : "brain43";
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
    const safeEngine = ALLOWED_BRAINS.includes(engineName) ? engineName : "brain43";
    ensureConfigDir();
    const sanitized = sanitizeBrainConfig(safeEngine, rawConfig);
    fs.writeFileSync(getConfigPath(safeEngine), JSON.stringify(sanitized, null, 2), "utf8");
    return sanitized;
}

/**
 * Snap UI / stored value to an allowed thinking time (2, 5, 10, 15, 20, 30, 60, 120 seconds).
 * Legacy difficulty 1–6 maps across the option list; other values snap to nearest.
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
function normalizeThinkingTimeSeconds(value) {
    const allowed = THINKING_TIME_SECONDS_OPTIONS;
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_THINKING_TIME_SECONDS;
    }
    if (allowed.includes(parsed)) {
        return parsed;
    }
    if (parsed >= 1 && parsed <= 6) {
        return allowed[Math.min(parsed - 1, allowed.length - 1)];
    }
    let nearest = allowed[0];
    let nearestDist = Math.abs(parsed - nearest);
    for (let i = 1; i < allowed.length; i += 1) {
        const dist = Math.abs(parsed - allowed[i]);
        if (dist < nearestDist) {
            nearest = allowed[i];
            nearestDist = dist;
        }
    }
    return nearest;
}

/** @param {number|string|null|undefined} seconds */
function thinkingTimeSecondsToMs(seconds) {
    return normalizeThinkingTimeSeconds(seconds) * 1000;
}

module.exports = {
    MAX_SEARCH_DEPTH,
    THINKING_TIME_SECONDS_OPTIONS,
    DEFAULT_THINKING_TIME_SECONDS,
    ALLOWED_BRAINS,
    PAWN_FILE_LETTERS,
    getDefaultConfig,
    loadBrainConfig,
    saveBrainConfig,
    sanitizeBrainConfig,
    sanitizeBrain42Config,
    sanitizeBrain43Config,
    sanitizeAdaptiveDepthSettings,
    normalizeThinkingTimeSeconds,
    thinkingTimeSecondsToMs,
};
