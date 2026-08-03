/**
 * Shmerling Chess — Electron main process.
 */
const { app, BrowserWindow, Menu, nativeImage, ipcMain, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const {
    installConsoleCapture,
    getLogHistory,
    subscribeLogWindow,
} = require("./serverLog");

installConsoleCapture();

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
let logWindow = null;
let httpServer = null;
let serverPort = null;
/** When false, Windows/Linux hide the menu bar; macOS keeps a minimal app menu. */
let applicationMenuVisible = false;
let fullApplicationMenu = null;

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

function showLogWindow() {
    if (logWindow && !logWindow.isDestroyed()) {
        if (logWindow.isMinimized()) {
            logWindow.restore();
        }
        logWindow.focus();
        return;
    }

    const icon = resolveAppIcon();
    logWindow = new BrowserWindow({
        width: 900,
        height: 640,
        minWidth: 480,
        minHeight: 320,
        title: `Server Log — ${APP_NAME}`,
        icon: icon.isEmpty() ? undefined : icon,
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, "log-preload.js"),
        },
    });

    subscribeLogWindow(logWindow.webContents);
    logWindow.loadFile(path.join(__dirname, "log-window.html"));
    logWindow.on("closed", () => {
        logWindow = null;
    });
}

/** First menu item label = app name in the macOS menu bar. */
function buildFullApplicationMenu() {
    const template = [];

    if (process.platform === "darwin") {
        template.push({
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
        });
    } else {
        template.push({
            label: "File",
            submenu: [{ role: "quit" }],
        });
    }

    template.push(
        { role: "editMenu" },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { role: "toggleDevTools" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" },
                { type: "separator" },
                {
                    label: "Show Log",
                    accelerator: "CmdOrCtrl+L",
                    click: () => showLogWindow(),
                },
            ],
        },
        { role: "windowMenu" },
    );
    return Menu.buildFromTemplate(template);
}

function buildMinimalMacMenu() {
    return Menu.buildFromTemplate([
        {
            label: APP_NAME,
            submenu: [
                {
                    label: `About ${APP_NAME}`,
                    click: () => showAboutPanel(),
                },
                { type: "separator" },
                { role: "quit" },
            ],
        },
    ]);
}

function setApplicationMenuVisible(visible) {
    applicationMenuVisible = visible;
    if (visible) {
        if (!fullApplicationMenu) {
            fullApplicationMenu = buildFullApplicationMenu();
        }
        Menu.setApplicationMenu(fullApplicationMenu);
        return;
    }
    if (process.platform === "darwin") {
        // macOS always needs an app menu for Quit / About.
        Menu.setApplicationMenu(buildMinimalMacMenu());
        return;
    }
    Menu.setApplicationMenu(null);
}

function toggleApplicationMenu() {
    setApplicationMenuVisible(!applicationMenuVisible);
}

function setupApplicationMenu() {
    setApplicationMenuVisible(false);
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

function stripPathQuotes(value) {
    let s = String(value || "").trim();
    if (
        (s.charAt(0) === '"' && s.charAt(s.length - 1) === '"')
        || (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'")
    ) {
        s = s.slice(1, -1).trim();
    }
    return s;
}

function readWindowsUserEnvVar(name) {
    if (process.platform !== "win32" || !name) {
        return "";
    }
    try {
        const { execFileSync } = require("child_process");
        const out = execFileSync(
            "reg",
            ["query", "HKCU\\Environment", "/v", String(name)],
            { encoding: "utf8", windowsHide: true },
        );
        const match = String(out).match(/REG_(?:EXPAND_)?SZ\s+(.+)\s*$/m);
        return match ? stripPathQuotes(match[1]) : "";
    } catch {
        return "";
    }
}

function applyStockfishPath(raw, sourceLabel) {
    const cleaned = stripPathQuotes(raw);
    if (!cleaned) {
        return false;
    }
    if (!fs.existsSync(cleaned)) {
        console.warn(`[desktop] STOCKFISH_PATH from ${sourceLabel} does not exist: ${cleaned}`);
        return false;
    }
    process.env.STOCKFISH_PATH = cleaned;
    console.log(`[desktop] STOCKFISH_PATH from ${sourceLabel}: ${cleaned}`);
    return true;
}

function loadDesktopStockfishPathHint(userDataPath) {
    // Prefer an explicit file next to the app profile — GUI launches often miss
    // newly set User env vars until sign-out. Filename may be anything.
    if (userDataPath) {
        const pathFiles = [
            path.join(userDataPath, "stockfish.path"),
            path.join(userDataPath, "engines", "stockfish.path"),
        ];
        for (let i = 0; i < pathFiles.length; i += 1) {
            try {
                if (!fs.existsSync(pathFiles[i])) {
                    continue;
                }
                const raw = fs.readFileSync(pathFiles[i], "utf8").trim().split(/\r?\n/)[0];
                if (applyStockfishPath(raw, pathFiles[i])) {
                    return;
                }
            } catch (err) {
                console.warn(
                    "[desktop] Could not read stockfish path file:",
                    err && err.message ? err.message : err,
                );
            }
        }

        const enginesDir = path.join(userDataPath, "engines");
        try {
            if (fs.existsSync(enginesDir)) {
                const entries = fs.readdirSync(enginesDir);
                const match = entries.find((name) => /stockfish/i.test(name));
                if (match) {
                    const full = path.join(enginesDir, match);
                    if (applyStockfishPath(full, "userData/engines")) {
                        return;
                    }
                }
            }
        } catch (err) {
            console.warn(
                "[desktop] Could not scan engines folder:",
                err && err.message ? err.message : err,
            );
        }
    }

    if (process.env.STOCKFISH_PATH && applyStockfishPath(process.env.STOCKFISH_PATH, "process.env")) {
        return;
    }

    const fromUserEnv = readWindowsUserEnvVar("STOCKFISH_PATH");
    if (fromUserEnv && applyStockfishPath(fromUserEnv, "HKCU\\Environment")) {
        return;
    }
}

function initDesktopBrainIpc() {
    process.env.SHMERLING_MODE = "desktop";
    process.env.SHMERLING_USER_DATA = app.getPath("userData");
    process.env.SHMERLING_APP_RESOURCES = process.resourcesPath || "";
    process.env.SHMERLING_SYNC_CUSTOM_THEMES = app.isPackaged ? "" : "1";
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || "shmerling-desktop-local-session";
    process.env.NODE_ENV = process.env.NODE_ENV || "production";
    loadDesktopStockfishPathHint(process.env.SHMERLING_USER_DATA);
    const bundleRoot = resolveBundleRoot();
    const runtime = require(path.join(bundleRoot, "src/desktop/runtime"));
    // Route through engineService so UCI engines (Stockfish) work the same as brains.
    const {
        computeMove,
        evaluatePosition,
        abortSearch,
        SearchAbortedError,
        listPlayEnginesForClient,
    } = require(path.join(bundleRoot, "src/engines/engineService"));
    const { appendCompletedGame, getGamesLogPath } = require(path.join(bundleRoot, "src/desktop/gameHistoryStore"));
    const { preloadOpeningBookAtStartup } = require(path.join(bundleRoot, "src/desktop/preloadOpeningBook"));

    runtime.init({ userDataPath: process.env.SHMERLING_USER_DATA });
    preloadOpeningBookAtStartup().catch((err) => {
        console.error("[desktop] Opening book preload in main:", err);
    });

    listPlayEnginesForClient()
        .then((engines) => {
            const sf = (engines || []).find((e) => e.id === "stockfish");
            if (sf && sf.available) {
                console.log("[desktop] Stockfish UCI available");
            } else {
                console.log(
                    "[desktop] Stockfish not available — set User env STOCKFISH_PATH to the full .exe path (any filename), or put that path in %APPDATA%\\Shmerling Chess\\stockfish.path, then fully quit and reopen the app",
                );
            }
        })
        .catch((err) => {
            console.warn("[desktop] Could not probe Play engines:", err && err.message ? err.message : err);
        });

    ipcMain.handle("log:getHistory", () => getLogHistory());

    ipcMain.handle("engines:listPlay", async () => {
        try {
            return await listPlayEnginesForClient();
        } catch (err) {
            console.warn("[desktop] engines:listPlay failed:", err && err.message ? err.message : err);
            return [];
        }
    });

    ipcMain.handle("brain:computeMove", async (event, payload) => {
        const sender = event.sender;
        try {
            return await computeMove(payload, (progress) => {
                if (sender.isDestroyed()) {
                    return;
                }
                sender.send("brain:searchProgress", progress);
            });
        } catch (err) {
            if (
                err instanceof SearchAbortedError
                || err?.name === "SearchAbortedError"
                || err?.message === "Search aborted"
            ) {
                return { searchAborted: true };
            }
            const msg = err && err.message ? String(err.message) : String(err);
            if (/ENOENT|not available|spawn /i.test(msg)) {
                throw new Error(
                    "Stockfish was not found on this PC. Install Stockfish, or set STOCKFISH_PATH / place stockfish.exe in your Shmerling userData engines folder.",
                );
            }
            throw err;
        }
    });

    ipcMain.handle("brain:evaluatePosition", async (_event, payload) => {
        return evaluatePosition(payload);
    });

    ipcMain.handle("brain:abortSearch", async () => {
        abortSearch();
        return { ok: true };
    });

    ipcMain.handle("game:appendPgn", async (_event, payload) => {
        const filePath = await appendCompletedGame(payload || {});
        return { ok: true, filePath };
    });

    ipcMain.handle("game:openPgnFolder", async () => {
        const filePath = getGamesLogPath();
        const dir = path.dirname(filePath);
        await fs.promises.mkdir(dir, { recursive: true });
        try {
            await fs.promises.access(filePath);
            shell.showItemInFolder(filePath);
        } catch {
            const openErr = await shell.openPath(dir);
            if (openErr) {
                throw new Error(openErr);
            }
        }
        return { ok: true, dir, filePath };
    });

    ipcMain.handle("app:quit", () => {
        app.quit();
        return { ok: true };
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
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: resolvePreloadPath(),
        },
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    mainWindow.webContents.on("before-input-event", (event, input) => {
        if (input.type !== "keyDown") {
            return;
        }
        if (input.key === "F12" && !input.control && !input.meta && !input.alt && !input.shift) {
            event.preventDefault();
            toggleApplicationMenu();
        }
    });

    mainWindow.loadURL(`http://127.0.0.1:${serverPort}/app/play`);

    mainWindow.on("closed", () => {
        mainWindow = null;
    });

    mainWindow.on("close", () => {
        stopLocalServer();
    });
}

app.whenReady().then(async () => {
    try {
        setupApplicationMenu();
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
