/**
 * Optional search-progress reporter for desktop UI (and tests).
 * In worker threads, posts progress to the parent; on the main thread, calls the registered reporter.
 *
 * Worker-thread console.log is block-buffered when stdout is piped (Electron / npm), so progress
 * messages must be emitted via postMessage and logged on the main thread for realtime output.
 */

const { isMainThread, parentPort } = require("worker_threads");

/** @type {((payload: object) => void)|null} */
let progressReporter = null;
let workerRequestId = 0;

function setSearchProgressReporter(fn) {
    progressReporter = typeof fn === "function" ? fn : null;
}

function clearSearchProgressReporter() {
    progressReporter = null;
}

function setWorkerSearchProgressRequestId(requestId) {
    workerRequestId = requestId;
}

function yieldToEventLoop() {
    return new Promise((resolve) => {
        setImmediate(resolve);
    });
}

/**
 * @param {{ type?: string, message?: string, depth?: number, bestMove?: string, score?: number|null }} payload
 */
function reportSearchProgress(payload) {
    if (!payload || typeof payload !== "object") {
        return;
    }
    if (!isMainThread && parentPort) {
        parentPort.postMessage({
            requestId: workerRequestId,
            progress: payload,
        });
        return;
    }
    if (progressReporter) {
        try {
            progressReporter(payload);
        } catch (err) {
            console.error("[brainSearchProgress] reporter error:", err);
        }
    }
}

/**
 * @param {string} logPrefix e.g. "[Brain4.3]"
 * @param {string} budgetLabel e.g. "time=10000ms" or "depth=4"
 * @param {string} [phase]
 * @param {number} [plies]
 * @param {number|string} [requestId]
 */
function reportSearchThinking(logPrefix, budgetLabel, phase, plies, requestId) {
    const requestLabel = requestId != null ? `request=${requestId}, ` : "";
    const phaseLabel = phase != null ? `, phase=${phase}` : "";
    const pliesLabel = plies != null ? `, plies=${plies}` : "";
    const message = `${logPrefix} Thinking... ${requestLabel}${budgetLabel}${phaseLabel}${pliesLabel}`;
    reportSearchProgress({ type: "thinking", message });
}

/**
 * @param {string} message
 * @param {string} [type]
 */
function reportSearchMessage(message, type = "info") {
    reportSearchProgress({ type, message });
}

/**
 * Log depth completion and stream to any registered progress reporter.
 * @param {string} logPrefix e.g. "[Brain4.2]"
 * @param {number} depth
 * @param {string} bestPgn
 * @param {number|null|undefined} score
 */
function reportDepthCompleted(logPrefix, depth, bestPgn, score) {
    const scoreLabel = score != null && Number.isFinite(score) ? score : "n/a";
    const message = `${logPrefix} Depth ${depth} completed, best=${bestPgn}, score=${scoreLabel}`;
    reportSearchProgress({
        type: "depth",
        depth,
        bestMove: bestPgn,
        score: score != null && Number.isFinite(score) ? score : null,
        message,
    });
}

/**
 * After posting progress from a worker, yield so the message port can deliver before more CPU work.
 */
async function flushWorkerProgress() {
    if (!isMainThread) {
        await yieldToEventLoop();
    }
}

module.exports = {
    setSearchProgressReporter,
    clearSearchProgressReporter,
    setWorkerSearchProgressRequestId,
    reportSearchProgress,
    reportSearchThinking,
    reportSearchMessage,
    reportDepthCompleted,
    flushWorkerProgress,
    yieldToEventLoop,
};
