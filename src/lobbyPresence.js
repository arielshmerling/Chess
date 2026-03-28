/**
 * One WebSocket per tab: lobby updates (home) + live friend presence (all logged-in pages).
 * Dispatches CustomEvent "site-ws-message" with parsed message as detail.
 */
(function () {
    "use strict";

    var ws = null;
    var reconnectDelayMs = 2000;
    var maxReconnectDelayMs = 30000;
    var reconnectTimer = null;
    /** True after a disconnect; next onopen means in-tab reconnect (not first load). */
    var closedWithoutNavigation = false;

    function getWsUrl() {
        var protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        return protocol + "//" + window.location.host + "/ws";
    }

    function dispatchMsg(msg) {
        try {
            window.dispatchEvent(new CustomEvent("site-ws-message", { detail: msg }));
        } catch {
            /* ignore */
        }
    }

    function dispatchWsReconnected() {
        try {
            window.dispatchEvent(new CustomEvent("site-ws-reconnected"));
        } catch {
            /* ignore */
        }
    }

    function clearReconnectTimer() {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    function scheduleReconnect() {
        clearReconnectTimer();
        reconnectTimer = setTimeout(function () {
            reconnectTimer = null;
            connect();
        }, reconnectDelayMs);
        reconnectDelayMs = Math.min(Math.floor(reconnectDelayMs * 1.5), maxReconnectDelayMs);
    }

    function connect() {
        try {
            ws = new WebSocket(getWsUrl(), "protocolOne");
        } catch {
            scheduleReconnect();
            return;
        }

        ws.onopen = function () {
            reconnectDelayMs = 2000;
            try {
                ws.send(JSON.stringify({ type: "subscribeLobby" }));
                ws.send(JSON.stringify({ type: "presenceSubscribe" }));
            } catch {
                /* ignore */
            }
            if (closedWithoutNavigation) {
                closedWithoutNavigation = false;
                dispatchWsReconnected();
            }
        };

        ws.onmessage = function (ev) {
            try {
                var msg = JSON.parse(ev.data);
                dispatchMsg(msg);
            } catch (e) {
                console.warn("site-ws-message parse error", e);
            }
        };

        ws.onclose = function () {
            closedWithoutNavigation = true;
            ws = null;
            scheduleReconnect();
        };

        ws.onerror = function () {
            /* onclose will reconnect */
        };
    }

    connect();
})();
