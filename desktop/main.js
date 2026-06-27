/**
 * Shmerling Chess — Electron main process.
 */
const { app, BrowserWindow, Menu, nativeImage, ipcMain, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

const APP_NAME = "Shmerling Chess";

/** Real filesystem path for files unpacked from app.asar (required for workers). */
function toUnpackedPath(filePath) {
    if (!app.isPackaged || !filePath.includes(".asar")) {
        return filePath;
    }
    return filePath.replace(/\.asar([\\/])/, ".asar.unpacked$1");
}

/** Dev: prefer live repo source so code changes apply without re-staging. Packaged: app-bundle only. */
function resolveBundleRoot() {
    if (app.isPackaged) {
        const candidates = [
            path.join(process.resourcesPath, "app.asar.unpacked", "app-bundle"),
            toUnpackedPath(path.join(__dirname, "app-bundle")),
        ];
        for (const candidate of candidates) {
            if (fs.existsSync(path.join(candidate, "server-desktop.js"))) {
                return candidate;
            }
        }
        throw new Error(
            "Desktop server bundle not found. Run Shmerling Chess.exe from the full install folder (must include app.asar.unpacked)."
        );
    }
    const repoRoot = path.join(__dirname, "..");
    if (fs.existsSync(path.join(repoRoot, "server-desktop.js"))) {
        return repoRoot;
    }
    const staged = path.join(__dirname, "app-bundle");
    if (fs.existsSync(path.join(staged, "server-desktop.js"))) {
        return staged;
    }
    return repoRoot;
}


function resolvePreloadPath() {
    const packaged = path.join(__dirname, "preload.js");
    if (fs.existsSync(packaged)) {
        return packaged;
    }
    return path.join(__dirname, "preload.js");
}
const ICON_PNG = path.join(__dirname, "build", "icon.png");
const ICON_ICNS = path.join(__dirname, "build", "icon.icns");
const ICON_ICO = path.join(__dirname, "build", "icon.ico");
const FAVICON = path.join(resolveBundleRoot(), "src", "favicon.ico");

let mainWindow = null;
let httpServer = null;
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

function stopLocalServer() {
    if (httpServer) {
        httpServer.close();
        httpServer = null;
    }
}

/** Start Express in the main process (fork + ELECTRON_RUN_AS_NODE is unreliable on Windows). */
async function startLocalServer() {
    const bundleRoot = resolveBundleRoot();
    const expressApp = require(path.join(bundleRoot, "src/app-desktop.js"));
    const host = "127.0.0.1";

    return new Promise((resolve, reject) => {
        const server = expressApp.listen(0, host, () => {
            const address = server.address();
            const boundPort = typeof address === "object" && address ? address.port : 0;
            console.log(`[desktop] Shmerling listening on http://${host}:${boundPort}`);
            serverPort = boundPort;
            httpServer = server;
            resolve(boundPort);
        });
        server.on("error", reject);
    });
}

function initDesktopBrainIpc() {
    process.env.SHMERLING_MODE = "desktop";
    process.env.SHMERLING_USER_DATA = app.getPath("userData");
    process.env.SHMERLING_SYNC_CUSTOM_THEMES = app.isPackaged ? "" : "1";
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || "shmerling-desktop-local-session";
    process.env.NODE_ENV = process.env.NODE_ENV || "production";
    const bundleRoot = resolveBundleRoot();
    const runtime = require(path.join(bundleRoot, "src/desktop/runtime"));
    const { computeMove, evaluatePosition } = require(path.join(bundleRoot, "src/desktop/desktopBrainService"));
    const { preloadOpeningBookAtStartup } = require(path.join(bundleRoot, "src/desktop/preloadOpeningBook"));

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
        width: 1440,
        height: 960,
        minWidth: 960,
        minHeight: 720,
        title: APP_NAME,
        icon: icon.isEmpty() ? undefined : icon,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: resolvePreloadPath(),
        },
    });

    mainWindow.loadURL(`http://127.0.0.1:${serverPort}/app/`);

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    mainWindow.on("close", () => {
        stopLocalServer();
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
        dialog.showErrorBox(
            APP_NAME,
            `Failed to start:\n\n${err && err.message ? err.message : String(err)}`
        );
        app.quit();
    }
});

/** Quit fully when the window closes (including on macOS). */
app.on("window-all-closed", () => {
    app.quit();
});

app.on("before-quit", () => {
    stopLocalServer();
});
