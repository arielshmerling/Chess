/**
 * In-process brain for desktop (Electron main). Uses ChessGame + brain41/brain42.
 */

const path = require("path");
const { ChessGame } = require("../ChessGame");
const brainConfigService = require("../modules/game/brainConfigService");
const runtime = require("./runtime");
const { syncDesktopPathsForSharedModules } = require("./syncDataPaths");

const ALLOWED_ENGINES = ["brain41", "brain42"];

let openingBookReady = null;

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

function ensureOpeningBookReady(engineName) {
    if (engineName !== "brain42") {
        return Promise.resolve();
    }
    if (openingBookReady) {
        return openingBookReady;
    }
    const brain42 = require("../brain42");
    brain42.preloadOpeningBook();
    openingBookReady = brain42.whenOpeningBookReady().catch((err) => {
        console.error("[desktopBrain] Opening book preload failed:", err);
        openingBookReady = null;
    });
    return openingBookReady;
}

/**
 * @param {{ gameState: object, engine?: string, difficulty?: number }} opts
 * @returns {Promise<object|null>} move object (source/target) for client ChessGame
 */
async function computeMove(opts) {
    ensureRuntime();
    const { gameState, engine = "brain42", difficulty = 3, pliesPlayed } = opts || {};
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
    const maxDepth = Math.min(5, Math.max(1, Number(difficulty) || 3));
    const config = brainConfigService.loadBrainConfig(engine);

    let brainMove;
    try {
        brainMove = await loaded.brainNextMoveFunc(chessGame, {
            maxDepth,
            config,
            pliesPlayed: Number.isFinite(pliesPlayed) ? pliesPlayed : 0,
        });
    } catch (err) {
        if (loaded.BrainTimeoutFallbackError && err instanceof loaded.BrainTimeoutFallbackError) {
            brainMove = err.fallbackMove;
        } else {
            throw err;
        }
    }

    if (!brainMove || brainMove.source == null || brainMove.target == null) {
        return null;
    }

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
    if (engine === "brain42") {
        const brain42 = require("../brain42");
        return brain42.evaluatePositionDisplay(chessGame, {
            config,
            pliesPlayed: Number.isFinite(pliesPlayed) ? pliesPlayed : 0,
        });
    }

    throw new Error(`Evaluation display is not supported for engine "${engine}"`);
}

module.exports = { computeMove, evaluatePosition, ensureRuntime };
