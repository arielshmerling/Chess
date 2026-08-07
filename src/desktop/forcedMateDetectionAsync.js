/**
 * Offload forced-loss mate detection to a worker_threads Worker so Electron main
 * (and the Node event loop) stay responsive during endgame thinking sessions.
 */
"use strict";

const path = require("path");
const { Worker } = require("worker_threads");
const {
    detectForcedLossMate,
    shouldRunForcedMateDetection,
} = require("./forcedMateDetection");

/** @type {import("worker_threads").Worker|null} */
let mateWorker = null;
let requestIdCounter = 0;
/** @type {Map<number, { resolve: Function, reject: Function }>} */
const pending = new Map();

function workerScriptPath() {
    return path.join(__dirname, "forcedMateDetectionWorker.js");
}

function settle(requestId, result, error) {
    const entry = pending.get(requestId);
    if (!entry) {
        return;
    }
    pending.delete(requestId);
    if (error) {
        entry.reject(error instanceof Error ? error : new Error(String(error)));
        return;
    }
    entry.resolve(result);
}

function rejectAllPending(error) {
    const ids = [...pending.keys()];
    for (const id of ids) {
        settle(id, null, error);
    }
}

function attachWorkerHandlers(worker) {
    worker.on("message", (msg) => {
        if (!msg || msg.requestId == null) {
            return;
        }
        if (msg.error) {
            settle(msg.requestId, null, msg.error);
            return;
        }
        settle(msg.requestId, msg.result || { detected: false }, null);
    });
    worker.on("error", (err) => {
        if (mateWorker !== worker) {
            return;
        }
        mateWorker = null;
        const message = err && err.message ? err.message : String(err);
        rejectAllPending(message);
    });
    worker.on("exit", (code) => {
        // Ignore exits from workers we already replaced or intentionally aborted.
        if (mateWorker !== worker) {
            return;
        }
        mateWorker = null;
        if (pending.size === 0) {
            return;
        }
        rejectAllPending(`Forced mate worker exited (code=${code})`);
    });
}

function getOrCreateWorker() {
    if (mateWorker) {
        return mateWorker;
    }
    mateWorker = new Worker(workerScriptPath());
    attachWorkerHandlers(mateWorker);
    return mateWorker;
}

/**
 * Abort any in-flight forced-mate detection (e.g. user cancels search / app quit).
 */
function abortForcedMateDetection() {
    const worker = mateWorker;
    mateWorker = null;
    rejectAllPending(
        Object.assign(new Error("Search aborted"), { name: "SearchAbortedError" }),
    );
    if (worker) {
        try {
            worker.terminate();
        } catch {
            /* ignore */
        }
    }
}

/**
 * @param {import("../ChessGame")} game
 * @param {{ maxPlies?: number, sync?: boolean }} [opts]
 * @returns {Promise<{ detected: boolean, opponentMateIn?: number }>}
 */
async function detectForcedLossMateAsync(game, opts) {
    const options = opts || {};
    // Tests / callers can force the sync path.
    if (options.sync === true) {
        return detectForcedLossMate(game, options);
    }
    if (!game || game.GameOver || !shouldRunForcedMateDetection(game)) {
        return { detected: false };
    }

    let gameStateJson;
    try {
        gameStateJson = JSON.stringify(game.GameState);
    } catch {
        // Fall back to sync if serialization fails (should be rare).
        return detectForcedLossMate(game, options);
    }

    const requestId = ++requestIdCounter;
    return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        try {
            getOrCreateWorker().postMessage({
                requestId,
                gameStateJson,
                opts: {
                    maxPlies: options.maxPlies,
                },
            });
        } catch {
            pending.delete(requestId);
            // Worker spawn failed (e.g. restricted env) — keep behavior correct sync.
            try {
                resolve(detectForcedLossMate(game, options));
            } catch (syncErr) {
                reject(syncErr);
            }
        }
    });
}

module.exports = {
    detectForcedLossMateAsync,
    abortForcedMateDetection,
};
