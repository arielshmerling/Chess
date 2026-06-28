/**
 * Pool of worker threads for parallel root-move search (used by brain43).
 */
const { Worker } = require("worker_threads");
const os = require("os");

const ROOT_EVAL_ROLE = "rootEval";
const MAX_ROOT_WORKERS = Math.min(4, Math.max(1, (os.availableParallelism?.() || os.cpus().length || 2) - 1));

/**
 * @param {string} workerScript Absolute path to brain43.js
 */
function createRootWorkerPool(workerScript) {
    const workers = [];
    const idleWorkers = [];
    const waitQueue = [];
    const pending = new Map();

    function spawnWorker() {
        const worker = new Worker(workerScript);
        worker.on("message", (msg) => {
            const task = pending.get(msg.requestId);
            if (task) {
                pending.delete(msg.requestId);
                task.resolve(msg);
            }
            idleWorkers.push(worker);
            pump();
        });
        worker.on("error", (err) => {
            for (const [id, task] of pending.entries()) {
                if (task.worker === worker) {
                    pending.delete(id);
                    task.reject(err);
                }
            }
            const idx = workers.indexOf(worker);
            if (idx !== -1) {
                workers.splice(idx, 1);
            }
            const idleIdx = idleWorkers.indexOf(worker);
            if (idleIdx !== -1) {
                idleWorkers.splice(idleIdx, 1);
            }
            try {
                worker.terminate();
            } catch {
                /* ignore */
            }
            spawnWorker();
            pump();
        });
        workers.push(worker);
        idleWorkers.push(worker);
    }

    for (let i = 0; i < MAX_ROOT_WORKERS; i += 1) {
        spawnWorker();
    }

    function pump() {
        while (waitQueue.length > 0 && idleWorkers.length > 0) {
            const { payload, resolve, reject } = waitQueue.shift();
            dispatch(idleWorkers.pop(), payload, resolve, reject);
        }
    }

    function dispatch(worker, payload, resolve, reject) {
        pending.set(payload.requestId, { resolve, reject, worker });
        worker.postMessage(payload);
    }

    function runTask(payload) {
        return new Promise((resolve, reject) => {
            if (idleWorkers.length > 0) {
                dispatch(idleWorkers.pop(), payload, resolve, reject);
            } else {
                waitQueue.push({ payload, resolve, reject });
            }
        });
    }

    function terminate() {
        for (const worker of workers) {
            try {
                worker.terminate();
            } catch {
                /* ignore */
            }
        }
        workers.length = 0;
        idleWorkers.length = 0;
        waitQueue.length = 0;
        pending.clear();
    }

    return { runTask, terminate, maxWorkers: MAX_ROOT_WORKERS };
}

module.exports = {
    ROOT_EVAL_ROLE,
    MAX_ROOT_WORKERS,
    createRootWorkerPool,
};
