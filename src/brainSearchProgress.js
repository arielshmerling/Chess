/**
 * Stream brain search progress from worker threads to the main thread / UI.
 */
const { isMainThread, parentPort } = require("worker_threads");
const { requestSearchAbort } = require("./brainSearchTime");

let workerRequestId = null;
const abortedRequestIds = new Set();

class SearchAbortedError extends Error {
    constructor(message = "Search aborted") {
        super(message);
        this.name = "SearchAbortedError";
    }
}

function isSearchAbortedError(err) {
    return !!(err && (err.name === "SearchAbortedError" || err.message === "Search aborted"));
}

function handleWorkerAbortMessage(request) {
    if (request && request.type === "abort") {
        requestSearchAbort();
        return true;
    }
    return false;
}

function cancelWorkerSearch(worker, pendingRequests, reason = "Search aborted") {
    requestSearchAbort();
    if (worker) {
        worker.postMessage({ type: "abort" });
    }
    for (const [requestId, pending] of pendingRequests.entries()) {
        abortedRequestIds.add(requestId);
        clearTimeout(pending.timeout);
        pending.reject(new SearchAbortedError(reason));
        pendingRequests.delete(requestId);
    }
}

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
    if (abortedRequestIds.has(response.requestId)) {
        return true;
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
    SearchAbortedError,
    isSearchAbortedError,
    handleWorkerAbortMessage,
    cancelWorkerSearch,
};
