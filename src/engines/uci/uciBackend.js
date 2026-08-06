/**
 * UCI engine backend for Play (external Stockfish process).
 */

"use strict";

const { ChessGame } = require("../../ChessGame");
const brainConfigService = require("../../modules/game/brainConfigService");
const { collectLegalMoves } = require("../../desktop/forcedMateDetection");
const {
    detectForcedLossMateAsync,
    abortForcedMateDetection,
} = require("../../desktop/forcedMateDetectionAsync");
const { gameStateToFen, uciToMove } = require("../fenCodec");
const { getEngine, resolveUciCommand } = require("../registry");
const { createUciProcess, SearchAbortedError, normalizeSkillLevel } = require("./uciProcess");

const { thinkingTimeSecondsToMs } = brainConfigService;

/** @type {Map<string, ReturnType<typeof createUciProcess>>} */
const processesByEngineId = new Map();

let searchAbortRequested = false;
const abortSignal = {
    get aborted() {
        return searchAbortRequested;
    },
};

/** @type {Map<string, { available: boolean, checkedAt: number, error?: string }>} */
const availabilityCache = new Map();
const AVAILABILITY_TTL_MS = 60 * 1000;

function abortSearch() {
    searchAbortRequested = true;
    abortForcedMateDetection();
    for (const proc of processesByEngineId.values()) {
        try {
            proc.stop();
        } catch {
            /* ignore */
        }
    }
}

function getOrCreateProcess(engineId, env) {
    const def = getEngine(engineId);
    if (!def || def.backend !== "uci") {
        throw new Error(`Not a UCI engine: ${engineId}`);
    }
    const command = resolveUciCommand(def, env);
    if (!command) {
        throw new Error(`No UCI command configured for ${engineId}`);
    }
    let proc = processesByEngineId.get(engineId);
    if (!proc) {
        proc = createUciProcess(command, []);
        processesByEngineId.set(engineId, proc);
    }
    return proc;
}

/**
 * Probe whether a UCI engine can handshake.
 * @param {string} engineId
 * @param {{ env?: NodeJS.ProcessEnv, force?: boolean, timeoutMs?: number }} [options]
 */
async function probeAvailability(engineId, options) {
    const opts = options || {};
    const now = Date.now();
    if (!opts.force) {
        const cached = availabilityCache.get(engineId);
        if (cached && now - cached.checkedAt < AVAILABILITY_TTL_MS) {
            return cached;
        }
    }

    const def = getEngine(engineId);
    if (!def || def.backend !== "uci") {
        const result = { available: false, checkedAt: now, error: "not a UCI engine" };
        availabilityCache.set(engineId, result);
        return result;
    }

    const command = resolveUciCommand(def, opts.env || process.env);
    if (!command) {
        const result = {
            available: false,
            checkedAt: now,
            error: "command not configured",
        };
        availabilityCache.set(engineId, result);
        return result;
    }

    let proc = null;
    try {
        proc = createUciProcess(command, [], {
            idleTimeoutMs: opts.timeoutMs || 5000,
        });
        await proc.uciHandshake(opts.timeoutMs || 5000);
        const result = { available: true, checkedAt: now };
        availabilityCache.set(engineId, result);
        return result;
    } catch (err) {
        const result = {
            available: false,
            checkedAt: now,
            error: err && err.message ? err.message : String(err),
        };
        availabilityCache.set(engineId, result);
        return result;
    } finally {
        if (proc) {
            try {
                proc.dispose();
            } catch {
                /* ignore */
            }
        }
    }
}

function clearAvailabilityCache() {
    availabilityCache.clear();
}

function disposeAll() {
    for (const [id, proc] of processesByEngineId.entries()) {
        try {
            proc.dispose();
        } catch {
            /* ignore */
        }
        processesByEngineId.delete(id);
    }
}

/**
 * @param {{ gameState: object, engine?: string, thinkingTimeSeconds?: number, difficulty?: number, skillLevel?: number, immediateResign?: boolean, pliesPlayed?: number }} opts
 * @returns {Promise<object|null>}
 */
async function computeMove(opts) {
    searchAbortRequested = false;
    const {
        gameState,
        engine = "stockfish",
        thinkingTimeSeconds,
        difficulty,
        skillLevel,
        immediateResign,
        pliesPlayed,
    } = opts || {};

    if (!gameState) {
        throw new Error("Missing game state");
    }

    const chessGame = new ChessGame(true);
    chessGame.loadGame(JSON.stringify(gameState));

    if (chessGame.GameOver) {
        return null;
    }
    if (abortSignal.aborted) {
        throw new SearchAbortedError();
    }

    const forcedLoss = await detectForcedLossMateAsync(chessGame);
    if (abortSignal.aborted) {
        throw new SearchAbortedError();
    }
    if (forcedLoss.detected && immediateResign === true) {
        const turnBefore = chessGame.Turn;
        const escapeMoves = collectLegalMoves(chessGame);
        const firstMove = escapeMoves.length > 0 ? escapeMoves[0] : null;
        return {
            opponentMateDetected: true,
            opponentMateIn: forcedLoss.opponentMateIn,
            source: firstMove ? firstMove.source : null,
            target: firstMove ? firstMove.target : null,
            turn: turnBefore,
        };
    }

    const thinkingTimeMs = thinkingTimeSecondsToMs(
        thinkingTimeSeconds != null ? thinkingTimeSeconds : difficulty,
    );
    const fullmoveNumber =
        Number.isFinite(pliesPlayed) && pliesPlayed >= 0
            ? Math.floor(pliesPlayed / 2) + 1
            : 1;
    const fen = gameStateToFen(chessGame.GameState, { fullmoveNumber });

    const proc = getOrCreateProcess(engine, process.env);
    try {
        const handshakeMs =
            process.env.RENDER === "true" || process.env.UCI_LOW_MEMORY === "1"
                ? 30000
                : 15000;
        await proc.uciHandshake(handshakeMs);
    } catch (err) {
        processesByEngineId.delete(engine);
        try {
            proc.dispose();
        } catch {
            /* ignore */
        }
        throw new Error(
            `UCI engine "${engine}" is not available: ${err && err.message ? err.message : err}`,
        );
    }

    if (abortSignal.aborted) {
        throw new SearchAbortedError();
    }

    const resolvedSkill =
        engine === "stockfish" ? normalizeSkillLevel(skillLevel) : null;
    let bestUci;
    try {
        bestUci = await proc.goMovetime(fen, thinkingTimeMs, {
            abortSignal,
            skillLevel: resolvedSkill,
        });
    } catch (err) {
        if (err && err.name === "SearchAbortedError") {
            throw new SearchAbortedError();
        }
        throw err;
    }

    if (abortSignal.aborted) {
        throw new SearchAbortedError();
    }
    if (!bestUci) {
        return null;
    }

    let parsed;
    try {
        parsed = uciToMove(chessGame.GameState, bestUci);
    } catch (err) {
        console.warn(`[uci] Invalid bestmove "${bestUci}":`, err.message);
        return null;
    }

    const turnBefore = chessGame.Turn;
    const result = chessGame.makeMove(parsed.source, parsed.target);
    if (!result || result.valid === false) {
        console.warn(`[uci] Illegal bestmove from engine: ${bestUci}`);
        return null;
    }

    if (result.promotion) {
        const promo =
            parsed.selectedPiece != null ? parsed.selectedPiece : chessGame.QUEEN;
        result.selectedPiece = promo;
        chessGame.completePromotion(result);
    }

    return {
        source: result.source,
        target: result.target,
        piece: result.piece,
        promotion: !!result.promotion,
        selectedPiece: result.selectedPiece,
        turn: turnBefore,
        opponentMateDetected: forcedLoss.detected,
        opponentMateIn: forcedLoss.detected ? forcedLoss.opponentMateIn : undefined,
    };
}

module.exports = {
    computeMove,
    abortSearch,
    probeAvailability,
    clearAvailabilityCache,
    disposeAll,
    SearchAbortedError,
};
