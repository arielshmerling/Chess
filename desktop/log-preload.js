/**
 * Preload for the server log window.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("serverLog", {
    getHistory: () => ipcRenderer.invoke("log:getHistory"),
    onAppend: (callback) => {
        const listener = (_event, entry) => callback(entry);
        ipcRenderer.on("log:append", listener);
        return () => ipcRenderer.removeListener("log:append", listener);
    },
});
