/**
 * Electron preload — exposes safe IPC to the renderer.
 * Only allowlisted channels may be invoked (SEC-03).
 *
 * Allowlist is inlined so a broken relative require cannot prevent
 * window.shmerling from being exposed (Exit / engines / brain IPC).
 */
const { contextBridge, ipcRenderer } = require("electron");

const INVOKE_ALLOWLIST = [
    "engines:listPlay",
    "brain:computeMove",
    "brain:evaluatePosition",
    "brain:abortSearch",
    "game:appendPgn",
    "game:openPgnFolder",
    "app:quit",
];

const ON_ALLOWLIST = ["brain:searchProgress"];

function isInvokeAllowed(channel) {
    return INVOKE_ALLOWLIST.indexOf(channel) !== -1;
}

function isOnAllowed(channel) {
    return ON_ALLOWLIST.indexOf(channel) !== -1;
}

try {
    contextBridge.exposeInMainWorld("shmerling", {
        invoke: (channel, data) => {
            if (!isInvokeAllowed(channel)) {
                return Promise.reject(new Error("IPC channel not allowed: " + channel));
            }
            return ipcRenderer.invoke(channel, data);
        },
        on: (channel, callback) => {
            if (!isOnAllowed(channel)) {
                return () => {};
            }
            const listener = (_event, data) => callback(data);
            ipcRenderer.on(channel, listener);
            return () => ipcRenderer.removeListener(channel, listener);
        },
    });
} catch (err) {
    console.error("[preload] Failed to expose shmerling bridge:", err);
}
