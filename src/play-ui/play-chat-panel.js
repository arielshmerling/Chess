/**
 * Prefer-Play right-dock chat presentation (online / watch).
 */
(function (global) {
    "use strict";

    /**
     * @param {HTMLElement|null} messagesEl
     * @param {{ username: string, text: string, mine?: boolean }} entry
     */
    function appendMessage(messagesEl, entry) {
        if (!messagesEl || !entry) {
            return;
        }
        const doc = messagesEl.ownerDocument || (typeof document !== "undefined" ? document : null);
        if (!doc) {
            return;
        }
        const row = doc.createElement("div");
        row.className = "desktop-play-chat-line";
        if (entry.mine) {
            row.classList.add("desktop-play-chat-line--mine");
        }
        const who = doc.createElement("span");
        who.className = "desktop-play-chat-who";
        who.textContent = entry.username ? String(entry.username) : "";
        const body = doc.createElement("span");
        body.className = "desktop-play-chat-text";
        body.textContent = entry.text != null ? String(entry.text) : "";
        row.appendChild(who);
        row.appendChild(doc.createTextNode(": "));
        row.appendChild(body);
        messagesEl.appendChild(row);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    /**
     * @param {HTMLElement|null} messagesEl
     */
    function clear(messagesEl) {
        if (messagesEl) {
            messagesEl.innerHTML = "";
        }
    }

    /**
     * @param {object} elements
     * @param {HTMLElement|null} [elements.gamesDock]
     * @param {HTMLElement|null} [elements.chatDock]
     * @param {HTMLElement|null} [elements.sidebar]
     * @param {HTMLElement|null} [elements.body]
     * @param {HTMLElement|null} [elements.chatInput]
     * @param {"games"|"chat"|"hidden"} mode
     * @param {{ readOnly?: boolean }} [opts]
     */
    function setRightDockMode(elements, mode, opts) {
        const els = elements || {};
        const options = opts || {};
        const m = mode === "chat" || mode === "games" ? mode : "hidden";
        const showSidebar = m !== "hidden";

        if (els.sidebar) {
            els.sidebar.hidden = !showSidebar;
            els.sidebar.setAttribute("aria-hidden", showSidebar ? "false" : "true");
            els.sidebar.style.display = showSidebar ? "" : "none";
            els.sidebar.classList.toggle("desktop-play-sidebar--chat", m === "chat");
            els.sidebar.classList.toggle("desktop-play-sidebar--games", m === "games");
        }
        if (els.body) {
            els.body.classList.toggle("desktop-play-no-games-panel", !showSidebar);
            els.body.classList.toggle("desktop-play-chat-active", m === "chat");
        }
        if (els.gamesDock) {
            const showGames = m === "games";
            els.gamesDock.hidden = !showGames;
            els.gamesDock.setAttribute("aria-hidden", showGames ? "false" : "true");
            els.gamesDock.style.display = showGames ? "" : "none";
        }
        if (els.chatDock) {
            const showChat = m === "chat";
            els.chatDock.hidden = !showChat;
            els.chatDock.setAttribute("aria-hidden", showChat ? "false" : "true");
            els.chatDock.style.display = showChat ? "" : "none";
        }
        if (els.chatInput) {
            els.chatInput.disabled = !!options.readOnly || m !== "chat";
            if (options.readOnly) {
                els.chatInput.setAttribute("readonly", "readonly");
            } else {
                els.chatInput.removeAttribute("readonly");
            }
        }
    }

    const api = {
        appendMessage: appendMessage,
        clear: clear,
        setRightDockMode: setRightDockMode,
    };

    global.PlayChatPanel = api;
    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
