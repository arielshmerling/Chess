/**
 * Prefer-Play right-dock mode policy (Games/Positions vs Chat vs hidden).
 *
 * Pure decision helper — the shell applies the result via PlayChatPanel /
 * DesktopDockPanels.
 */
(function (global) {
    "use strict";

    /**
     * @param {object} state
     * @param {boolean} [state.onlineSession] - online or watch OnlineMode attached
     * @param {boolean} [state.watcher]
     * @param {boolean} [state.canPlayAdvancedTools] - Admin/Partner games list
     * @param {boolean} [state.gameActive]
     * @param {boolean} [state.gameOver]
     * @returns {{ mode: "games"|"chat"|"hidden", readOnly: boolean, expandLocked: boolean }}
     */
    function resolve(state) {
        const s = state || {};
        if (s.onlineSession) {
            /* Participants get chat; watchers must not see player chat or games dock. */
            if (s.watcher) {
                return { mode: "hidden", readOnly: false, expandLocked: false };
            }
            return { mode: "chat", readOnly: false, expandLocked: false };
        }
        if (s.canPlayAdvancedTools) {
            const inProgress = !!s.gameActive && !s.gameOver;
            return {
                mode: "games",
                readOnly: false,
                /* Keep the dock visible (minimized) during SP/practice; lock expand. */
                expandLocked: inProgress,
            };
        }
        return { mode: "hidden", readOnly: false, expandLocked: false };
    }

    const api = { resolve: resolve };
    global.PlayRightDockMode = api;
    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
