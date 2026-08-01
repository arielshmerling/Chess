/**
 * Low-level UCI child process (stdin/stdout line protocol).
 */

"use strict";

const { spawn } = require("child_process");
const { EventEmitter } = require("events");

class SearchAbortedError extends Error {
    constructor() {
        super("Search aborted");
        this.name = "SearchAbortedError";
    }
}

/**
 * @param {string} command
 * @param {string[]} [args]
 * @param {{ spawnFn?: Function, idleTimeoutMs?: number }} [options]
 */
function createUciProcess(command, args, options) {
    const opts = options || {};
    const spawnFn = opts.spawnFn || spawn;
    const idleTimeoutMs =
        Number.isFinite(opts.idleTimeoutMs) && opts.idleTimeoutMs > 0
            ? opts.idleTimeoutMs
            : 120000;

    const emitter = new EventEmitter();
    let child = null;
    let buffer = "";
    let starting = null;
    let disposed = false;

    function emitLine(line) {
        const trimmed = String(line || "").replace(/\r$/, "");
        if (!trimmed) {
            return;
        }
        emitter.emit("line", trimmed);
    }

    function onData(chunk) {
        buffer += chunk.toString("utf8");
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            emitLine(line);
        }
    }

    function ensureStarted() {
        if (disposed) {
            return Promise.reject(new Error("UCI process disposed"));
        }
        if (child && !child.killed) {
            return Promise.resolve();
        }
        if (starting) {
            return starting;
        }
        starting = new Promise((resolve, reject) => {
            try {
                child = spawnFn(command, args || [], {
                    stdio: ["pipe", "pipe", "pipe"],
                });
            } catch (err) {
                starting = null;
                reject(err);
                return;
            }
            child.stdout.setEncoding("utf8");
            child.stderr.setEncoding("utf8");
            child.stdout.on("data", onData);
            child.stderr.on("data", () => {
                /* ignore engine stderr chatter */
            });
            child.on("error", (err) => {
                emitter.emit("error", err);
            });
            child.on("exit", () => {
                child = null;
                starting = null;
                emitter.emit("exit");
            });
            resolve();
        }).finally(() => {
            starting = null;
        });
        return starting;
    }

    function write(cmd) {
        if (!child || !child.stdin || child.stdin.destroyed) {
            throw new Error("UCI process not running");
        }
        child.stdin.write(String(cmd) + "\n");
    }

    /**
     * @param {string} cmd
     * @param {(line: string) => boolean} predicate
     * @param {{ timeoutMs?: number, abortSignal?: { aborted: boolean } }} [waitOpts]
     * @returns {Promise<string>}
     */
    function request(cmd, predicate, waitOpts) {
        const w = waitOpts || {};
        const timeoutMs =
            Number.isFinite(w.timeoutMs) && w.timeoutMs > 0 ? w.timeoutMs : idleTimeoutMs;
        const abortSignal = w.abortSignal || null;

        return ensureStarted().then(
            () =>
                new Promise((resolve, reject) => {
                    let settled = false;
                    const timer = setTimeout(() => {
                        cleanup();
                        reject(new Error(`UCI timeout waiting for response to: ${cmd}`));
                    }, timeoutMs);

                    const abortPoll =
                        abortSignal
                            ? setInterval(() => {
                                  if (abortSignal.aborted) {
                                      cleanup();
                                      reject(new SearchAbortedError());
                                  }
                              }, 50)
                            : null;

                    function onLine(line) {
                        if (abortSignal && abortSignal.aborted) {
                            cleanup();
                            reject(new SearchAbortedError());
                            return;
                        }
                        try {
                            if (predicate(line)) {
                                cleanup();
                                resolve(line);
                            }
                        } catch (err) {
                            cleanup();
                            reject(err);
                        }
                    }

                    function onError(err) {
                        cleanup();
                        reject(err);
                    }

                    function onExit() {
                        cleanup();
                        reject(new Error("UCI process exited"));
                    }

                    function cleanup() {
                        if (settled) {
                            return;
                        }
                        settled = true;
                        clearTimeout(timer);
                        if (abortPoll) {
                            clearInterval(abortPoll);
                        }
                        emitter.removeListener("line", onLine);
                        emitter.removeListener("error", onError);
                        emitter.removeListener("exit", onExit);
                    }

                    emitter.on("line", onLine);
                    emitter.on("error", onError);
                    emitter.on("exit", onExit);

                    try {
                        if (cmd) {
                            write(cmd);
                        }
                    } catch (err) {
                        cleanup();
                        reject(err);
                    }
                }),
        );
    }

    async function uciHandshake(timeoutMs) {
        const limit = timeoutMs || 8000;
        await ensureStarted();
        await request("uci", (line) => line === "uciok", { timeoutMs: limit });
        await request("isready", (line) => line === "readyok", { timeoutMs: limit });
        return true;
    }

    /**
     * @param {string} fen
     * @param {number} movetimeMs
     * @param {{ abortSignal?: { aborted: boolean } }} [goOpts]
     * @returns {Promise<string|null>}
     */
    async function goMovetime(fen, movetimeMs, goOpts) {
        const abortSignal = (goOpts && goOpts.abortSignal) || null;
        await ensureStarted();
        write("ucinewgame");
        await request("isready", (line) => line === "readyok", { abortSignal });
        write(`position fen ${fen}`);
        const ms = Math.max(1, Math.floor(Number(movetimeMs) || 1000));
        try {
            const line = await request(
                `go movetime ${ms}`,
                (l) => l.startsWith("bestmove "),
                {
                    timeoutMs: Math.max(idleTimeoutMs, ms + 15000),
                    abortSignal,
                },
            );
            const parts = line.split(/\s+/);
            const best = parts[1];
            if (!best || best === "(none)") {
                return null;
            }
            return best;
        } catch (err) {
            if (err && err.name === "SearchAbortedError") {
                stop();
            }
            throw err;
        }
    }

    function stop() {
        try {
            if (child && child.stdin && !child.stdin.destroyed) {
                write("stop");
            }
        } catch {
            /* ignore */
        }
    }

    function dispose() {
        disposed = true;
        try {
            if (child && child.stdin && !child.stdin.destroyed) {
                write("quit");
            }
        } catch {
            /* ignore */
        }
        try {
            if (child && !child.killed) {
                child.kill();
            }
        } catch {
            /* ignore */
        }
        child = null;
    }

    return {
        ensureStarted,
        write,
        request,
        uciHandshake,
        goMovetime,
        stop,
        dispose,
    };
}

module.exports = {
    createUciProcess,
    SearchAbortedError,
};
