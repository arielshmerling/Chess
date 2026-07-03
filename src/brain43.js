/**
 * Brain 4.3 — same evaluation and search as Brain 4.2, with parallel root-move search
 * across a small worker pool (up to 4 threads) inside the search worker.
 */
const { Worker, isMainThread, parentPort } = require("worker_threads");
const {
    setWorkerSearchRequestId,
    emitSearchProgress,
    dispatchWorkerProgressMessage,
    handleWorkerAbortMessage,
    cancelWorkerSearch,
    SearchAbortedError,
} = require("./brainSearchProgress");
const {
    LARGE_MATE_SCORE: MATE_SCORE,
    LARGE_MATE_THRESHOLD: MATE_SCORE_WIN_THRESHOLD,
    largeIsWinningMateScore: isWinningMateScore,
    largeIsLosingMateScore: isLosingMateScore,
    largeMatePliesFromScore: losingMatePliesFromScore,
    tagOpponentMateOnMove,
} = require("./brainMateScore");
const path = require("path");
const ROOT_EVAL_WORKER_SCRIPT = path.join(__dirname, "brain43RootEvalWorker.js");
const { ChessGame } = require("./ChessGame");
const {
    getDefaultConfig,
    sanitizeBrainConfig,
    MAX_SEARCH_DEPTH,
} = require("./modules/game/brainConfigService");
const {
    beginTimedSearch,
    endTimedSearch,
    shouldStopSearch,
    getRemainingSearchMs,
    getSearchDeadlineMs,
    syncSearchDeadline,
    estimateMinMsForNextDepth,
    clearSearchAbort,
} = require("./brainSearchTime");
const { createRootWorkerPool, MAX_ROOT_WORKERS } = require("./brain43RootPool");
const { loadOpeningBookEntries } = require("./openingBookLoader");
const {
    savedGameStateToCanonicalLookupKey,
    transformBookMovesToGame,
} = require("./openingBookJson");

const DEFAULT_MAX_DEPTH = 2;
const LOG_PREFIX = "[Brain4.3]";
/** Worker safety timeout when search uses fixed depth (tests). */
const BRAIN_MOVE_TIMEOUT_MS = 4 * 60 * 1000;
/** Extra ms beyond user thinking time before main thread abandons the worker request. */
const THINKING_TIME_SAFETY_BUFFER_MS = 400;
/** Do not start another iterative-deepening ply below this remaining budget. */
const MIN_MS_FOR_NEXT_DEPTH = 50;
/**
 * Safety ceiling for time-limited iterative deepening. The search is bounded by the clock, not
 * by depth; this only prevents a runaway loop in trivial/forced positions (e.g. lone-king endgames).
 */
const MAX_TIMED_SEARCH_DEPTH = 64;

let brain43FullConfig = getDefaultConfig("brain43");
/** Plies already played before the current search root (worker loadGame clears Moves). */
let brain43RootPliesPlayed = 0;
let runtimeConfig = { pieceScores: {}, specialEvaluations: {} };
/** @type {ReturnType<typeof createRootWorkerPool>|null} */
let rootWorkerPool = null;
let rootEvalRequestCounter = 0;

function getRootWorkerPool() {
    if (!isMainThread) {
        return null;
    }
    if (!rootWorkerPool) {
        rootWorkerPool = createRootWorkerPool(ROOT_EVAL_WORKER_SCRIPT);
        console.log(`${LOG_PREFIX} Root worker pool: ${rootWorkerPool.maxWorkers} thread(s)`);
    }
    return rootWorkerPool;
}

function shutdownRootWorkerPool() {
    if (rootWorkerPool) {
        rootWorkerPool.terminate();
        rootWorkerPool = null;
    }
}

function countPiecesForColor(game, color) {
    const state = game && game.GameState;
    if (!state?.board) {
        return 0;
    }
    let count = 0;
    for (let row = 0; row < game.BOARD_ROWS; row++) {
        const boardRow = state.board[row];
        if (!boardRow) {
            continue;
        }
        for (let col = 0; col < game.BOARD_COLUMNS; col++) {
            const piece = boardRow[col];
            if (piece && piece.color === color) {
                count += 1;
            }
        }
    }
    return count;
}

function countTotalPiecesOnBoard(game) {
    return countPiecesForColor(game, "white") + countPiecesForColor(game, "black");
}

function detectBrain43Phase(fullConfig, game, pliesPlayed) {
    const gp = (fullConfig && fullConfig.gamePhase) || {};
    const endMax = Number.isFinite(gp.endGameOpponentMaxPieces) ? gp.endGameOpponentMaxPieces : 8;
    const midAfter = Number.isFinite(gp.midGameAfterMoves) ? gp.midGameAfterMoves : 10;
    const plies = Number.isFinite(pliesPlayed) ? Math.max(0, Math.floor(pliesPlayed)) : 0;

    if (game && game.GameState?.board) {
        const opponent = opponentColor(game.Turn);
        const oppPieces = countPiecesForColor(game, opponent);
        const totalPieces =
            countPiecesForColor(game, "white") + countPiecesForColor(game, "black");
        if (totalPieces > 0 && oppPieces <= endMax) {
            return "endGame";
        }
    }

    if (Math.floor(plies / 2) >= midAfter) {
        return "midGame";
    }
    return "startGame";
}

function resolveBrain43ActivePhaseSettings(fullConfig, game, pliesPlayed) {
    const phase = detectBrain43Phase(fullConfig, game, pliesPlayed);
    const phaseSettings = (fullConfig && fullConfig[phase]) || (fullConfig && fullConfig.startGame) || {};
    return {
        phase,
        pieceScores: phaseSettings.pieceScores || {},
        specialEvaluations: phaseSettings.specialEvaluations || {},
        pawnFileValues: (fullConfig && fullConfig.pawnFileValues) || null,
    };
}

function clampSearchDepth(depth, cap = MAX_SEARCH_DEPTH) {
    return Math.min(cap, Math.max(1, Math.floor(Number(depth) || DEFAULT_MAX_DEPTH)));
}

function resolveAdaptiveDepthSettings(fullConfig) {
    const defaults = getDefaultConfig("brain43").adaptiveDepth;
    const input = fullConfig && fullConfig.adaptiveDepth;
    if (!input || typeof input !== "object") {
        return defaults;
    }
    const ref = Number(input.referenceRootMoves ?? defaults.referenceRootMoves);
    const avg = Number(input.avgBranchingFactor ?? defaults.avgBranchingFactor);
    const minD = Number(input.minSearchDepth ?? defaults.minSearchDepth);
    const maxD = Number(input.maxSearchDepth ?? defaults.maxSearchDepth);
    const fullBelow = Number(input.fullAdaptiveBelowTotalPieces ?? defaults.fullAdaptiveBelowTotalPieces);
    const noneAbove = Number(input.noAdaptiveAboveTotalPieces ?? defaults.noAdaptiveAboveTotalPieces);
    const enabled = input.enabled !== undefined ? Boolean(input.enabled) : defaults.enabled !== false;
    return {
        enabled,
        referenceRootMoves: Number.isFinite(ref) && ref > 0 ? ref : defaults.referenceRootMoves,
        avgBranchingFactor: Number.isFinite(avg) && avg > 1 ? avg : defaults.avgBranchingFactor,
        minSearchDepth: Number.isFinite(minD) && minD >= 1 ? Math.min(MAX_SEARCH_DEPTH, Math.floor(minD)) : defaults.minSearchDepth,
        maxSearchDepth: Number.isFinite(maxD) && maxD >= 1 ? Math.min(MAX_SEARCH_DEPTH, Math.floor(maxD)) : defaults.maxSearchDepth,
        fullAdaptiveBelowTotalPieces:
            Number.isFinite(fullBelow) && fullBelow > 0
                ? Math.floor(fullBelow)
                : defaults.fullAdaptiveBelowTotalPieces,
        noAdaptiveAboveTotalPieces:
            Number.isFinite(noneAbove) && noneAbove > 0
                ? Math.floor(noneAbove)
                : defaults.noAdaptiveAboveTotalPieces,
    };
}

/**
 * 0 = no depth increase from sparse root moves (full board); 1 = full increase (endgame piece count).
 * @param {number|null|undefined} totalPieces
 * @param {object} settings
 * @returns {number}
 */
function computeAdaptivePieceScale(totalPieces, settings) {
    if (totalPieces == null || !Number.isFinite(Number(totalPieces))) {
        return 1;
    }
    const pieces = Math.max(0, Math.floor(Number(totalPieces)));
    const fullBelow = settings.fullAdaptiveBelowTotalPieces;
    const noneAbove = settings.noAdaptiveAboveTotalPieces;
    if (noneAbove <= fullBelow) {
        return pieces <= fullBelow ? 1 : 0;
    }
    if (pieces <= fullBelow) {
        return 1;
    }
    if (pieces >= noneAbove) {
        return 0;
    }
    return (noneAbove - pieces) / (noneAbove - fullBelow);
}

/**
 * Worst-case leaf evaluation estimate (no alpha-beta pruning): rootMoves × avgBranch^(depth−1).
 * @param {number} rootMoveCount
 * @param {number} maxDepth
 * @param {object} [fullConfig]
 * @returns {number}
 */
function estimateLeafEvaluations(rootMoveCount, maxDepth, fullConfig) {
    const settings = resolveAdaptiveDepthSettings(fullConfig || brain43FullConfig);
    const depth = clampSearchDepth(maxDepth);
    const rootMoves = Math.max(0, Math.floor(Number(rootMoveCount) || 0));
    if (rootMoves === 0 || depth <= 0) {
        return 0;
    }
    const depthAfterRoot = Math.max(0, depth - 1);
    return rootMoves * Math.pow(settings.avgBranchingFactor, depthAfterRoot);
}

/**
 * Adjust base maxDepth from root legal-move count and total pieces on the board.
 * @param {number} baseMaxDepth
 * @param {number} rootMoveCount
 * @param {number|null|undefined|object} [totalPiecesOrConfig] piece count, or legacy fullConfig as 3rd arg
 * @param {object} [maybeConfig]
 * @returns {number}
 */
function computeAdaptiveSearchDepth(baseMaxDepth, rootMoveCount, totalPiecesOrConfig, maybeConfig) {
    const base = clampSearchDepth(baseMaxDepth);
    let totalPieces = null;
    let fullConfig = brain43FullConfig;
    if (
        totalPiecesOrConfig != null
        && typeof totalPiecesOrConfig === "object"
        && !Number.isFinite(Number(totalPiecesOrConfig))
    ) {
        fullConfig = totalPiecesOrConfig;
    } else {
        totalPieces = totalPiecesOrConfig;
        if (maybeConfig && typeof maybeConfig === "object") {
            fullConfig = maybeConfig;
        }
    }

    const settings = resolveAdaptiveDepthSettings(fullConfig || brain43FullConfig);
    const rootMoves = Math.max(0, Math.floor(Number(rootMoveCount) || 0));
    if (!settings.enabled || rootMoves <= 0) {
        return base;
    }

    const ref = settings.referenceRootMoves;
    if (rootMoves >= ref) {
        const shrink = Math.floor(Math.log(rootMoves / ref) / Math.log(2));
        if (shrink <= 0) {
            return base;
        }
        return Math.min(settings.maxSearchDepth, Math.max(settings.minSearchDepth, base - shrink));
    }

    const bonus = Math.round(Math.log(ref / rootMoves) / Math.log(2));
    if (bonus <= 0) {
        return base;
    }

    const targetDepth = Math.min(
        settings.maxSearchDepth,
        Math.max(settings.minSearchDepth, base + bonus),
    );
    if (targetDepth <= base) {
        return base;
    }

    const pieceScale = computeAdaptivePieceScale(totalPieces, settings);
    if (pieceScale >= 1) {
        return targetDepth;
    }
    if (pieceScale <= 0) {
        return base;
    }

    const scaledBonus = Math.round((targetDepth - base) * pieceScale);
    if (scaledBonus <= 0) {
        return base;
    }
    return Math.min(settings.maxSearchDepth, Math.max(settings.minSearchDepth, base + scaledBonus));
}

function setBrain43SearchContext(fullConfig, rootPliesPlayed) {
    brain43FullConfig = sanitizeBrainConfig("brain43", fullConfig || {});
    brain43RootPliesPlayed = Number.isFinite(rootPliesPlayed)
        ? Math.max(0, Math.floor(rootPliesPlayed))
        : 0;
}

function currentSearchPliesPlayed(game) {
    return brain43RootPliesPlayed + (game && game.Moves ? game.Moves.length : 0);
}

/** Applies pieceScores / specialEvaluations for the active game phase on runtimeConfig. */
function applyRuntimeConfigForGame(game) {
    const pliesPlayed = currentSearchPliesPlayed(game);
    const active = resolveBrain43ActivePhaseSettings(brain43FullConfig, game, pliesPlayed);
    runtimeConfig = {
        pieceScores: active.pieceScores,
        specialEvaluations: active.specialEvaluations,
        pawnFileValues: active.pawnFileValues,
        pawnFileTableKey: active.phase === "endGame" ? "endGame" : "openingMidGame",
    };
    return active.phase;
}

(function initBrain42RuntimeConfig() {
    const active = resolveBrain43ActivePhaseSettings(brain43FullConfig, null, 0);
    runtimeConfig = {
        pieceScores: active.pieceScores,
        specialEvaluations: active.specialEvaluations,
        pawnFileValues: active.pawnFileValues,
        pawnFileTableKey: "openingMidGame",
    };
})();

/** @type {Map<string, object[]>|null} compact state lookup key → book moves */
let openingBookByStateKey = null;
/** @type {Promise<Map<string, object[]>>|null} */
let openingBookLoadPromise = null;

function bookMovesEqual(a, b) {
    return a
        && b
        && a.source
        && b.source
        && a.target
        && b.target
        && a.source.row === b.source.row
        && a.source.col === b.source.col
        && a.target.row === b.target.row
        && a.target.col === b.target.col;
}

function addOpeningBookEntry(map, stateKey, move, weight) {
    if (typeof stateKey !== "string" || !stateKey || !move) {
        return;
    }
    const w = Number.isFinite(weight) && weight > 0 ? Math.floor(weight) : 1;
    let list = map.get(stateKey);
    if (!list) {
        list = [];
        map.set(stateKey, list);
    }
    const existing = list.find((m) => bookMovesEqual(m, move));
    if (existing) {
        existing.weight = (existing.weight || 1) + w;
        if (!existing.pgn && move.pgn) {
            existing.pgn = move.pgn;
        }
    } else {
        list.push({
            source: { row: move.source.row, col: move.source.col },
            target: { row: move.target.row, col: move.target.col },
            pgn: move.pgn,
            weight: w,
        });
    }
}

function beginOpeningBookLoad() {
    if (openingBookByStateKey) {
        return Promise.resolve(openingBookByStateKey);
    }
    if (!openingBookLoadPromise) {
        openingBookLoadPromise = loadOpeningBookEntries()
            .then((entries) => {
                const map = new Map();
                for (const e of entries) {
                    if (!e.state || !e.move) {
                        continue;
                    }
                    addOpeningBookEntry(map, e.state, e.move, e.weight);
                }
                openingBookByStateKey = map;
                const distinctLists = new Set(map.values());
                console.log(
                    `${LOG_PREFIX} Opening book: ${entries.length} entries, ${distinctLists.size} distinct positions`,
                );
                return map;
            })
            .catch((err) => {
                console.error(`${LOG_PREFIX} Opening book load failed:`, err.message || err);
                openingBookByStateKey = new Map();
                return openingBookByStateKey;
            });
    }
    return openingBookLoadPromise;
}

/** Start loading the opening book in the background (idempotent). */
exports.preloadOpeningBook = function preloadOpeningBook() {
    beginOpeningBookLoad();
};

/** Resolves when the opening book is loaded (starts load if needed). */
exports.whenOpeningBookReady = function whenOpeningBookReady() {
    return beginOpeningBookLoad();
};

/** Counts {@link evaluateLeafPosition} invocations per search; reset before each request. */
let leafEvaluationsThisSearch = 0;

exports.Name = "Brain 4.3";

class BrainTimeoutFallbackError extends Error {
    constructor(move) {
        super("Brain move timeout - using fallback move");
        this.name = "BrainTimeoutFallbackError";
        this.fallbackMove = move;
    }
}

let persistentWorker = null;
let requestIdCounter = 0;
const pendingRequests = new Map();

function getOrCreateWorker() {
    if (!isMainThread) {
        throw new Error("getOrCreateWorker called from worker thread");
    }
    if (!persistentWorker) {
        console.log(`${LOG_PREFIX} Creating persistent worker thread...`);
        persistentWorker = new Worker(__filename);

        persistentWorker.on("message", (response) => {
            if (dispatchWorkerProgressMessage(response, pendingRequests)) {
                return;
            }
            const { requestId, move, error } = response;
            const pending = pendingRequests.get(requestId);
            if (pending) {
                pendingRequests.delete(requestId);
                clearTimeout(pending.timeout);
                if (error) {
                    pending.reject(new Error(error));
                } else if (move) {
                    pending.resolve(move);
                } else {
                    pending.reject(new Error("Worker returned null move"));
                }
            }
        });

        persistentWorker.on("error", (err) => {
            console.error(`${LOG_PREFIX} Persistent worker thread error:`, err);
            for (const [, pending] of pendingRequests.entries()) {
                clearTimeout(pending.timeout);
                pending.reject(err);
            }
            pendingRequests.clear();
            persistentWorker = null;
        });

        persistentWorker.on("exit", (code) => {
            if (code !== 0) {
                console.error(`${LOG_PREFIX} Persistent worker thread exited with code ${code}`);
            }
            for (const [, pending] of pendingRequests.entries()) {
                clearTimeout(pending.timeout);
                pending.reject(new Error(`Worker thread exited with code ${code}`));
            }
            pendingRequests.clear();
            persistentWorker = null;
        });
    }
    return persistentWorker;
}

function terminatePersistentWorker(reason) {
    if (!persistentWorker) {
        return;
    }
    console.warn(`${LOG_PREFIX} Terminating worker: ${reason}`);
    const worker = persistentWorker;
    persistentWorker = null;
    for (const [, pending] of pendingRequests.entries()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error(reason || "Worker terminated"));
    }
    pendingRequests.clear();
    worker.terminate();
}

function cancelActiveSearch(reason = "Search aborted") {
    if (!isMainThread) {
        return;
    }
    cancelWorkerSearch(persistentWorker, pendingRequests, reason);
    shutdownRootWorkerPool();
}

function createWorkerPromise(strState, searchOptions) {
    return new Promise((resolve, reject) => {
        if (!isMainThread) {
            reject(new Error("createWorkerPromise called from worker thread"));
            return;
        }
        clearSearchAbort();
        const requestId = ++requestIdCounter;
        const worker = getOrCreateWorker();
        const thinkingTimeMs = searchOptions?.thinkingTimeMs;
        const maxDepth = searchOptions?.maxDepth;
        const config = searchOptions?.config;
        const pliesPlayed = searchOptions?.pliesPlayed;
        const timeoutMs = thinkingTimeMs != null && Number(thinkingTimeMs) > 0
            ? Math.max(1000, Math.floor(Number(thinkingTimeMs)) + THINKING_TIME_SAFETY_BUFFER_MS)
            : BRAIN_MOVE_TIMEOUT_MS;

        const timeout = setTimeout(() => {
            const pending = pendingRequests.get(requestId);
            if (pending) {
                pendingRequests.delete(requestId);
                console.error(`${LOG_PREFIX} move timeout for request ${requestId} after ${timeoutMs}ms`);
                terminatePersistentWorker("Brain move timeout");
                reject(new Error("Brain move timeout"));
            }
        }, timeoutMs);

        pendingRequests.set(requestId, {
            resolve,
            reject,
            timeout,
            onProgress: searchOptions?.onSearchProgress,
        });
        const label = thinkingTimeMs != null && Number(thinkingTimeMs) > 0
            ? `time ${thinkingTimeMs}ms`
            : `depth ${maxDepth != null ? maxDepth : DEFAULT_MAX_DEPTH}`;
        console.log(`${LOG_PREFIX} Sending request ${requestId} (${label})`);
        worker.postMessage({
            requestId,
            gameState: strState,
            thinkingTimeMs,
            maxDepth,
            config,
            pliesPlayed,
        });
    });
}

function isBookMoveStillLegal(game, move) {
    if (!move || move.source == null || move.target == null) {
        return false;
    }
    if (
        typeof move.source.row !== "number"
        || typeof move.source.col !== "number"
        || typeof move.target.row !== "number"
        || typeof move.target.col !== "number"
    ) {
        return false;
    }
    return !!game.validateMove(move.source, move.target, game.Turn).valid;
}

function formatStateForLog(stateKey) {
    return stateKey;
}

function bookMovePgn(game, bookMove) {
    if (bookMove && typeof bookMove.pgn === "string" && bookMove.pgn) {
        return bookMove.pgn;
    }
    try {
        return game.getSimpleNotation(bookMove);
    } catch {
        if (bookMove && bookMove.source && bookMove.target) {
            return `[${bookMove.source.row},${bookMove.source.col}]→[${bookMove.target.row},${bookMove.target.col}]`;
        }
        return "?";
    }
}

function logOpeningBookOptions(game, options) {
    const pgns = options.map((m) => {
        const w = m.weight || 1;
        return `${bookMovePgn(game, m)} (${w})`;
    });
    console.log(`${LOG_PREFIX} Opening book options: ${pgns.join(", ")}`);
}

function logTiedBestMoveOptions(game, options, bestScore) {
    const pgns = options.map((m) => bookMovePgn(game, m));
    console.log(
        `${LOG_PREFIX} Equal best score ${bestScore}; ${options.length} tied move(s): ${pgns.join(", ")}`,
    );
}

function pickWeightedBookMove(options) {
    if (options.length === 0) {
        return null;
    }
    let total = 0;
    for (let i = 0; i < options.length; i++) {
        total += options[i].weight || 1;
    }
    let r = Math.random() * total;
    for (let i = 0; i < options.length; i++) {
        r -= options[i].weight || 1;
        if (r <= 0) {
            return options[i];
        }
    }
    return options[options.length - 1];
}

function tryFindMatchState(game) {
    const { lookupKey: stateKey, flipMoves } = savedGameStateToCanonicalLookupKey(game.SavedGameState);

    if (!openingBookByStateKey) {
        console.log(
            `${LOG_PREFIX} Opening book search (book not loaded): turn=${game.Turn}\n${(stateKey)}`,
        );
        return null;
    }

    const bookOptions = openingBookByStateKey.get(stateKey) || [];
    const options = transformBookMovesToGame(bookOptions, flipMoves);
    console.log(
        `${LOG_PREFIX} Opening book search: turn=${game.Turn},`
            + ` bookPositions=${openingBookByStateKey.size},`
            + ` movesAtPosition=${options.length}`
            + (flipMoves ? " (view flipped)" : "")
            + `\n${(stateKey)}`,
    );

    if (options.length === 0) {
        console.log(`${LOG_PREFIX} Opening book miss: no entry for this state key (turn=${game.Turn})`);
        return null;
    }

    logOpeningBookOptions(game, options);

    const legal = options.filter((m) => isBookMoveStillLegal(game, m));
    if (legal.length === 0) {
        console.warn(
            `${LOG_PREFIX} Opening book: ${options.length} stored move(s) but none legal at this position`,
        );
        return null;
    }

    const pick = pickWeightedBookMove(legal);
    console.log(
        `${LOG_PREFIX} Opening book pick: ${bookMovePgn(game, pick)}`
            + ` (weight ${pick.weight || 1}, ${legal.length} legal option(s))`,
    );
    return pick;
}

async function runBrain43SearchLocal(game, searchOptions) {
    const thinkingTimeMs = searchOptions?.thinkingTimeMs;
    const maxDepth = searchOptions?.maxDepth != null
        ? Math.min(MAX_SEARCH_DEPTH, Math.max(1, Number(searchOptions.maxDepth)))
        : DEFAULT_MAX_DEPTH;
    const timeoutMs = thinkingTimeMs != null && Number(thinkingTimeMs) > 0
        ? Math.max(1000, Math.floor(Number(thinkingTimeMs)) + THINKING_TIME_SAFETY_BUFFER_MS)
        : BRAIN_MOVE_TIMEOUT_MS;

    const searchPromise = (async () => {
        leafEvaluationsThisSearch = 0;
        const phase = applyRuntimeConfigForGame(game);
        const budgetLabel = thinkingTimeMs != null
            ? `time=${thinkingTimeMs}ms`
            : `depth=${maxDepth}`;
        console.log(
            `${LOG_PREFIX} Thinking... ${budgetLabel}, phase=${phase}, `
                + `plies=${currentSearchPliesPlayed(game)}`,
        );
        game.SearchMode = true;
        try {
            if (thinkingTimeMs != null && Number(thinkingTimeMs) > 0) {
                return await searchBestMoveWithTimeLimit(game, thinkingTimeMs);
            }
            return await searchBestMoveAtRoot(game, maxDepth);
        } finally {
            game.SearchMode = false;
        }
    })();

    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error("Brain move timeout"));
        }, timeoutMs);
    });

    try {
        const move = await Promise.race([searchPromise, timeoutPromise]);
        clearTimeout(timeoutHandle);
        return finalizeSearchMove(game, move);
    } catch (err) {
        clearTimeout(timeoutHandle);
        throw err;
    }
}

function finalizeSearchMove(game, move) {
    let out = move;
    if (!out || out.source == null) {
        out = getFirstLegalMove(game);
        if (out) {
            out.searchDepthReached = 0;
        }
        console.error(`${LOG_PREFIX} Search returned empty; first legal fallback`);
    } else {
        const v = game.validateMove(out.source, out.target, game.Turn);
        if (!v.valid) {
            out = getFirstLegalMove(game);
            if (out) {
                out.searchDepthReached = 0;
            }
            console.error(`${LOG_PREFIX} Chosen move failed validateMove; first legal fallback`, out);
        }
    }
    if (out && out.source != null) {
        out.turn = game.Turn;
    }
    return out;
}

exports.brainNextMoveFunc = async (game, options) => {
    const pliesPlayed = options?.pliesPlayed ?? (game.Moves ? game.Moves.length : 0);
    setBrain43SearchContext(options?.config || {}, pliesPlayed);
    const phase = applyRuntimeConfigForGame(game);
    console.log(`${LOG_PREFIX} Game phase: ${phase} (plies=${pliesPlayed})`);
    const state = game.GameState;
    if (!Array.isArray(state.capturedPiecesList)) {
        state.capturedPiecesList = [];
    }
    const strState = JSON.stringify(state);
    const maxDepth = options?.maxDepth != null ? Math.min(MAX_SEARCH_DEPTH, Math.max(1, Number(options.maxDepth))) : DEFAULT_MAX_DEPTH;

    const mateNow = findImmediateMatingMove(game, collectLegalMoves(game));
    if (mateNow) {
        mateNow.searchDepthReached = 0;
        console.log(`${LOG_PREFIX} Immediate mate (depth 0): ${bookMovePgn(game, mateNow)}`);
        return mateNow;
    }

    const bookMove = tryFindMatchState(game);
    if (bookMove && isBookMoveStillLegal(game, bookMove)) {
        bookMove.searchDepthReached = 0;
        console.log(
            `${LOG_PREFIX} Opening book hit (depth 0): ${bookMovePgn(game, bookMove)} (positions evaluated: 0)`,
        );
        return bookMove;
    }

    const workerSearchOptions = {
        config: brain43FullConfig,
        pliesPlayed,
        onSearchProgress: options?.onSearchProgress,
    };
    if (options?.thinkingTimeMs != null && Number(options.thinkingTimeMs) > 0) {
        workerSearchOptions.thinkingTimeMs = Math.floor(Number(options.thinkingTimeMs));
        console.log(`${LOG_PREFIX} Search budget: ${workerSearchOptions.thinkingTimeMs}ms`);
    } else {
        workerSearchOptions.maxDepth = maxDepth;
        const searchPlan = planSearchDepth(game, maxDepth, brain43FullConfig);
        if (searchPlan.moves.length > 0 && !findImmediateMatingMove(game, searchPlan.moves)) {
            logSearchPlan(
                searchPlan.moves.length,
                searchPlan.totalPieces,
                searchPlan.maxDepth,
                searchPlan.depthNote,
            );
        }
    }

    try {
        const move = await createWorkerPromise(strState, workerSearchOptions);
        if (move && move.searchDepthReached != null) {
            const partialNote = move._searchDepthPartial ? " (partial)" : "";
            console.log(
                `${LOG_PREFIX} Move chosen: ${bookMovePgn(game, move)}, `
                    + `score=${move.score != null ? move.score : "n/a"}, `
                    + `search depth=${move.searchDepthReached}${partialNote}`,
            );
        }
        return move;
    } catch (err) {
        if (err instanceof SearchAbortedError) {
            throw err;
        }
        if (err && err.message === "Brain move timeout") {
            const fallbackMove = getFirstLegalMove(game);
            if (!fallbackMove) {
                throw new Error("No legal moves available (checkmate or stalemate)");
            }
            fallbackMove.searchDepthReached = 0;
            console.log(
                `${LOG_PREFIX} Timeout fallback (depth 0): ${bookMovePgn(game, fallbackMove)}`,
            );
            throw new BrainTimeoutFallbackError(fallbackMove);
        }
        console.warn(`${LOG_PREFIX} First worker attempt failed: ${err.message}`);
        try {
            return await createWorkerPromise(strState, workerSearchOptions);
        } catch (retryErr) {
            if (retryErr && retryErr.message === "Brain move timeout") {
                const fallbackMove = getFirstLegalMove(game);
                if (!fallbackMove) {
                    throw new Error("No legal moves available (checkmate or stalemate)");
                }
                fallbackMove.searchDepthReached = 0;
                console.log(
                    `${LOG_PREFIX} Timeout fallback (depth 0): ${bookMovePgn(game, fallbackMove)}`,
                );
                throw new BrainTimeoutFallbackError(fallbackMove);
            }
            const fallbackMove = getFirstLegalMove(game);
            if (!fallbackMove) {
                throw new Error("No legal moves available (checkmate or stalemate)");
            }
            fallbackMove.searchDepthReached = 0;
            console.log(
                `${LOG_PREFIX} Error fallback (depth 0): ${bookMovePgn(game, fallbackMove)}`,
            );
            throw new BrainTimeoutFallbackError(fallbackMove);
        }
    }
};

exports.BrainTimeoutFallbackError = BrainTimeoutFallbackError;
exports.cancelActiveSearch = cancelActiveSearch;
exports.SearchAbortedError = SearchAbortedError;

/** Terminates persistent search worker and root eval pool (tests / app shutdown). */
exports.shutdownWorkers = function shutdownWorkers() {
    if (!isMainThread) {
        return;
    }
    shutdownRootWorkerPool();
    terminatePersistentWorker("shutdown");
};

// --- Search (worker thread) -------------------------------------------------

function pieceValue(game, pieceType) {
    const scores = runtimeConfig.pieceScores;
    switch (pieceType) {
        case game.PAWN:
            return scores.pawn;
        case game.ROOK:
            return scores.rook;
        case game.KNIGHT:
            return scores.knight;
        case game.BISHOP:
            return scores.bishop;
        case game.QUEEN:
            return scores.queen;
        case game.KING:
            return scores.king;
        default:
            return 0;
    }
}

/** Multiplier for pawn on file `col` (0=a … 7=h); 1 when no table configured. */
function pawnFileMultiplier(col) {
    const pfv = runtimeConfig.pawnFileValues;
    if (!pfv || typeof col !== "number" || col < 0 || col > 7) {
        return 1;
    }
    const tableKey = runtimeConfig.pawnFileTableKey || "openingMidGame";
    const table = pfv[tableKey];
    if (!table) {
        return 1;
    }
    const file = "abcdefgh"[col];
    const mult = table[file];
    return Number.isFinite(mult) ? mult : 1;
}

function pieceValueOnSquare(game, piece, col) {
    if (!piece) {
        return 0;
    }
    if (piece.pieceType === game.PAWN) {
        return pieceValue(game, game.PAWN) * pawnFileMultiplier(col);
    }
    return pieceValue(game, piece.pieceType);
}

function specialEvaluations() {
    return runtimeConfig.specialEvaluations || {};
}

function isCastlingKingMove(game, move) {
    if (!move.piece || move.piece.pieceType !== game.KING) {
        return false;
    }
    if (move.source.row !== move.target.row) {
        return false;
    }
    return Math.abs(move.target.col - move.source.col) === 2;
}

function getFirstKingRookMovePenaltyDelta(game, move, se) {
    const kPen = Number(se.firstKingMovePenalty) || 0;
    const rPen = Number(se.firstRookMovePenalty) || 0;
    if (kPen === 0 && rPen === 0) {
        return 0;
    }
    const state = game.GameState;
    if (!state || !move.piece) {
        return 0;
    }
    const wpv = state.whitePlayerView !== false;
    const kingsideRookCol = wpv ? 7 : 0;
    const queensideRookCol = wpv ? 0 : 7;
    let units = 0;
    if (kPen !== 0 && move.piece.pieceType === game.KING) {
        const isFirst = (move.piece.color === "white" && !state.whiteKingMoved)
            || (move.piece.color === "black" && !state.blackKingMoved);
        if (isFirst && !isCastlingKingMove(game, move)) {
            units += kPen;
        }
    }
    if (rPen !== 0 && move.piece.pieceType === game.ROOK) {
        const c = move.piece.color;
        if (c === "white") {
            if (move.source.col === kingsideRookCol && !state.kingsideWhiteRookMoved) {
                units += rPen;
            } else if (move.source.col === queensideRookCol && !state.queensideWhiteRookMoved) {
                units += rPen;
            }
        } else if (c === "black") {
            if (move.source.col === kingsideRookCol && !state.kingsideBlackRookMoved) {
                units += rPen;
            } else if (move.source.col === queensideRookCol && !state.queensideBlackRookMoved) {
                units += rPen;
            }
        }
    }
    if (units === 0) {
        return 0;
    }
    return -units;
}

function getCurrentPlayerDoubledPawnCount(game) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    const currentColor = game.Turn;
    let doubledCount = 0;
    for (let col = 0; col < 8; col++) {
        let pawnsInFile = 0;
        for (let row = 0; row < 8; row++) {
            const piece = state.board[row][col];
            if (piece && piece.color === currentColor && piece.pieceType === game.PAWN) {
                pawnsInFile += 1;
            }
        }
        if (pawnsInFile >= 2) {
            doubledCount += pawnsInFile;
        }
    }
    return doubledCount;
}

/**
 * Stacked advanced-pawn bonus fraction (× pawn value on that square).
 * White: rank 5/6/7 (rows 3/2/1) → 20% / 40% / 60% per pawnAdvancedBonus step.
 * Black: rank 4/3/2 (rows 4/5/6) → 20% / 40% / 60%.
 */
function getAdvancedPawnBonusFraction(row, color, bonusPerRank) {
    const step = Number(bonusPerRank);
    if (!Number.isFinite(step) || step <= 0) {
        return 0;
    }
    if (color === "white") {
        if (row === 3) {
            return step;
        }
        if (row === 2) {
            return step * 2;
        }
        if (row === 1) {
            return step * 3;
        }
        return 0;
    }
    if (color === "black") {
        if (row === 4) {
            return step;
        }
        if (row === 5) {
            return step * 2;
        }
        if (row === 6) {
            return step * 3;
        }
        return 0;
    }
    return 0;
}

function isAdvancedPawnRankForColor(row, color) {
    return getAdvancedPawnBonusFraction(row, color, 1) > 0;
}

function getAdvancedPawnBonusForColor(game, color, se) {
    const pab = Number(se.pawnAdvancedBonus) || 0;
    if (pab === 0) {
        return 0;
    }
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    let total = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state.board[row][col];
            if (!piece || piece.color !== color || piece.pieceType !== game.PAWN) {
                continue;
            }
            const frac = getAdvancedPawnBonusFraction(row, color, pab);
            if (frac > 0) {
                total += pieceValueOnSquare(game, piece, col) * frac;
            }
        }
    }
    return total;
}

function getCurrentPlayerAdvancedPawnCount(game) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    const currentColor = game.Turn;
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state.board[row][col];
            if (!piece || piece.color !== currentColor || piece.pieceType !== game.PAWN) {
                continue;
            }
            if (isAdvancedPawnRankForColor(row, currentColor)) {
                count += 1;
            }
        }
    }
    return count;
}

/**
 * Pawn chains for the side to move: each chain is a run of adjacent files (columns)
 * that contain at least one friendly pawn. Rank does not matter; pawns need not
 * defend each other. Example: pawns on c3, d6, e5, f2 => one chain (files c–f).
 */
function getCurrentPlayerPawnChainCount(game) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    const currentColor = game.Turn;
    const filesWithPawns = [];
    for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 8; row++) {
            const piece = state.board[row][col];
            if (piece && piece.color === currentColor && piece.pieceType === game.PAWN) {
                filesWithPawns.push(col);
                break;
            }
        }
    }
    if (filesWithPawns.length === 0) {
        return 0;
    }
    let chains = 1;
    for (let i = 1; i < filesWithPawns.length; i++) {
        if (filesWithPawns[i] !== filesWithPawns[i - 1] + 1) {
            chains += 1;
        }
    }
    return chains;
}

function getPawnChainCountEvalDelta(game, se) {
    const p = Number(se.pawnsChainCountPenalty) || 0;
    if (p === 0) {
        return 0;
    }
    const c = getCurrentPlayerPawnChainCount(game);
    if (c <= 1) {
        return 0;
    }
    return -(c - 1) * p;
}

function isBoardFileFullyOpen(game, col) {
    const state = game.GameState;
    const board = state?.board;
    if (!board) {
        return false;
    }
    const pawn = game.PAWN;
    for (let row = 0; row < 8; row++) {
        const p = board[row][col];
        if (p && p.pieceType === pawn) {
            return false;
        }
    }
    return true;
}

function isRookOnInvadingSeventhRowForColor(row, color) {
    if (color === "white") {
        return row === 1;
    }
    if (color === "black") {
        return row === 6;
    }
    return false;
}

function getBestOpenRookSeventhBonusDelta(game, se) {
    const raw = se.bestOpenRookOnSeventhMultiplier;
    const mult = Number.isFinite(Number(raw)) ? Number(raw) : 1.25;
    if (mult <= 1) {
        return 0;
    }
    const state = game.GameState;
    const board = state?.board;
    if (!board) {
        return 0;
    }
    const side = game.Turn;
    const rookT = game.ROOK;
    const rookScore = pieceValue(game, rookT);
    const extraPerRook = (mult - 1) * rookScore;
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (
                piece
                && piece.color === side
                && piece.pieceType === rookT
                && isRookOnInvadingSeventhRowForColor(row, side)
                && isBoardFileFullyOpen(game, col)
            ) {
                count += 1;
            }
        }
    }
    return count * extraPerRook;
}

function getVeryGoodOpenFileRookBonusDelta(game, se) {
    const raw = se.veryGoodOpenRookMultiplier;
    const mult = Number.isFinite(Number(raw)) ? Number(raw) : 1.125;
    if (mult <= 1) {
        return 0;
    }
    const state = game.GameState;
    const board = state?.board;
    if (!board) {
        return 0;
    }
    const side = game.Turn;
    const rookT = game.ROOK;
    const rookScore = pieceValue(game, rookT);
    const extraPerRook = (mult - 1) * rookScore;
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === side && piece.pieceType === rookT && isBoardFileFullyOpen(game, col)) {
                count += 1;
            }
        }
    }
    return count * extraPerRook;
}

function isBoardFileClosedForRook(game, col) {
    return !isBoardFileFullyOpen(game, col);
}

function getPoorClosedFileRookPenaltyDelta(game, se) {
    const raw = se.poorClosedFileRookMultiplier;
    const mult = Number.isFinite(Number(raw)) ? Number(raw) : 0.75;
    if (mult >= 1) {
        return 0;
    }
    const state = game.GameState;
    const board = state?.board;
    if (!board) {
        return 0;
    }
    const side = game.Turn;
    const rookT = game.ROOK;
    const rookScore = pieceValue(game, rookT);
    const deltaPerRook = (mult - 1) * rookScore;
    let count = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === side && piece.pieceType === rookT && isBoardFileClosedForRook(game, col)) {
                count += 1;
            }
        }
    }
    if (count === 0) {
        return 0;
    }
    return count * deltaPerRook;
}

/** Doubled pawns: −count × doublePawnPenalty × pawn value; advanced: stacked rank bonus per pawn. */
function getPawnEvalDelta(game, se) {
    const dpp = Number(se.doublePawnPenalty) || 0;
    const pv = pieceValue(game, game.PAWN);
    return -getCurrentPlayerDoubledPawnCount(game) * dpp * pv
        + getAdvancedPawnBonusForColor(game, game.Turn, se);
}

function getTotalMaterialValueForColor(game, color) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    let total = 0;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = state.board[row][col];
            if (piece && piece.color === color) {
                total += pieceValueOnSquare(game, piece, col);
            }
        }
    }
    return total;
}

function getDrawLeafScoreForMover(game, movingPlayerColor, se) {
    const thrRaw = Number(se.drawMaterialDiffThreshold);
    const threshold = Number.isFinite(thrRaw) ? thrRaw : 3;
    const opponent = movingPlayerColor === "white" ? "black" : "white";
    const my = getTotalMaterialValueForColor(game, movingPlayerColor);
    const op = getTotalMaterialValueForColor(game, opponent);
    const diff = my - op;
    if (diff >= threshold) {
        const v = Number(se.drawScoreWhenAhead);
        return Number.isFinite(v) ? v : -5;
    }
    if (diff <= -threshold) {
        const v = Number(se.drawScoreWhenBehind);
        return Number.isFinite(v) ? v : 5;
    }
    const v = Number(se.drawScoreWhenEven);
    return Number.isFinite(v) ? v : -0.1;
}

function positionalBonusesForSideToMove(game) {
    const se = specialEvaluations();
    return getPawnEvalDelta(game, se)
        + getPawnChainCountEvalDelta(game, se)
        + getBestOpenRookSeventhBonusDelta(game, se)
        + getVeryGoodOpenFileRookBonusDelta(game, se)
        + getPoorClosedFileRookPenaltyDelta(game, se);
}

/** Brain 4.1-style move-local score before recursion (same board, candidate move). */
function stateScoreForMove(game, move) {
    const state = game.GameState;
    const targetPiece = state.board[move.target.row][move.target.col];
    let score = 0;
    if (targetPiece != null) {
        score = pieceValueOnSquare(game, targetPiece, move.target.col);
    }
    const se = specialEvaluations();
    score += getPawnEvalDelta(game, se);
    score += getPawnChainCountEvalDelta(game, se);
    score += getFirstKingRookMovePenaltyDelta(game, move, se);
    score += getBestOpenRookSeventhBonusDelta(game, se);
    score += getVeryGoodOpenFileRookBonusDelta(game, se);
    score += getPoorClosedFileRookPenaltyDelta(game, se);
    return score;
}

/**
 * Immediate score for playing `move` (promotion / mate / draw / repetition bonuses), without recursion.
 * Uses its own make/undo so {@link withAppliedMove} can stay nested for search.
 */
function immediateLineScoreForMove(game, move) {
    applyRuntimeConfigForGame(game);
    const movingPlayer = game.Turn;
    let score = stateScoreForMove(game, move);
    game.makeMove(move.source, move.target);
    try {
        if (move.promotion) {
            game.completePromotion(move);
            switch (move.selectedPiece) {
                case game.QUEEN:
                    score = pieceValue(game, game.QUEEN);
                    break;
                case game.ROOK:
                    score = pieceValue(game, game.ROOK);
                    break;
                case game.KNIGHT:
                    score = pieceValue(game, game.KNIGHT);
                    break;
                case game.BISHOP:
                    score = pieceValue(game, game.BISHOP);
                    break;
                default:
                    break;
            }
        }
        if (game.Checkmate) {
            score = MATE_SCORE;
        }
        if (game.Draw) {
            score = getDrawLeafScoreForMover(game, movingPlayer, specialEvaluations());
        }
        if (game.Moves.length > 50 && game.Check) {
            score += 2.5;
        }
        return score;
    } finally {
        game.undo();
    }
}

function materialDifferenceForSideToMove(game) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    const side = game.Turn;
    let mine = 0;
    let theirs = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = state.board[r][c];
            if (!p) {
                continue;
            }
            const v = pieceValueOnSquare(game, p, c);
            if (p.color === side) {
                mine += v;
            } else {
                theirs += v;
            }
        }
    }
    return mine - theirs;
}

/** Leaf: material + positional terms for side to move (no move-specific king/rook first penalty). */
function evaluateLeafPosition(game, ply = 0) {
    applyRuntimeConfigForGame(game);
    leafEvaluationsThisSearch += 1;
    if (game.Checkmate) {
        return -MATE_SCORE + ply;
    }
    if (game.Draw) {
        return 0;
    }
    return materialDifferenceForSideToMove(game) + positionalBonusesForSideToMove(game);
}

function roundEvalScore(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.round(value * 100) / 100;
}

function pieceLabel(game, pieceType) {
    switch (pieceType) {
        case game.PAWN:
            return "Pawn";
        case game.ROOK:
            return "Rook";
        case game.KNIGHT:
            return "Knight";
        case game.BISHOP:
            return "Bishop";
        case game.QUEEN:
            return "Queen";
        case game.KING:
            return "King";
        default:
            return "Piece";
    }
}

function opponentColor(color) {
    return color === "white" ? "black" : "white";
}

function withEvalTurn(game, color, fn) {
    const state = game.GameState;
    const prev = state ? state.turn : null;
    if (state) {
        state.turn = color;
    }
    try {
        return fn();
    } finally {
        if (state) {
            state.turn = prev;
        }
    }
}

function countPawnsInFileForColor(game, col, color) {
    const state = game.GameState;
    if (!state?.board) {
        return 0;
    }
    let count = 0;
    for (let row = 0; row < 8; row++) {
        const piece = state.board[row][col];
        if (piece && piece.color === color && piece.pieceType === game.PAWN) {
            count += 1;
        }
    }
    return count;
}

function getPawnEvalDeltaParts(game, se) {
    const dpp = Number(se.doublePawnPenalty) || 0;
    const pv = pieceValue(game, game.PAWN);
    return {
        doubled: -getCurrentPlayerDoubledPawnCount(game) * dpp * pv,
        advanced: getAdvancedPawnBonusForColor(game, game.Turn, se),
    };
}

function getPawnEvalDeltaPartsForColor(game, color, se) {
    return withEvalTurn(game, color, () => getPawnEvalDeltaParts(game, se));
}

function getPawnChainCountForColor(game, color) {
    return withEvalTurn(game, color, () => getCurrentPlayerPawnChainCount(game));
}

function getPawnChainPenaltyForColor(game, color, se) {
    return withEvalTurn(game, color, () => getPawnChainCountEvalDelta(game, se));
}

function positionalScoreForColor(game, color) {
    return withEvalTurn(game, color, () => positionalBonusesForSideToMove(game));
}

function signedForPerspective(value, pieceColor, perspectiveColor) {
    return pieceColor === perspectiveColor ? value : -value;
}

function getSquarePawnPositionalBreakdown(game, row, col, se, perspectiveColor) {
    const state = game.GameState;
    const piece = state?.board?.[row]?.[col];
    const breakdown = [];
    if (!piece || piece.pieceType !== game.PAWN) {
        return breakdown;
    }
    const dpp = Number(se.doublePawnPenalty) || 0;
    if (dpp !== 0 && countPawnsInFileForColor(game, col, piece.color) >= 2) {
        const penalty = -dpp * pieceValueOnSquare(game, piece, col);
        breakdown.push({
            label: piece.color === perspectiveColor ? "Doubled pawn penalty" : "Opponent doubled pawn penalty",
            value: roundEvalScore(signedForPerspective(penalty, piece.color, perspectiveColor)),
        });
    }
    const pab = Number(se.pawnAdvancedBonus) || 0;
    const frac = getAdvancedPawnBonusFraction(row, piece.color, pab);
    if (frac > 0) {
        const bonus = pieceValueOnSquare(game, piece, col) * frac;
        const pct = Math.round(frac * 100);
        breakdown.push({
            label: piece.color === perspectiveColor
                ? `Advanced pawn bonus (+${pct}%)`
                : `Opponent advanced pawn bonus (+${pct}%)`,
            value: roundEvalScore(signedForPerspective(bonus, piece.color, perspectiveColor)),
        });
    }
    return breakdown;
}

function getSquareRookPositionalBreakdown(game, row, col, se, perspectiveColor) {
    const state = game.GameState;
    const piece = state?.board?.[row]?.[col];
    const breakdown = [];
    if (!piece || piece.pieceType !== game.ROOK) {
        return breakdown;
    }
    const rookScore = pieceValue(game, game.ROOK);
    const openFile = isBoardFileFullyOpen(game, col);
    if (openFile) {
        const openMult = Number.isFinite(Number(se.veryGoodOpenRookMultiplier))
            ? Number(se.veryGoodOpenRookMultiplier)
            : 1.125;
        if (openMult > 1) {
            const bonus = (openMult - 1) * rookScore;
            breakdown.push({
                label: piece.color === perspectiveColor ? "Open file rook bonus" : "Opponent open file rook bonus",
                value: roundEvalScore(signedForPerspective(bonus, piece.color, perspectiveColor)),
            });
        }
        const seventhMult = Number.isFinite(Number(se.bestOpenRookOnSeventhMultiplier))
            ? Number(se.bestOpenRookOnSeventhMultiplier)
            : 1.25;
        if (
            seventhMult > 1
            && isRookOnInvadingSeventhRowForColor(row, piece.color)
        ) {
            const bonus = (seventhMult - 1) * rookScore;
            breakdown.push({
                label: piece.color === perspectiveColor ? "Rook on 7th rank bonus" : "Opponent rook on 7th rank bonus",
                value: roundEvalScore(signedForPerspective(bonus, piece.color, perspectiveColor)),
            });
        }
    } else {
        const closedMult = Number.isFinite(Number(se.poorClosedFileRookMultiplier))
            ? Number(se.poorClosedFileRookMultiplier)
            : 0.75;
        if (closedMult < 1) {
            const penalty = (closedMult - 1) * rookScore;
            breakdown.push({
                label: piece.color === perspectiveColor ? "Closed file rook penalty" : "Opponent closed file rook penalty",
                value: roundEvalScore(signedForPerspective(penalty, piece.color, perspectiveColor)),
            });
        }
    }
    return breakdown;
}

function formatBrain43PhaseLabel(phase) {
    switch (phase) {
        case "startGame":
            return "Start game";
        case "midGame":
            return "Mid game";
        case "endGame":
            return "End game";
        default:
            return phase || "Start game";
    }
}

/** Status-bar tooltip: game phase, per-color piece score total and pawn chain count. */
function buildPositionSummaryBreakdown(game, squares, phase) {
    const totals = { white: 0, black: 0 };
    (squares || []).forEach((sq) => {
        const color = sq.piece && sq.piece.color;
        if (color === "white" || color === "black") {
            totals[color] += sq.score;
        }
    });
    const colorLines = ["white", "black"].map((color) => {
        const chainCount = getPawnChainCountForColor(game, color);
        const chainWord = chainCount === 1 ? "chain" : "chains";
        return {
            label: color === "white" ? "White" : "Black",
            value: roundEvalScore(totals[color]),
            text: `${chainCount} pawn ${chainWord}`,
        };
    });
    return [
        {
            label: "Game mode",
            text: formatBrain43PhaseLabel(phase),
        },
        ...colorLines,
    ];
}

/**
 * Static position evaluation for UI display (material + positional terms for side to move).
 * @param {import("./ChessGame").ChessGame} game
 * @param {{ config?: object }} [options]
 * @returns {{
 *   total: number,
 *   sideToMove: string,
 *   terminal: string|null,
 *   gamePhase: string,
 *   summary: { label: string, value?: number, text?: string }[],
 *   squares: { row: number, col: number, piece: { color: string, pieceType: number }, score: number, breakdown: { label: string, value: number }[] }[]
 * }}
 */
function evaluatePositionDisplay(game, options) {
    const pliesPlayed = options?.pliesPlayed ?? (game.Moves ? game.Moves.length : 0);
    setBrain43SearchContext(options?.config || brain43FullConfig, pliesPlayed);
    const phase = applyRuntimeConfigForGame(game);
    console.log(`${LOG_PREFIX} Display eval phase: ${phase} (plies=${pliesPlayed})`);
    const se = specialEvaluations();
    const side = game.Turn;
    let total;
    let terminal = null;
    if (game.Checkmate) {
        total = -MATE_SCORE;
        terminal = "checkmate";
    } else if (game.Draw) {
        total = 0;
        terminal = "draw";
    } else {
        total = materialDifferenceForSideToMove(game)
            + positionalScoreForColor(game, side)
            - positionalScoreForColor(game, opponentColor(side));
    }
    total = roundEvalScore(total);

    const squares = [];
    const state = game.GameState;
    if (state?.board) {
        for (let row = 0; row < game.BOARD_ROWS; row++) {
            for (let col = 0; col < game.BOARD_COLUMNS; col++) {
                const piece = state.board[row][col];
                if (!piece) {
                    continue;
                }
                const isMine = piece.color === side;
                const materialValue = pieceValueOnSquare(game, piece, col);
                const signedMaterial = isMine ? materialValue : -materialValue;
                let materialLabel = `${pieceLabel(game, piece.pieceType)} material`;
                if (piece.pieceType === game.PAWN && pawnFileMultiplier(col) !== 1) {
                    materialLabel += ` (${"abcdefgh"[col]}-file)`;
                }
                const breakdown = [
                    {
                        label: materialLabel,
                        value: roundEvalScore(signedMaterial),
                    },
                ];
                breakdown.push(...getSquarePawnPositionalBreakdown(game, row, col, se, side));
                breakdown.push(...getSquareRookPositionalBreakdown(game, row, col, se, side));
                let score = breakdown.reduce((sum, item) => sum + item.value, 0);
                score = roundEvalScore(score);
                squares.push({
                    row,
                    col,
                    piece: { color: piece.color, pieceType: piece.pieceType },
                    score,
                    breakdown,
                });
            }
        }
    }

    return {
        total,
        sideToMove: side,
        terminal,
        gamePhase: phase,
        summary: buildPositionSummaryBreakdown(game, squares, phase),
        squares,
    };
}

exports.evaluatePositionDisplay = evaluatePositionDisplay;
exports.detectBrain43Phase = detectBrain43Phase;
exports.countPiecesForColor = countPiecesForColor;
exports.countTotalPiecesOnBoard = countTotalPiecesOnBoard;
exports.resolveBrain43ActivePhaseSettings = resolveBrain43ActivePhaseSettings;
exports.getAdvancedPawnBonusFraction = getAdvancedPawnBonusFraction;
exports.getAdvancedPawnBonusForColor = getAdvancedPawnBonusForColor;
exports.estimateLeafEvaluations = estimateLeafEvaluations;
exports.computeAdaptiveSearchDepth = computeAdaptiveSearchDepth;
exports.computeAdaptivePieceScale = computeAdaptivePieceScale;
exports.resolveAdaptiveDepthSettings = resolveAdaptiveDepthSettings;

function collectLegalMoves(game) {
    const state = game.GameState;
    if (!state || !state.board) {
        return [];
    }
    const turn = game.Turn;
    let moves = [];
    for (let i = 0; i < game.BOARD_ROWS; i++) {
        const row = state.board[i];
        if (!row) {
            continue;
        }
        for (let j = 0; j < game.BOARD_COLUMNS; j++) {
            const piece = row[j];
            if (!piece || piece.color !== turn) {
                continue;
            }
            const source = game.square(i, j);
            let options;
            try {
                options = game.possibleMoves(source);
            } catch (err) {
                console.error("[Brain4.3] possibleMoves failed at", i, j, err);
                continue;
            }
            if (options.length > 0) {
                for (const move of options) {
                    moves = moves.concat(move);
                }
            }
        }
    }
    return moves;
}

function getFirstLegalMove(game) {
    const moves = collectLegalMoves(game);
    return moves.length > 0 ? moves[0] : null;
}

function orderMovesCapturesFirst(game, moves) {
    const state = game.GameState;
    if (!state?.board?.length || moves.length <= 1) {
        return moves.slice();
    }
    const decorated = moves.map((move) => {
        const capture = state.board[move.target.row]?.[move.target.col];
        const captureValue = capture ? pieceValueOnSquare(game, capture, move.target.col) : 0;
        const givesCheck = withAppliedMove(game, move, () => game.Check);
        return { move, captureValue, givesCheck };
    });
    decorated.sort((a, b) => {
        if (a.givesCheck !== b.givesCheck) {
            return (b.givesCheck ? 1 : 0) - (a.givesCheck ? 1 : 0);
        }
        return b.captureValue - a.captureValue;
    });
    return decorated.map((entry) => entry.move);
}

function rootHasCheckingMove(game, moves) {
    for (let i = 0; i < moves.length; i++) {
        if (withAppliedMove(game, moves[i], () => game.Check)) {
            return true;
        }
    }
    return false;
}

function staticMoveBonus(game, move) {
    let score = stateScoreForMove(game, move);
    if (move.promotion) {
        switch (move.selectedPiece) {
            case game.QUEEN:
                score = pieceValue(game, game.QUEEN);
                break;
            case game.ROOK:
                score = pieceValue(game, game.ROOK);
                break;
            case game.KNIGHT:
                score = pieceValue(game, game.KNIGHT);
                break;
            case game.BISHOP:
                score = pieceValue(game, game.BISHOP);
                break;
            default:
                break;
        }
    }
    return score;
}

/**
 * Applies a legal move, runs `fn`, then always undoes once — even if `fn` throws or search prunes.
 * @template T
 * @param {import("./ChessGame").ChessGame} game
 * @param {object} move
 * @param {() => T} fn
 * @returns {T}
 */
function withAppliedMove(game, move, fn) {
    game.makeMove(move.source, move.target);
    try {
        if (move.promotion) {
            game.completePromotion(move);
        }
        return fn();
    } finally {
        game.undo();
    }
}

function scoreTerminalNoMoves(game, ply = 0) {
    if (game.Checkmate) {
        return -MATE_SCORE + ply;
    }
    return 0;
}

/**
 * Score a legal move from the current node (negamax): static bonuses, then recurse unless terminal.
 * Mate scores use {@link MATE_SCORE} − ply so shorter mates rank above horizon false mates.
 */
function evaluateSearchMove(game, move, depthRemaining, alpha, beta, ply) {
    const q = staticMoveBonus(game, move);
    return withAppliedMove(game, move, () => {
        if (game.Checkmate) {
            return MATE_SCORE - ply;
        }
        const mover = game.Turn === "white" ? "black" : "white";
        if (game.Draw) {
            return getDrawLeafScoreForMover(game, mover, specialEvaluations());
        }
        if (game.Moves.length > 50 && game.Check) {
            return q + 2.5 - negamax(game, depthRemaining, -beta, -alpha, ply + 1);
        }
        return q - negamax(game, depthRemaining, -beta, -alpha, ply + 1);
    });
}

/** If any legal move mates immediately, return it (do not search past checkmate). */
function findImmediateMatingMove(game, moves) {
    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        const mates = withAppliedMove(game, move, () => game.Checkmate);
        if (mates) {
            return move;
        }
    }
    return null;
}

function negamax(game, depthRemaining, alpha, beta, ply = 0) {
    if (shouldStopSearch()) {
        return evaluateLeafPosition(game, ply);
    }
    applyRuntimeConfigForGame(game);
    if (depthRemaining <= 0) {
        return evaluateLeafPosition(game, ply);
    }

    const moves = collectLegalMoves(game);
    if (moves.length === 0) {
        return scoreTerminalNoMoves(game, ply);
    }

    const ordered = orderMovesCapturesFirst(game, moves);
    let best = -Infinity;
    for (let i = 0; i < ordered.length; i++) {
        if (shouldStopSearch()) {
            break;
        }
        const move = ordered[i];
        const score = evaluateSearchMove(game, move, depthRemaining - 1, alpha, beta, ply);
        if (isWinningMateScore(score)) {
            return score;
        }
        if (score > best) {
            best = score;
        }
        if (score > alpha) {
            alpha = score;
        }
        if (alpha >= beta) {
            break;
        }
    }
    return best;
}

function planSearchDepth(game, baseMaxDepth, fullConfig) {
    const moves = collectLegalMoves(game);
    const totalPieces = countTotalPiecesOnBoard(game);
    const maxDepth = clampSearchDepth(baseMaxDepth);
    return { moves, totalPieces, maxDepth, depthNote: "" };
}

function logSearchPlan(rootMoves, totalPieces, maxDepth, depthNote) {
    console.log(
        `${LOG_PREFIX} Search: rootMoves=${rootMoves}, pieces=${totalPieces}, depth=${maxDepth}${depthNote}`,
    );
}

function logSearchDepthCompleted(game, depth, pick) {
    if (!pick) {
        return;
    }
    const scoreLabel = pick.score != null && Number.isFinite(pick.score) ? pick.score : "n/a";
    emitSearchProgress(
        `${LOG_PREFIX} Depth ${depth} completed: ${bookMovePgn(game, pick)}, score=${scoreLabel}`,
    );
}

function logSearchDepthCompletedPartial(game, depth, pick) {
    if (!pick) {
        return;
    }
    const scoreLabel = pick.score != null && Number.isFinite(pick.score) ? pick.score : "n/a";
    emitSearchProgress(
        `${LOG_PREFIX} Depth ${depth} completed (partial): ${bookMovePgn(game, pick)}, score=${scoreLabel}`,
    );
}

function logSearchDepthAborted(depth) {
    emitSearchProgress(`${LOG_PREFIX} Depth ${depth} aborted (time, incomplete)`);
}

function mergeRootMoveScore(game, move, score, tiedBest, bestScoreRef, depthLimit) {
    if (!Number.isFinite(score)) {
        return bestScoreRef.value;
    }
    const prevLeader = tiedBest.length > 0 ? tiedBest[0] : null;
    if (score > bestScoreRef.value) {
        bestScoreRef.value = score;
        tiedBest.length = 0;
        tiedBest.push(move);
    } else if (score === bestScoreRef.value) {
        const q = staticMoveBonus(game, move);
        const prevQ =
            tiedBest.length > 0
                ? staticMoveBonus(game, tiedBest[0])
                : -Infinity;
        if (q > prevQ) {
            tiedBest.length = 0;
            tiedBest.push(move);
        } else if (q === prevQ) {
            tiedBest.push(move);
        }
    }
    const nextLeader = tiedBest.length > 0 ? tiedBest[0] : null;
    if (nextLeader && (!prevLeader || !sameRootMove(prevLeader, nextLeader))) {
        const scoreLabel = bestScoreRef.value !== -Infinity ? bestScoreRef.value : "n/a";
        emitSearchProgress(
            `${LOG_PREFIX} Search best (depth ${depthLimit}, in progress): ${bookMovePgn(game, nextLeader)}, `
                + `score=${scoreLabel}`,
        );
    }
    return bestScoreRef.value;
}

function finalizeRootSearchPick(game, ordered, tiedBest, bestScore, depthLimit, partial) {
    if (tiedBest.length === 0) {
        if (partial) {
            logSearchDepthAborted(depthLimit);
            return null;
        }
        const fallback = ordered[0];
        if (fallback) {
            logSearchDepthCompleted(game, depthLimit, fallback);
        }
        return fallback;
    }
    const pick = tiedBest[0];
    if (tiedBest.length > 1) {
        logTiedBestMoveOptions(game, tiedBest, bestScore);
        console.log(`${LOG_PREFIX} Tie-break: ${bookMovePgn(game, pick)} (first by move order / static bonus)`);
    }
    pick.score = bestScore;
    if (partial) {
        pick._searchDepthPartial = true;
        logSearchDepthCompletedPartial(game, depthLimit, pick);
    } else {
        logSearchDepthCompleted(game, depthLimit, pick);
    }
    return pick;
}

/**
 * Evaluate a set of root moves across the worker pool.
 * All tasks are dispatched at once so the pool keeps every worker busy (no lockstep batching).
 * `alpha` seeds an alpha-beta lower bound shared by every worker so sibling subtrees prune,
 * recovering most of the pruning that sequential alpha-beta gets at the root.
 *
 * @param {object[]} moves Root moves to evaluate (subset of the full ordered list).
 * @param {number} depthAfterRoot Remaining search depth after the root move.
 * @param {number} alpha Shared lower bound for pruning (-Infinity to disable).
 * @returns {Promise<Array<{move: object, score: number}|null>>}
 */
async function evaluateRootMovesParallel(game, moves, depthAfterRoot, alpha) {
    if (moves.length === 0) {
        return [];
    }
    const pool = getRootWorkerPool();
    if (!pool) {
        return [];
    }
    const gameState = JSON.stringify(game.GameState);
    const config = brain43FullConfig;
    const pliesPlayed = currentSearchPliesPlayed(game);
    const searchDeadlineMs = getSearchDeadlineMs();
    const sharedAlpha = Number.isFinite(alpha) ? alpha : -Infinity;

    const tasks = moves.map((move, i) => {
        const requestId = ++rootEvalRequestCounter;
        return pool.runTask({
            requestId,
            gameState,
            move: {
                source: move.source,
                target: move.target,
                piece: move.piece,
                promotion: move.promotion,
                selectedPiece: move.selectedPiece,
            },
            depthAfterRoot,
            config,
            pliesPlayed,
            searchDeadlineMs,
            moveIndex: i,
            alpha: sharedAlpha,
            beta: Infinity,
        }).then((result) => {
            if (result && Number.isFinite(result.leafEvaluations)) {
                leafEvaluationsThisSearch += result.leafEvaluations;
            }
            return result && Number.isFinite(result.score)
                ? { move, score: result.score }
                : null;
        }).catch((err) => {
            console.warn(`${LOG_PREFIX} Root eval failed for move ${i}: ${err.message}`);
            return null;
        });
    });

    return Promise.all(tasks);
}

/** Sequential root search (same alpha-beta window as Brain 4.2). */
function searchAtFixedDepthSequential(game, maxDepth, depthCap = MAX_SEARCH_DEPTH) {
    const depthLimit = clampSearchDepth(maxDepth, depthCap);
    const moves = collectLegalMoves(game);
    if (moves.length === 0) {
        return null;
    }
    const mateNow = findImmediateMatingMove(game, moves);
    if (mateNow) {
        mateNow.score = MATE_SCORE;
        return mateNow;
    }
    const ordered = orderMovesCapturesFirst(game, moves);
    const depthAfterRoot = Math.max(0, depthLimit - 1);
    let alpha = -Infinity;
    const beta = Infinity;
    const tiedBest = [];
    const bestScoreRef = { value: -Infinity };

    for (let i = 0; i < ordered.length; i++) {
        if (shouldStopSearch()) {
            return finalizeRootSearchPick(game, ordered, tiedBest, bestScoreRef.value, depthLimit, true);
        }
        const move = ordered[i];
        const score = evaluateSearchMove(game, move, depthAfterRoot, alpha, beta, 1);
        if (!Number.isFinite(score)) {
            continue;
        }
        mergeRootMoveScore(game, move, score, tiedBest, bestScoreRef, depthLimit);
        if (score > alpha) {
            alpha = score;
        }
        if (isWinningMateScore(bestScoreRef.value)) {
            emitSearchProgress(
                `${LOG_PREFIX} Mate found (depth ${depthLimit}): ${bookMovePgn(game, tiedBest[0])}, stopping search`,
            );
            break;
        }
    }

    return finalizeRootSearchPick(game, ordered, tiedBest, bestScoreRef.value, depthLimit, false);
}

/** True when two moves share source/target (and promotion choice). */
function sameRootMove(a, b) {
    return a && b
        && a.source && b.source && a.target && b.target
        && a.source.row === b.source.row && a.source.col === b.source.col
        && a.target.row === b.target.row && a.target.col === b.target.col
        && !!a.promotion === !!b.promotion
        && a.selectedPiece === b.selectedPiece;
}

/** Move `preferred` to the front of `ordered` (Young-Brothers-Wait PV seeding). */
function orderWithPreferredFirst(ordered, preferred) {
    if (!preferred) {
        return ordered;
    }
    const idx = ordered.findIndex((m) => sameRootMove(m, preferred));
    if (idx > 0) {
        const copy = ordered.slice();
        const [pv] = copy.splice(idx, 1);
        copy.unshift(pv);
        return copy;
    }
    return ordered;
}

/**
 * @param {object} [preferredFirstMove] PV move from the previous iterative-deepening depth.
 *   Searched first (on the main thread) to seed a strong alpha so parallel siblings prune well.
 */
async function searchAtFixedDepth(game, maxDepth, preferredFirstMove, depthCap = MAX_SEARCH_DEPTH) {
    const depthLimit = clampSearchDepth(maxDepth, depthCap);
    const moves = collectLegalMoves(game);
    if (moves.length === 0) {
        return null;
    }
    const mateNow = findImmediateMatingMove(game, moves);
    if (mateNow) {
        mateNow.score = MATE_SCORE;
        return mateNow;
    }
    const captureOrdered = orderMovesCapturesFirst(game, moves);
    /** Parallel root eval only during timed search; fixed-depth matches Brain 4.2 sequentially. */
    const useParallelRoot = isMainThread
        && MAX_ROOT_WORKERS > 1
        && captureOrdered.length > 1
        && getSearchDeadlineMs() > 0;
    if (!useParallelRoot) {
        return searchAtFixedDepthSequential(game, maxDepth, depthCap);
    }

    const ordered = orderWithPreferredFirst(captureOrdered, preferredFirstMove);
    const depthAfterRoot = Math.max(0, depthLimit - 1);
    const tiedBest = [];
    const bestScoreRef = { value: -Infinity };

    // Search the first (PV) move on the main thread to establish a strong alpha (eldest brother).
    const firstMove = ordered[0];
    const firstScore = evaluateSearchMove(game, firstMove, depthAfterRoot, -Infinity, Infinity, 1);
    if (shouldStopSearch()) {
        return finalizeRootSearchPick(game, ordered, tiedBest, bestScoreRef.value, depthLimit, true);
    }
    if (Number.isFinite(firstScore)) {
        mergeRootMoveScore(game, firstMove, firstScore, tiedBest, bestScoreRef, depthLimit);
    }
    if (isWinningMateScore(bestScoreRef.value)) {
        emitSearchProgress(
            `${LOG_PREFIX} Mate found (depth ${depthLimit}): ${bookMovePgn(game, tiedBest[0])}, stopping search`,
        );
        return finalizeRootSearchPick(game, ordered, tiedBest, bestScoreRef.value, depthLimit, false);
    }

    // Remaining moves run in parallel waves. Alpha is raised between waves as better moves are
    // found, so pruning approaches sequential alpha-beta while keeping every worker busy.
    // Within a wave, a result <= the wave's alpha "failed low" (bound only) and is discarded;
    // scores above alpha are exact and safe to merge / tie-break.
    const waveSize = Math.max(1, MAX_ROOT_WORKERS);
    for (let i = 1; i < ordered.length; i += waveSize) {
        if (shouldStopSearch()) {
            break;
        }
        const waveAlpha = bestScoreRef.value;
        const wave = ordered.slice(i, i + waveSize);
        const results = await evaluateRootMovesParallel(game, wave, depthAfterRoot, waveAlpha);
        for (const result of results) {
            if (!result || !Number.isFinite(result.score)) {
                continue;
            }
            if (Number.isFinite(waveAlpha) && result.score <= waveAlpha) {
                continue;
            }
            mergeRootMoveScore(game, result.move, result.score, tiedBest, bestScoreRef, depthLimit);
        }
        if (isWinningMateScore(bestScoreRef.value)) {
            emitSearchProgress(
                `${LOG_PREFIX} Mate found (depth ${depthLimit}): ${bookMovePgn(game, tiedBest[0])}, stopping search`,
            );
            break;
        }
    }

    if (shouldStopSearch()) {
        return finalizeRootSearchPick(game, ordered, tiedBest, bestScoreRef.value, depthLimit, true);
    }

    const pick = finalizeRootSearchPick(game, ordered, tiedBest, bestScoreRef.value, depthLimit, false);
    return pick;
}

async function searchBestMoveWithTimeLimit(game, thinkingTimeMs) {
    beginTimedSearch(thinkingTimeMs);
    try {
        const moves = collectLegalMoves(game);
        if (moves.length === 0) {
            return null;
        }
        const mateNow = findImmediateMatingMove(game, moves);
        if (mateNow) {
            mateNow.score = MATE_SCORE;
            mateNow.searchDepthReached = 0;
            return mateNow;
        }

        const ordered = orderMovesCapturesFirst(game, moves);
        let bestMove = ordered[0];
        let completedDepth = 0;
        let lastDepthMs = 0;

        for (let depth = 1; depth <= MAX_TIMED_SEARCH_DEPTH; depth += 1) {
            if (shouldStopSearch()) {
                break;
            }
            if (lastDepthMs > 0) {
                const needed = estimateMinMsForNextDepth(lastDepthMs, MIN_MS_FOR_NEXT_DEPTH);
                const remaining = getRemainingSearchMs();
                if (remaining < needed) {
                    emitSearchProgress(
                        `${LOG_PREFIX} Skipping depth ${depth} (~${needed}ms needed, ${remaining}ms left)`,
                    );
                    break;
                }
            } else if (getRemainingSearchMs() < MIN_MS_FOR_NEXT_DEPTH) {
                break;
            }
            const depthStart = Date.now();
            const atDepth = await searchAtFixedDepth(
                game,
                depth,
                completedDepth > 0 ? bestMove : null,
                MAX_TIMED_SEARCH_DEPTH,
            );
            const depthElapsed = Date.now() - depthStart;
            if (atDepth) {
                bestMove = atDepth;
                completedDepth = depth;
                if (depthElapsed > 0) {
                    lastDepthMs = depthElapsed;
                }
                if (isWinningMateScore(bestMove.score)) {
                    emitSearchProgress(
                        `${LOG_PREFIX} Mate found at depth ${completedDepth}, stopping search`,
                    );
                    break;
                }
                if (isLosingMateScore(bestMove.score)) {
                    const mateIn = losingMatePliesFromScore(bestMove.score);
                    emitSearchProgress(
                        `${LOG_PREFIX} Opponent mate found${mateIn != null ? ` (in ${mateIn})` : ""} `
                            + `at depth ${completedDepth}, stopping search`,
                    );
                    break;
                }
            } else {
                break;
            }
            if (shouldStopSearch()) {
                break;
            }
        }

        bestMove.searchDepthReached = completedDepth || 1;
        const partialNote = bestMove._searchDepthPartial ? " (partial)" : "";
        console.log(
            `${LOG_PREFIX} Timed search finished: depth=${bestMove.searchDepthReached}${partialNote}, `
                + `best=${bookMovePgn(game, bestMove)}, `
                + `score=${bestMove.score != null ? bestMove.score : "n/a"}`,
        );
        return tagOpponentMateOnMove(bestMove, bestMove.score, "brain43");
    } finally {
        endTimedSearch();
    }
}

async function searchBestMoveAtRoot(game, baseMaxDepth) {
    const depthLimit = clampSearchDepth(baseMaxDepth);
    const move = await searchAtFixedDepth(game, depthLimit);
    if (move) {
        move.searchDepthReached = depthLimit;
        return tagOpponentMateOnMove(move, move.score, "brain43");
    }
    return move;
}

let rootEvalChess;

/** Called from brain43RootEvalWorker threads for one root-move subtree search. */
function evaluateRootMoveInWorker(request) {
    const {
        requestId,
        gameState,
        move,
        depthAfterRoot,
        config,
        pliesPlayed,
        searchDeadlineMs,
        moveIndex,
        alpha,
        beta,
    } = request;

    if (!rootEvalChess) {
        rootEvalChess = new ChessGame();
    }

    syncSearchDeadline(searchDeadlineMs);
    if (shouldStopSearch()) {
        return { requestId, moveIndex, score: null, leafEvaluations: 0 };
    }
    setBrain43SearchContext(config || {}, pliesPlayed ?? 0);
    leafEvaluationsThisSearch = 0;
    rootEvalChess.loadGame(gameState);
    if (!Array.isArray(rootEvalChess.GameState.capturedPiecesList)) {
        rootEvalChess.GameState.capturedPiecesList = [];
    }
    applyRuntimeConfigForGame(rootEvalChess);
    rootEvalChess.SearchMode = true;
    const searchAlpha = Number.isFinite(alpha) ? alpha : -Infinity;
    const searchBeta = Number.isFinite(beta) ? beta : Infinity;
    const score = evaluateSearchMove(
        rootEvalChess,
        move,
        depthAfterRoot,
        searchAlpha,
        searchBeta,
        1,
    );
    rootEvalChess.SearchMode = false;
    return {
        requestId,
        moveIndex,
        score: Number.isFinite(score) ? score : null,
        leafEvaluations: leafEvaluationsThisSearch,
    };
}

exports.evaluateRootMoveInWorker = evaluateRootMoveInWorker;

let workerChess = null;

if (!isMainThread) {
    if (!workerChess) {
        workerChess = new ChessGame();
    }

    console.log(`${LOG_PREFIX} worker thread initialized`);

    parentPort.on("message", (request) => {
        if (handleWorkerAbortMessage(request)) {
            return;
        }
        const {
            requestId,
            gameState,
            thinkingTimeMs: requestThinkingTimeMs,
            maxDepth: requestMaxDepth,
            config,
            pliesPlayed,
        } = request;

        if (!requestId || !gameState) {
            console.error(`${LOG_PREFIX} Worker received invalid request`, request);
            parentPort.postMessage({ requestId: request?.requestId || 0, error: "Invalid request format" });
            return;
        }

        setWorkerSearchRequestId(requestId);

        (async () => {
            const maxDepth = requestMaxDepth != null
                ? Math.min(MAX_SEARCH_DEPTH, Math.max(1, Number(requestMaxDepth)))
                : DEFAULT_MAX_DEPTH;
            const thinkingTimeMs = requestThinkingTimeMs != null && Number(requestThinkingTimeMs) > 0
                ? Math.floor(Number(requestThinkingTimeMs))
                : null;
            setBrain43SearchContext(config || {}, pliesPlayed ?? 0);
            const startTime = Date.now();

            try {
                workerChess.loadGame(gameState);
                if (!Array.isArray(workerChess.GameState.capturedPiecesList)) {
                    workerChess.GameState.capturedPiecesList = [];
                }
                const searchOptions = {
                    config: brain43FullConfig,
                    pliesPlayed: pliesPlayed ?? 0,
                };
                if (thinkingTimeMs != null) {
                    searchOptions.thinkingTimeMs = thinkingTimeMs;
                } else {
                    searchOptions.maxDepth = maxDepth;
                }

                const move = await runBrain43SearchLocal(workerChess, searchOptions);
                let out = move;
                if (!out || out.source == null) {
                    out = getFirstLegalMove(workerChess);
                    if (out) {
                        out.searchDepthReached = 0;
                    }
                    console.error(`${LOG_PREFIX} Worker: search returned empty; first legal fallback`);
                } else {
                    const v = workerChess.validateMove(out.source, out.target, workerChess.Turn);
                    if (!v.valid) {
                        out = getFirstLegalMove(workerChess);
                        if (out) {
                            out.searchDepthReached = 0;
                        }
                        console.error(`${LOG_PREFIX} Worker: chosen move failed validateMove; first legal fallback`, out);
                    }
                }

                const duration = Date.now() - startTime;
                const depthReached = out && out.searchDepthReached != null ? out.searchDepthReached : "?";
                console.log(
                    `${LOG_PREFIX} request=${requestId} done in ${duration}ms, `
                        + `depth=${depthReached}, move=${bookMovePgn(workerChess, out)}, `
                        + `leaf evaluations=${leafEvaluationsThisSearch}`,
                );

                if (out && out.source != null) {
                    out.turn = workerChess.Turn;
                    parentPort.postMessage({ requestId, move: out });
                } else {
                    parentPort.postMessage({ requestId, error: "No move found" });
                }
            } catch (err) {
                const duration = Date.now() - startTime;
                console.error(
                    `${LOG_PREFIX} Worker error request=${requestId} after ${duration}ms `
                        + `(leaf evaluations before error: ${leafEvaluationsThisSearch}):`,
                    err,
                );
                parentPort.postMessage({ requestId, error: err.message || "Unknown error in worker thread" });
            }
        })();
    });
}
