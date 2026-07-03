/**
 * In-process brain for desktop (Electron main). Uses ChessGame + brain41/brain42/brain43.
 */

const path = require("path");
const { ChessGame } = require("../ChessGame");
const brainConfigService = require("../modules/game/brainConfigService");
const {
    thinkingTimeSecondsToMs,
    normalizeThinkingTimeSeconds,
} = brainConfigService;
const runtime = require("./runtime");
const { syncDesktopPathsForSharedModules } = require("./syncDataPaths");
const { isSearchAbortedError } = require("../brainSearchProgress");

const ALLOWED_ENGINES = ["brain41", "brain42", "brain43"];

const openingBookReadyByEngine = {};

function ensureOpeningBookReady(engineName) {
    if (engineName !== "brain42" && engineName !== "brain43") {
        return Promise.resolve();
    }
    if (openingBookReadyByEngine[engineName]) {
        return openingBookReadyByEngine[engineName];
    }
    const brainMod = require(path.join(__dirname, "..", engineName));
    brainMod.preloadOpeningBook();
    openingBookReadyByEngine[engineName] = brainMod.whenOpeningBookReady().catch((err) => {
        console.error(`[desktopBrain] Opening book preload failed (${engineName}):`, err);
        openingBookReadyByEngine[engineName] = null;
    });
    return openingBookReadyByEngine[engineName];
}

function ensureRuntime() {
    syncDesktopPathsForSharedModules();
    if (!runtime.getUserDataRoot()) {
        const userData = process.env.SHMERLING_USER_DATA;
        if (userData) {
            runtime.init({ userDataPath: userData });
        }
    }
}

function loadEngine(engineName) {
    const name = engineName && ALLOWED_ENGINES.includes(engineName) ? engineName : "brain42";
    const mod = require(path.join(__dirname, "..", name));
    return {
        brainNextMoveFunc: mod.brainNextMoveFunc,
        BrainTimeoutFallbackError: mod.BrainTimeoutFallbackError || null,
        name,
    };
}

/**
 * @param {{ gameState: object, engine?: string, thinkingTimeSeconds?: number, difficulty?: number, pliesPlayed?: number }} opts
 * @returns {Promise<object|null>} move object (source/target) for client ChessGame
 */
async function computeMove(opts) {
    ensureRuntime();
    const {
        gameState,
        engine = "brain42",
        thinkingTimeSeconds,
        difficulty,
        pliesPlayed,
        onSearchProgress,
    } = opts || {};
    if (!gameState) {
        throw new Error("Missing game state");
    }

    await ensureOpeningBookReady(engine);

    const chessGame = new ChessGame(true);
    chessGame.loadGame(JSON.stringify(gameState));

    if (chessGame.GameOver) {
        return null;
    }

    const loaded = loadEngine(engine);
    const thinkingTimeMs = thinkingTimeSecondsToMs(
        thinkingTimeSeconds != null ? thinkingTimeSeconds : difficulty,
    );
    const config = brainConfigService.loadBrainConfig(engine);

    let brainMove;
    try {
        brainMove = await loaded.brainNextMoveFunc(chessGame, {
            thinkingTimeMs,
            config,
            pliesPlayed: Number.isFinite(pliesPlayed) ? pliesPlayed : 0,
            onSearchProgress,
        });
    } catch (err) {
        if (isSearchAbortedError(err)) {
            return null;
        }
        if (loaded.BrainTimeoutFallbackError && err instanceof loaded.BrainTimeoutFallbackError) {
            brainMove = err.fallbackMove;
        } else {
            throw err;
        }
    }

    if (!brainMove || brainMove.source == null || brainMove.target == null) {
        return null;
    }

    const scoreLabel =
        brainMove.score != null && Number.isFinite(brainMove.score) ? brainMove.score : "n/a";
    const depthLabel =
        brainMove.searchDepthReached != null ? brainMove.searchDepthReached : "n/a";
    console.log(
        `[desktopBrain] ${loaded.name} selected move score=${scoreLabel} depth=${depthLabel}`,
    );

    const turnBefore = chessGame.Turn;
    const result = chessGame.makeMove(brainMove.source, brainMove.target);
    if (!result || result.valid === false) {
        return null;
    }

    if (result.promotion && result.selectedPiece == null) {
        result.selectedPiece = chessGame.QUEEN;
        chessGame.completePromotion(result);
    }

    return {
        source: result.source,
        target: result.target,
        piece: result.piece,
        promotion: !!result.promotion,
        selectedPiece: result.selectedPiece,
        turn: turnBefore,
        score: brainMove.score,
        searchDepthReached: brainMove.searchDepthReached,
        opponentMateDetected: !!brainMove._opponentMateDetected,
        opponentMateIn: brainMove.opponentMateIn,
    };
}

/**
 * @param {{ gameState: object, engine?: string }} opts
 * @returns {Promise<object>} evaluation breakdown for UI display
 */
async function evaluatePosition(opts) {
    ensureRuntime();
    const { gameState, engine = "brain42", pliesPlayed } = opts || {};
    if (!gameState) {
        throw new Error("Missing game state");
    }

    const chessGame = new ChessGame(true);
    chessGame.loadGame(JSON.stringify(gameState));
    if (typeof chessGame.evaluate === "function") {
        try {
            chessGame.evaluate();
        } catch {
            // Custom setups may be incomplete (e.g. missing kings).
        }
    }

    const config = brainConfigService.loadBrainConfig(engine);
    if (engine === "brain42" || engine === "brain43") {
        const brainMod = require(path.join(__dirname, "..", engine));
        return brainMod.evaluatePositionDisplay(chessGame, {
            config,
            pliesPlayed: Number.isFinite(pliesPlayed) ? pliesPlayed : 0,
        });
    }

    throw new Error(`Evaluation display is not supported for engine "${engine}"`);
}

function abortSearch(reason = "Search aborted") {
    for (const engineName of ALLOWED_ENGINES) {
        try {
            const mod = require(path.join(__dirname, "..", engineName));
            if (typeof mod.cancelActiveSearch === "function") {
                mod.cancelActiveSearch(reason);
            }
        } catch {
            /* ignore */
        }
    }
}

module.exports = {
    computeMove,
    evaluatePosition,
    abortSearch,
    ensureRuntime,
    normalizeThinkingTimeSeconds,
    thinkingTimeSecondsToMs,
};
