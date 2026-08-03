/**
 * Shmerling desktop local server (no MongoDB). Started by Electron main process.
 * Serves static UI + bookmarks/themes APIs. Game + brain run in-process via Electron IPC.
 */
process.env.SHMERLING_MODE = "desktop";

const runtime = require("./src/desktop/runtime");

if (!process.env.SHMERLING_USER_DATA) {
    console.error("[desktop] SHMERLING_USER_DATA is not set");
    process.exit(1);
}

runtime.init({ userDataPath: process.env.SHMERLING_USER_DATA });

const { preloadOpeningBookAtStartup } = require("./src/desktop/preloadOpeningBook");

async function startDesktopServer() {
    await preloadOpeningBookAtStartup();

    const app = require("./src/app-desktop.js");

    const PORT = Number(process.env.PORT) || 0;
    const HOST = "127.0.0.1";

    const server = app.listen(PORT, HOST, () => {
        const address = server.address();
        const boundPort = typeof address === "object" && address ? address.port : PORT;
        console.log(`[desktop] Shmerling listening on http://${HOST}:${boundPort}`);
        if (process.send) {
            process.send({ type: "ready", port: boundPort, host: HOST });
        }
    });

    server.on("error", (err) => {
        console.error("[desktop] Server error:", err);
        process.exit(1);
    });
}

startDesktopServer().catch((err) => {
    console.error("[desktop] Failed to start:", err);
    process.exit(1);
});
