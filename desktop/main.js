/**
 * Shmerling Chess — Electron main process.
 */
const { app, BrowserWindow, Menu, nativeImage, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const { fork } = require("child_process");

const PRELOAD_PATH = path.join(__dirname, "preload.js");

const APP_NAME = "Shmerling Chess";
const SERVER_ENTRY = path.join(__dirname, "..", "server-desktop.js");
const ICON_PNG = path.join(__dirname, "build", "icon.png");
const ICON_ICNS = path.join(__dirname, "build", "icon.icns");
const ICON_ICO = path.join(__dirname, "build", "icon.ico");
const FAVICON = path.join(__dirname, "..", "src", "favicon.ico");

let mainWindow = null;
let serverProcess = null;
let serverPort = null;

if (process.platform === "darwin") {
    app.setName(APP_NAME);
    app.on("will-finish-launching", () => {
        app.setName(APP_NAME);
    });
}

function resolveAppIcon() {
    if (fs.existsSync(ICON_PNG)) {
        return nativeImage.createFromPath(ICON_PNG);
    }
    if (fs.existsSync(ICON_ICO)) {
        return nativeImage.createFromPath(ICON_ICO);
    }
    if (fs.existsSync(FAVICON)) {
        return nativeImage.createFromPath(FAVICON);
    }
    return nativeImage.createEmpty();
}

/** Absolute path for macOS About panel (prefers .icns). */
function resolveAboutIconPath() {
    if (process.platform === "darwin" && fs.existsSync(ICON_ICNS)) {
        return path.resolve(ICON_ICNS);
    }
    if (fs.existsSync(ICON_PNG)) {
        return path.resolve(ICON_PNG);
    }
    return undefined;
}

function applyAppIcon() {
    const icon = resolveAppIcon();
    if (icon.isEmpty()) {
        return;
    }
    if (process.platform === "darwin" && app.dock) {
        app.dock.setIcon(icon);
    }
}

function showAboutPanel() {
    const iconPath = resolveAboutIconPath();
    app.setAboutPanelOptions({
        applicationName: APP_NAME,
        applicationVersion: app.getVersion(),
        version: app.getVersion(),
        copyright: "Shmerling Chess",
        ...(iconPath ? { iconPath } : {}),
    });
    app.showAboutPanel();
}

/** First menu item label = app name in the macOS menu bar. */
function setupMacApplicationMenu() {
    if (process.platform !== "darwin") {
        return;
    }

    const template = [
        {
            label: APP_NAME,
            submenu: [
                {
                    label: `About ${APP_NAME}`,
                    click: () => showAboutPanel(),
                },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
            ],
        },
        { role: "editMenu" },
        { role: "viewMenu" },
        { role: "windowMenu" },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function startLocalServer() {
    return new Promise((resolve, reject) => {
        serverProcess = fork(SERVER_ENTRY, [], {
            env: {
                ...process.env,
                SHMERLING_MODE: "desktop",
                SHMERLING_USER_DATA: app.getPath("userData"),
                SHMERLING_SYNC_CUSTOM_THEMES: app.isPackaged ? "" : "1",
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

function initDesktopBrainIpc() {
    process.env.SHMERLING_MODE = "desktop";
    process.env.SHMERLING_USER_DATA = app.getPath("userData");
    const runtime = require("../src/desktop/runtime");
    const { computeMove, evaluatePosition } = require("../src/desktop/desktopBrainService");
    const { preloadOpeningBookAtStartup } = require("../src/desktop/preloadOpeningBook");

    runtime.init({ userDataPath: process.env.SHMERLING_USER_DATA });
    preloadOpeningBookAtStartup().catch((err) => {
        console.error("[desktop] Opening book preload in main:", err);
    });

    ipcMain.handle("brain:computeMove", async (_event, payload) => {
        return computeMove(payload);
    });

    ipcMain.handle("brain:evaluatePosition", async (_event, payload) => {
        return evaluatePosition(payload);
    });
}

function createWindow() {
    const icon = resolveAppIcon();
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        minWidth: 900,
        minHeight: 700,
        title: APP_NAME,
        icon: icon.isEmpty() ? undefined : icon,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: PRELOAD_PATH,
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
        setupMacApplicationMenu();
        applyAppIcon();
        initDesktopBrainIpc();
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
