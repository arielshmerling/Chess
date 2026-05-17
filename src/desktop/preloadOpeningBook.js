/**
 * Desktop startup: sync opening-book path and load brain42 book before any game is created.
 */

const { syncDesktopPathsForSharedModules } = require("./syncDataPaths");

function preloadOpeningBookAtStartup() {
    syncDesktopPathsForSharedModules();
    const brain42 = require("../brain42");
    brain42.preloadOpeningBook();
    return brain42.whenOpeningBookReady().then(
        () => {
            console.log("[desktop] Opening book ready");
        },
        (err) => {
            console.error("[desktop] Opening book preload failed:", err && err.message ? err.message : err);
        },
    );
}

module.exports = { preloadOpeningBookAtStartup };
