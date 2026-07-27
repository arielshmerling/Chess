/**
 * Desktop AI — EnginePort facade over HTTP (web) or IPC (Electron).
 * Phase 9: transport lives in src/adapters/; this file only selects and exposes it.
 */
(function () {
    "use strict";

    function isElectronPlayPage() {
        return !!(
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.isElectronPlayPage === "function"
            && window.ShmerlingPlayShell.isElectronPlayPage()
        );
    }

    function resolveIpc() {
        if (window.shmerling && typeof window.shmerling.invoke === "function") {
            return window.shmerling;
        }
        return null;
    }

    const factory = window.ShmerlingCreateEnginePort;
    if (!factory || typeof factory.create !== "function") {
        throw new Error("ShmerlingCreateEnginePort is required before desktop-engine.js");
    }

    const port = factory.create({
        isElectron: isElectronPlayPage(),
        ipc: resolveIpc(),
        http: {},
    });

    window.DesktopEngine = {
        computeMove: port.computeMove,
        evaluatePosition: port.evaluatePosition,
        abortSearch: port.abortSearch,
    };
})();
