/**
 * Shmerling — Electron main process.
 */
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { fork } = require("child_process");

const SERVER_ENTRY = path.join(__dirname, "..", "server-desktop.js");
let mainWindow = null;
let serverProcess = null;
let serverPort = null;

function startLocalServer() {
    return new Promise((resolve, reject) => {
        serverProcess = fork(SERVER_ENTRY, [], {
            env: {
                ...process.env,
                SHMERLING_MODE: "desktop",
                SHMERLING_USER_DATA: app.getPath("userData"),
                SESSION_SECRET: process.env.SESSION_SECRET || "shmerling-desktop-local-session",
                NODE_ENV: process.env.NODE_ENV || "production",
            },
            stdio: ["inherit", "inherit", "inherit", "ipc"],
        });

        const timeout = setTimeout(() => {
            reject(new Error("Desktop server did not become ready in time"));
        }, 60000);

        serverProcess.on("message", (msg) => {
            if (msg && msg.type === "ready" && msg.port) {
                clearTimeout(timeout);
                serverPort = msg.port;
                resolve(msg.port);
            }
        });

        serverProcess.on("error", reject);
        serverProcess.on("exit", (code) => {
            if (code !== 0 && code !== null) {
                console.error("[desktop] Server process exited:", code);
            }
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        minWidth: 900,
        minHeight: 700,
        title: "Shmerling",
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadURL(`http://127.0.0.1:${serverPort}/app/`);

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    mainWindow.on("close", () => {
        if (serverProcess) {
            serverProcess.kill();
            serverProcess = null;
        }
    });
}

app.whenReady().then(async () => {
    try {
        await startLocalServer();
        createWindow();
    } catch (err) {
        console.error("[desktop] Failed to start:", err);
        app.quit();
    }

});

/** Quit fully when the window closes (including on macOS). */
app.on("window-all-closed", () => {
    app.quit();
});

app.on("before-quit", () => {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
});
