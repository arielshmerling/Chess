/**
 * Lightweight worker entry for parallel root-move evaluation (Brain 4.3).
 * Keeps the heavy search module off the worker bootstrap path.
 */
const { parentPort } = require("worker_threads");
const { evaluateRootMoveInWorker } = require("./brain43");

parentPort.on("message", (request) => {
    try {
        parentPort.postMessage(evaluateRootMoveInWorker(request));
    } catch (err) {
        parentPort.postMessage({
            requestId: request?.requestId,
            moveIndex: request?.moveIndex,
            score: null,
            leafEvaluations: 0,
            error: err.message || "Root eval error",
        });
    }
});
