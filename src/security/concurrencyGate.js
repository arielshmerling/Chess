/**
 * In-process concurrency gate for CPU-heavy work (engine searches).
 *
 * Caps how much expensive work one caller — and the process as a whole — can have
 * in flight at once, so a single authenticated client cannot exhaust server CPU.
 * Single-process only; a multi-instance deploy needs a shared coordinator.
 */

/** A caller already has its own maximum number of jobs running. */
const BUSY_KEY = "CONCURRENCY_BUSY_KEY";
/** The process is saturated across all callers. */
const BUSY_GLOBAL = "CONCURRENCY_BUSY_GLOBAL";
/** The job outran its wall-clock budget (the job itself keeps its slot until it settles). */
const TIMEOUT = "CONCURRENCY_TIMEOUT";

/**
 * @param {string} code
 * @param {string} message
 * @returns {Error & { code: string }}
 */
function gateError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * @param {object} [opts]
 * @param {number} [opts.perKeyMax=1] Jobs allowed per key (e.g. per user).
 * @param {number} [opts.globalMax=4] Jobs allowed across all keys.
 * @param {number} [opts.timeoutMs=0] Wall-clock budget per job; 0 disables.
 * @param {string} [opts.keyMessage]
 * @param {string} [opts.globalMessage]
 * @param {string} [opts.timeoutMessage]
 */
function createConcurrencyGate(opts) {
    const options = opts || {};
    const perKeyMax = Math.max(1, Number(options.perKeyMax) || 1);
    const globalMax = Math.max(perKeyMax, Number(options.globalMax) || perKeyMax);
    const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 0;
    const keyMessage = options.keyMessage || "A request is already in progress. Wait for it to finish.";
    const globalMessage = options.globalMessage || "The server is busy. Try again in a moment.";
    const timeoutMessage = options.timeoutMessage || "The request took too long and was abandoned.";

    /** @type {Map<string, number>} */
    const activeByKey = new Map();
    let activeTotal = 0;

    /**
     * Reserve a slot, or throw a typed error when either cap is reached.
     * Per-key is checked first so a caller flooding on its own gets the
     * "you are already busy" answer rather than blaming global load.
     *
     * @param {string} key
     * @returns {() => void} Idempotent release function.
     */
    function acquire(key) {
        const id = String(key == null || key === "" ? "unknown" : key);
        const current = activeByKey.get(id) || 0;
        if (current >= perKeyMax) {
            throw gateError(BUSY_KEY, keyMessage);
        }
        if (activeTotal >= globalMax) {
            throw gateError(BUSY_GLOBAL, globalMessage);
        }
        activeByKey.set(id, current + 1);
        activeTotal += 1;

        let released = false;
        return function release() {
            if (released) {
                return;
            }
            released = true;
            const remaining = (activeByKey.get(id) || 1) - 1;
            if (remaining > 0) {
                activeByKey.set(id, remaining);
            } else {
                activeByKey.delete(id);
            }
            activeTotal = Math.max(0, activeTotal - 1);
        };
    }

    /**
     * Run `fn` under the gate.
     *
     * The slot is held until the underlying work actually settles, even if the
     * caller has already given up on a timeout. That keeps the process from
     * admitting more work than the caps allow while a slow job is still burning CPU.
     *
     * @template T
     * @param {string} key
     * @param {() => Promise<T>|T} fn
     * @returns {Promise<T>}
     */
    async function run(key, fn) {
        const release = acquire(key);
        const work = (async function () {
            return fn();
        })();
        work.then(release, release);

        if (!timeoutMs) {
            return work;
        }

        let timer = null;
        const budget = new Promise(function (_resolve, reject) {
            timer = setTimeout(function () {
                reject(gateError(TIMEOUT, timeoutMessage));
            }, timeoutMs);
        });
        try {
            return await Promise.race([work, budget]);
        } finally {
            clearTimeout(timer);
        }
    }

    return {
        run: run,
        /** @returns {{ activeTotal: number, activeKeys: number, perKeyMax: number, globalMax: number }} */
        stats: function stats() {
            return {
                activeTotal: activeTotal,
                activeKeys: activeByKey.size,
                perKeyMax: perKeyMax,
                globalMax: globalMax,
            };
        },
        /** Drop all counters. Tests only — in-flight work is not cancelled. */
        reset: function reset() {
            activeByKey.clear();
            activeTotal = 0;
        },
    };
}

module.exports = {
    createConcurrencyGate,
    BUSY_KEY,
    BUSY_GLOBAL,
    TIMEOUT,
};
