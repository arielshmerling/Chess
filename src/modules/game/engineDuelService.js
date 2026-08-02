/**
 * Create and run admin engine-vs-engine duels (server-side moves via engineService).
 */

"use strict";

const { Player } = require("./Player");
const { EngineDuelGame } = require("./EngineDuelGame");
const gamesManagerService = require("../gamesManager/service");
const engineService = require("../../engines/engineService");
const registry = require("../../engines/registry");

const MAX_PLIES = 600;
const INTER_MOVE_DELAY_MS = 250;

/** @type {Map<string, EngineDuelGame>} */
const runningById = new Map();

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function engineLabel(id) {
    const def = registry.getEngine(id);
    return (def && def.fallbackLabel) || id;
}

/**
 * @param {object} opts
 * @param {string} opts.adminUsername
 * @param {string} opts.adminUserId
 * @param {string} opts.whiteEngine
 * @param {string} opts.blackEngine
 * @param {number} [opts.whiteDifficulty]
 * @param {number} [opts.blackDifficulty]
 * @param {number} [opts.whiteSkillLevel]
 * @param {number} [opts.blackSkillLevel]
 * @param {number} [opts.timeMinutes]
 * @param {(game: object, meta: object) => void} broadcastLobby
 * @param {(game: object) => void} registerEvents
 */
async function createAndStartEngineDuel(opts, broadcastLobby, registerEvents) {
    const whiteEngine = String(opts.whiteEngine || "").trim();
    const blackEngine = String(opts.blackEngine || "").trim();
    if (!registry.getEngine(whiteEngine) || !registry.listPlayEngines().some((e) => e.id === whiteEngine)) {
        const err = new Error(`Unknown or disabled white engine: ${whiteEngine}`);
        err.code = "INVALID_ENGINE";
        throw err;
    }
    if (!registry.getEngine(blackEngine) || !registry.listPlayEngines().some((e) => e.id === blackEngine)) {
        const err = new Error(`Unknown or disabled black engine: ${blackEngine}`);
        err.code = "INVALID_ENGINE";
        throw err;
    }
    const whiteResolved = await engineService.resolveEnabledPlayEngine(whiteEngine);
    const blackResolved = await engineService.resolveEnabledPlayEngine(blackEngine);
    if (whiteResolved !== whiteEngine) {
        const err = new Error(`White engine "${whiteEngine}" is disabled or unavailable`);
        err.code = "ENGINE_DISABLED";
        throw err;
    }
    if (blackResolved !== blackEngine) {
        const err = new Error(`Black engine "${blackEngine}" is disabled or unavailable`);
        err.code = "ENGINE_DISABLED";
        throw err;
    }

    function clampDifficulty(raw) {
        const n = Number(raw);
        return Number.isInteger(n) && n >= 1 && n <= 6 ? n : 3;
    }
    /** @returns {number|null} */
    function clampSkillLevel(raw, engineId) {
        if (engineId !== "stockfish") {
            return null;
        }
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 20) {
            return 20;
        }
        return n;
    }
    const whiteDifficulty = clampDifficulty(opts.whiteDifficulty);
    const blackDifficulty = clampDifficulty(opts.blackDifficulty);
    const whiteSkillLevel = clampSkillLevel(opts.whiteSkillLevel, whiteEngine);
    const blackSkillLevel = clampSkillLevel(opts.blackSkillLevel, blackEngine);
    const timeMinutesRaw = Number(opts.timeMinutes);
    const timeMinutes =
        Number.isFinite(timeMinutesRaw) && timeMinutesRaw >= 1 && timeMinutesRaw <= 180
            ? Math.round(timeMinutesRaw)
            : 90;

    const adminPlayer = new Player(opts.adminUserId, opts.adminUsername);
    const gameInfo = {
        gameType: "EngineDuelGame",
        isPrivate: false,
        options: {
            engineDuel: true,
            whiteEngine,
            blackEngine,
            whiteLabel: engineLabel(whiteEngine),
            blackLabel: engineLabel(blackEngine),
            whiteDifficulty,
            blackDifficulty,
            whiteSkillLevel,
            blackSkillLevel,
            difficulty: whiteDifficulty,
            timeMinutes,
            mouse: "drag",
            showAvailableMoves: true,
            clientEngine: false,
        },
    };
    const game = new EngineDuelGame(gameInfo, adminPlayer, "play");
    game.chessGame.GameTimeLength = timeMinutes * 60;

    gamesManagerService.AddGame(game);
    const gameDoc = await gamesManagerService.storeGameInDB(game);
    game.gameId = gameDoc.id;
    registerEvents(game);
    game.startDuelBoard();

    const startedOn = game.createOn ? new Date(game.createOn).getTime() : Date.now();
    const whiteName = game.whitePlayer.userName;
    const blackName = game.blackPlayer.userName;
    if (typeof broadcastLobby === "function") {
        broadcastLobby(game, {
            whiteName,
            blackName,
            startedOn,
        });
    }

    const gameId = String(game.gameId);
    runningById.set(gameId, game);
    void runDuelLoop(game).finally(() => {
        runningById.delete(gameId);
    });

    return { game, gameId };
}

async function runDuelLoop(game) {
    game._duelRunning = true;
    try {
        while (
            game
            && game.chessGame
            && !game.chessGame.GameOver
            && game.status === "in progress"
            && !game.isAbortRequested()
            && (game.moves || []).length < MAX_PLIES
        ) {
            const turn = game.chessGame.Turn;
            const isWhite = turn === "white";
            const engineId = isWhite ? game.options.whiteEngine : game.options.blackEngine;
            const sideDifficulty = isWhite
                ? (game.options.whiteDifficulty != null ? game.options.whiteDifficulty : game.options.difficulty)
                : (game.options.blackDifficulty != null ? game.options.blackDifficulty : game.options.difficulty);
            const sideSkillLevel = isWhite
                ? game.options.whiteSkillLevel
                : game.options.blackSkillLevel;
            let brainMove;
            try {
                const historyMoves =
                    game.chessGame && Array.isArray(game.chessGame.Moves) && game.chessGame.Moves.length > 0
                        ? game.chessGame.Moves
                        : (game.moves || []);
                const computeOpts = {
                    engine: engineId,
                    gameState: game.chessGame.GameState,
                    /* Line book (brain42/43) needs SAN history — same as Play client. */
                    moves: historyMoves,
                    difficulty: sideDifficulty,
                    thinkingTimeSeconds: sideDifficulty,
                    pliesPlayed: historyMoves.length,
                };
                if (engineId === "stockfish" && sideSkillLevel != null) {
                    computeOpts.skillLevel = sideSkillLevel;
                }
                brainMove = await engineService.computeMove(computeOpts);
            } catch (err) {
                console.error("[engineDuel] computeMove failed:", err && err.message ? err.message : err);
                game.status = "game over";
                if (game.raiseEvent) {
                    await game.raiseEvent(game.OnGameOver, {
                        game,
                        reason: `Engine error (${engineId}): ${err && err.message ? err.message : "failed"}`,
                    });
                }
                break;
            }
            if (game.isAbortRequested()) {
                break;
            }
            if (!brainMove || !brainMove.source || !brainMove.target) {
                console.warn("[engineDuel] empty move from", engineId);
                break;
            }
            const applied = await game.handleMove(isWhite, brainMove, "brain");
            if (!applied || applied.valid === false) {
                console.warn("[engineDuel] handleMove rejected move from", engineId);
                break;
            }
            game.sendMoveToWatchers(game.gameId, isWhite, applied);
            if (game.chessGame.GameOver) {
                break;
            }
            await delay(INTER_MOVE_DELAY_MS);
        }
        if (game.isAbortRequested() && game.status === "in progress") {
            game.status = "cancelled";
            if (game.raiseEvent) {
                await game.raiseEvent(game.OnGameStateChanged, { game, newState: game.status });
            }
            if (game.raiseEvent && game.OnGameOver) {
                await game.raiseEvent(game.OnGameOver, { game, reason: "Admin stopped the duel" });
            }
        }
    } catch (err) {
        console.error("[engineDuel] run loop error:", err);
    } finally {
        game._duelRunning = false;
        try {
            engineService.abortSearch();
        } catch (e) {
            /* ignore */
        }
    }
}

async function stopEngineDuel(gameId) {
    const id = String(gameId || "");
    let game = runningById.get(id);
    if (!game && typeof gamesManagerService.getGameById === "function") {
        game = gamesManagerService.getGameById(id);
    }
    if (!game || game.constructor.name !== "EngineDuelGame") {
        return { ok: false, message: "No running engine duel with that id" };
    }
    game.requestAbort();
    try {
        engineService.abortSearch();
    } catch (e) {
        /* ignore */
    }
    return { ok: true, gameId: id };
}

function listRunningDuels() {
    return [...runningById.keys()];
}

module.exports = {
    createAndStartEngineDuel,
    stopEngineDuel,
    listRunningDuels,
    engineLabel,
};
