/**
 * Desktop AI — EnginePort facade over HTTP (web) or IPC (Electron).
 * Phase 9: transport lives in src/adapters/; this file only selects and exposes it.
 *
 * Transport is resolved lazily so a late-available preload bridge still wins
 * over the HTTP fallback (shared Play shell on /app/play).
 */
(function () {
    "use strict";

    function resolveIpc() {
        if (window.shmerling && typeof window.shmerling.invoke === "function") {
            return window.shmerling;
        }
        return null;
    }

    function isElectronPlayPage() {
        if (resolveIpc()) {
            return true;
        }
        return !!(
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.isElectronPlayPage === "function"
            && window.ShmerlingPlayShell.isElectronPlayPage()
        );
    }

    const factory = window.ShmerlingCreateEnginePort;
    if (!factory || typeof factory.create !== "function") {
        throw new Error("ShmerlingCreateEnginePort is required before desktop-engine.js");
    }

    let cachedPort = null;
    let cachedElectron = null;

    function getPort() {
        const electron = isElectronPlayPage();
        if (cachedPort && cachedElectron === electron) {
            return cachedPort;
        }
        cachedElectron = electron;
        cachedPort = factory.create({
            isElectron: electron,
            ipc: resolveIpc(),
            http: {},
        });
        return cachedPort;
    }

    window.DesktopEngine = {
        computeMove: function () {
            const port = getPort();
            return port.computeMove.apply(port, arguments);
        },
        evaluatePosition: function () {
            const port = getPort();
            return port.evaluatePosition.apply(port, arguments);
        },
        abortSearch: function () {
            const port = getPort();
            return port.abortSearch.apply(port, arguments);
        },
    };
})();
