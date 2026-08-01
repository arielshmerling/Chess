/**
 * Prefer-Play right-dock mode policy (Games/Positions vs Chat vs hidden).
 *
 * Pure decision helper — the shell applies the result via PlayChatPanel.
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
     * @returns {{ mode: "games"|"chat"|"hidden", readOnly: boolean }}
     */
    function resolve(state) {
        const s = state || {};
        /* Watchers must not see player chat — keep the right dock hidden. */
        if (s.onlineSession && !s.watcher) {
            return { mode: "chat", readOnly: false };
        }
        if (s.canPlayAdvancedTools && (!s.gameActive || !!s.gameOver)) {
            return { mode: "games", readOnly: false };
        }
        return { mode: "hidden", readOnly: false };
    }

    const api = { resolve: resolve };
    global.PlayRightDockMode = api;
    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
