/**
 * Play shell detection shared by desktop (/app/play) and web (/play).
 */
(function (global) {
    "use strict";

    function pathname() {
        return (global.location && global.location.pathname) || "";
    }

    function isWebPlayPage() {
        const p = pathname();
        return p === "/play" || p.indexOf("/play/") === 0;
    }

    function isDesktopPlayPage() {
        const p = pathname();
        return p === "/app/play" || p.indexOf("/app/play/") === 0;
    }

    function isPlayShellPage() {
        return isWebPlayPage() || isDesktopPlayPage();
    }

    function isElectronPlayPage() {
        return !!(global.shmerling && typeof global.shmerling.invoke === "function");
    }

    function shouldPersistPlayPrefsToServer() {
        return isPlayShellPage();
    }

    function getPlayHomeHref() {
        return isWebPlayPage() ? "/home" : "/app/play";
    }

    global.ShmerlingPlayShell = {
        isWebPlayPage,
        isPlayShellPage,
        isElectronPlayPage,
        shouldPersistPlayPrefsToServer,
        getPlayHomeHref,
    };
})(window);
