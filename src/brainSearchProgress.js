/**
 * Stream brain search progress from worker threads to the main thread / UI.
 */
const { isMainThread, parentPort } = require("worker_threads");

let workerRequestId = null;

function setWorkerSearchRequestId(requestId) {
    workerRequestId = requestId;
}

function emitSearchProgress(message) {
    if (!message) {
        return;
    }
    if (!isMainThread && parentPort) {
        parentPort.postMessage({
            type: "progress",
            requestId: workerRequestId,
            message,
        });
        return;
    }
    console.log(message);
}

function dispatchWorkerProgressMessage(response, pendingRequests) {
    if (!response || response.type !== "progress" || response.requestId == null) {
        return false;
    }
    const pending = pendingRequests.get(response.requestId);
    if (pending && typeof pending.onProgress === "function") {
        pending.onProgress(response.message);
    } else {
        console.log(response.message);
    }
    return true;
}

module.exports = {
    setWorkerSearchRequestId,
    emitSearchProgress,
    dispatchWorkerProgressMessage,
};
