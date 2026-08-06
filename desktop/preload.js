/**
 * Electron preload — exposes safe IPC to the renderer.
 * Only allowlisted channels may be invoked (SEC-03).
 */
const { contextBridge, ipcRenderer } = require("electron");
const { isInvokeAllowed, isOnAllowed } = require("./ipcChannels");

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
