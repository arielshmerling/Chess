/**
 * Persist completed games to the desktop PGN log (Electron IPC).
 */
(function () {
    "use strict";

    async function appendCompletedGame(record) {
        if (window.shmerling && typeof window.shmerling.invoke === "function") {
            return window.shmerling.invoke("game:appendPgn", record);
        }
        return null;
    }

    async function openGamesLogFolder() {
        if (window.shmerling && typeof window.shmerling.invoke === "function") {
            return window.shmerling.invoke("game:openPgnFolder");
        }
        return null;
    }

    window.DesktopGameLog = {
        appendCompletedGame,
        openGamesLogFolder,
    };
})();
