/**
 * Capture main-process console output for the desktop log window.
 */
const LOG_BUFFER_MAX = 5000;

/** @type {{ t: string, level: string, message: string }[]} */
const logBuffer = [];
/** @type {Set<import("electron").WebContents>} */
const subscribers = new Set();

let installed = false;

function formatArg(arg) {
    if (typeof arg === "string") {
        return arg;
    }
    if (arg instanceof Error) {
        return arg.stack || arg.message || String(arg);
    }
    if (typeof arg === "undefined") {
        return "undefined";
    }
    if (typeof arg === "symbol") {
        return arg.toString();
    }
    try {
        return JSON.stringify(arg);
    } catch {
        return String(arg);
    }
}

function formatMessage(args) {
    return args.map(formatArg).join(" ");
}

function appendLog(level, args) {
    const entry = {
        t: new Date().toISOString(),
        level,
        message: formatMessage(args),
    };
    logBuffer.push(entry);
    if (logBuffer.length > LOG_BUFFER_MAX) {
        logBuffer.splice(0, logBuffer.length - LOG_BUFFER_MAX);
    }
    for (const webContents of subscribers) {
        if (webContents.isDestroyed()) {
            subscribers.delete(webContents);
            continue;
        }
        webContents.send("log:append", entry);
    }
}

function isBrokenPipeError(err) {
    return Boolean(
        err
        && (err.code === "EPIPE" || err.code === "ECONNRESET" || err.code === "ERR_STREAM_DESTROYED"),
    );
}

/**
 * Windows GUI Electron often has no console; writing to a closed stdout/stderr pipe
 * throws EPIPE and shows the main-process "JavaScript error" dialog.
 */
function ignoreBrokenPipeOnStream(stream) {
    if (!stream || typeof stream.on !== "function") {
        return;
    }
    stream.on("error", (err) => {
        if (isBrokenPipeError(err)) {
            return;
        }
        // Avoid re-entering console capture for unexpected stream errors.
        try {
            process.emitWarning(err);
        } catch {
            /* ignore */
        }
    });
}

function installConsoleCapture() {
    if (installed) {
        return;
    }
    installed = true;
    ignoreBrokenPipeOnStream(process.stdout);
    ignoreBrokenPipeOnStream(process.stderr);
    for (const level of ["log", "info", "warn", "error", "debug"]) {
        const original = console[level].bind(console);
        console[level] = (...args) => {
            appendLog(level === "log" ? "info" : level, args);
            try {
                original(...args);
            } catch (err) {
                if (isBrokenPipeError(err)) {
                    return;
                }
                throw err;
            }
        };
    }
}

function getLogHistory() {
    return logBuffer.slice();
}

function subscribeLogWindow(webContents) {
    subscribers.add(webContents);
    webContents.once("destroyed", () => {
        subscribers.delete(webContents);
    });
}

module.exports = {
    installConsoleCapture,
    getLogHistory,
    subscribeLogWindow,
};
