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
const {
    setSearchProgressReporter,
    clearSearchProgressReporter,
} = require("../brainSearchProgress");
const { collectLegalMoves } = require("./forcedMateDetection");
const {
    detectForcedLossMateAsync,
    abortForcedMateDetection,
} = require("./forcedMateDetectionAsync");
const {
    isProvenMateLossScore,
    opponentMateInFromLossScore,
} = require("../mateScore");

const ALLOWED_ENGINES = ["brain41", "brain42", "brain43"];

const openingBookReadyByEngine = {};
let searchAbortRequested = false;

class SearchAbortedError extends Error {
    constructor() {
        super("Search aborted");
        this.name = "SearchAbortedError";
    }
}

function isSearchAbortedError(err) {
    return !!(
        err
        && (err.name === "SearchAbortedError" || err.message === "Search aborted")
    );
}

function abortSearch() {
    searchAbortRequested = true;
    abortForcedMateDetection();
    for (let i = 0; i < ALLOWED_ENGINES.length; i++) {
        const engineName = ALLOWED_ENGINES[i];
        try {
            const mod = require(path.join(__dirname, "..", engineName));
            if (typeof mod.abortActiveSearch === "function") {
                mod.abortActiveSearch();
            }
        } catch (err) {
            console.warn(`[desktopBrain] abortActiveSearch failed (${engineName}):`, err.message);
        }
    }
}

function throwIfSearchAborted() {
    if (searchAbortRequested) {
        throw new SearchAbortedError();
    }
}

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
    if (!runtime.isDesktopMode()) {
        return;
    }
    syncDesktopPathsForSharedModules();
    if (!runtime.getUserDataRoot()) {
        const userData = process.env.SHMERLING_USER_DATA;
        if (userData) {
            runtime.init({ userDataPath: userData });
        }
    }
}

function loadEngine(engineName) {
    const name = engineName && ALLOWED_ENGINES.includes(engineName) ? engineName : "brain43";
    const mod = require(path.join(__dirname, "..", name));
    return {
        brainNextMoveFunc: mod.brainNextMoveFunc,
        BrainTimeoutFallbackError: mod.BrainTimeoutFallbackError || null,
        name,
    };
}

/** IPC sends GameState only; restore move SANs so line-book prefix lookup works. */
function normalizeMovesForBook(moves) {
    if (!Array.isArray(moves)) {
        return [];
    }
    const out = [];
    for (let i = 0; i < moves.length; i++) {
        const raw = moves[i];
        let move = raw;
        if (typeof raw === "string") {
            try {
                move = JSON.parse(raw);
            } catch {
                move = { moveStr: raw };
            }
        }
        const moveStr = move && typeof move.moveStr === "string" ? move.moveStr.trim() : "";
        if (moveStr) {
            out.push({ ...move, moveStr });
        }
    }
    return out;
}

/**
 * @param {{ gameState: object, engine?: string, thinkingTimeSeconds?: number, difficulty?: number, pliesPlayed?: number, immediateResign?: boolean }} opts
 * @param {(progress: object) => void} [onProgress]
 * @returns {Promise<object|null>} move object (source/target) for client ChessGame
 */
async function computeMove(opts, onProgress) {
    ensureRuntime();
    searchAbortRequested = false;
    const {
        gameState,
        moves,
        engine = "brain43",
        thinkingTimeSeconds,
        difficulty,
        pliesPlayed,
        immediateResign,
    } = opts || {};
    if (!gameState) {
        throw new Error("Missing game state");
    }

    await ensureOpeningBookReady(engine);

    const chessGame = new ChessGame(true);
    chessGame.loadGame(JSON.stringify(gameState));
    const bookMoves = normalizeMovesForBook(moves);
    if (bookMoves.length > 0) {
        chessGame.loadMoves(bookMoves);
    }

    if (chessGame.GameOver) {
        return null;
    }

    throwIfSearchAborted();

    const forcedLoss = await detectForcedLossMateAsync(chessGame);
    throwIfSearchAborted();
    if (forcedLoss.detected && immediateResign === true) {
        const turnBefore = chessGame.Turn;
        const escapeMoves = collectLegalMoves(chessGame);
        const firstMove = escapeMoves.length > 0 ? escapeMoves[0] : null;
        console.log(
            `[desktopBrain] Forced loss detected; opponent mate in ${forcedLoss.opponentMateIn ?? "?"}`,
        );
        return {
            opponentMateDetected: true,
            opponentMateIn: forcedLoss.opponentMateIn,
            source: firstMove ? firstMove.source : null,
            target: firstMove ? firstMove.target : null,
            turn: turnBefore,
        };
    }

    const loaded = loadEngine(engine);
    const thinkingTimeMs = thinkingTimeSecondsToMs(
        thinkingTimeSeconds != null ? thinkingTimeSeconds : difficulty,
    );
    const config = brainConfigService.loadBrainConfig(engine);

    let brainMove;
    setSearchProgressReporter((progress) => {
        if (progress && progress.message) {
            console.log(progress.message);
        }
        if (typeof onProgress === "function") {
            onProgress(progress);
        }
    });
    try {
        brainMove = await loaded.brainNextMoveFunc(chessGame, {
            thinkingTimeMs,
            config,
            pliesPlayed: Number.isFinite(pliesPlayed) ? pliesPlayed : 0,
        });
        throwIfSearchAborted();
    } catch (err) {
        if (isSearchAbortedError(err)) {
            throw new SearchAbortedError();
        }
        if (loaded.BrainTimeoutFallbackError && err instanceof loaded.BrainTimeoutFallbackError) {
            brainMove = err.fallbackMove;
        } else {
            throw err;
        }
    } finally {
        clearSearchProgressReporter();
    }

    throwIfSearchAborted();

    if (!brainMove || brainMove.source == null || brainMove.target == null) {
        return null;
    }

    if (immediateResign === true && isProvenMateLossScore(brainMove.score)) {
        const turnBefore = chessGame.Turn;
        const opponentMateIn = opponentMateInFromLossScore(brainMove.score);
        console.log(
            `[desktopBrain] Search proved forced loss; opponent mate in ${opponentMateIn ?? "?"}`,
        );
        return {
            opponentMateDetected: true,
            opponentMateIn,
            source: brainMove.source,
            target: brainMove.target,
            turn: turnBefore,
        };
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
        opponentMateDetected: forcedLoss.detected,
        opponentMateIn: forcedLoss.detected ? forcedLoss.opponentMateIn : undefined,
    };
}

/**
 * @param {{ gameState: object, engine?: string }} opts
 * @returns {Promise<object>} evaluation breakdown for UI display
 */
async function evaluatePosition(opts) {
    ensureRuntime();
    const { gameState, engine = "brain43", pliesPlayed } = opts || {};
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

module.exports = {
    computeMove,
    evaluatePosition,
    abortSearch,
    SearchAbortedError,
    ensureRuntime,
    normalizeThinkingTimeSeconds,
    thinkingTimeSecondsToMs,
    normalizeMovesForBook,
};
