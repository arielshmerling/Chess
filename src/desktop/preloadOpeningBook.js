/**
 * Desktop startup: sync opening-book path and load brain42/brain43 books before any game is created.
 */

const { syncDesktopPathsForSharedModules } = require("./syncDataPaths");

function preloadOpeningBookAtStartup() {
    syncDesktopPathsForSharedModules();
    const brain42 = require("../brain42");
    const brain43 = require("../brain43");
    brain42.preloadOpeningBook();
    brain43.preloadOpeningBook();
    return Promise.all([
        brain42.whenOpeningBookReady(),
        brain43.whenOpeningBookReady(),
    ]).then(
        () => {
            console.log("[desktop] Opening book ready");
        },
        (err) => {
            console.error("[desktop] Opening book preload failed:", err && err.message ? err.message : err);
        },
    );
}

module.exports = { preloadOpeningBookAtStartup };
