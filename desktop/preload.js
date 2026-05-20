/**
 * Electron preload — exposes safe IPC to the renderer.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shmerling", {
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});
