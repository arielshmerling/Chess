/**
 * Browser WebSocket MatchTransport (Phase 3).
 *
 * Injectable WebSocket constructor for Node tests.
 */
(function (global) {
    "use strict";

    /**
     * @param {object} [options]
     * @param {typeof WebSocket} [options.WebSocket]
     * @param {string} [options.protocol] - subprotocol (default protocolOne)
     */
    function create(options) {
        const opts = options || {};
        const WS =
            opts.WebSocket ||
            (typeof global.WebSocket !== "undefined" ? global.WebSocket : null);

        let socket = null;
        let messageHandler = null;
        let openHandler = null;
        let closeHandler = null;
        let errorHandler = null;
        const pending = [];

        function flushPending() {
            if (!socket || socket.readyState !== 1) {
                return;
            }
            while (pending.length) {
                const msg = pending.shift();
                try {
                    socket.send(typeof msg === "string" ? msg : JSON.stringify(msg));
                } catch {
                    /* ignore send errors */
                }
            }
        }

        function connect(url) {
            if (!WS) {
                throw new Error("WebSocket is not available");
            }
            close();
            const protocol = opts.protocol != null ? opts.protocol : "protocolOne";
            socket = protocol ? new WS(url, protocol) : new WS(url);

            socket.onopen = function () {
                flushPending();
                if (typeof openHandler === "function") {
                    openHandler();
                }
            };
            socket.onmessage = function (event) {
                if (typeof messageHandler !== "function") {
                    return;
                }
                let parsed = event && event.data;
                if (typeof parsed === "string") {
                    try {
                        parsed = JSON.parse(parsed);
                    } catch {
                        /* keep raw string */
                    }
                }
                messageHandler(parsed);
            };
            socket.onclose = function () {
                socket = null;
                if (typeof closeHandler === "function") {
                    closeHandler();
                }
            };
            socket.onerror = function () {
                if (typeof errorHandler === "function") {
                    errorHandler(new Error("WebSocket error"));
                }
            };
        }

        function close() {
            if (!socket) {
                pending.length = 0;
                return;
            }
            try {
                socket.onopen = null;
                socket.onmessage = null;
                socket.onclose = null;
                socket.onerror = null;
                socket.close();
            } catch {
                /* ignore */
            }
            socket = null;
            pending.length = 0;
        }

        function send(message) {
            if (!socket || socket.readyState !== 1) {
                pending.push(message);
                return;
            }
            try {
                socket.send(
                    typeof message === "string" ? message : JSON.stringify(message),
                );
            } catch (err) {
                if (typeof errorHandler === "function") {
                    errorHandler(err instanceof Error ? err : new Error(String(err)));
                }
            }
        }

        function onMessage(handler) {
            messageHandler = handler;
        }

        function onOpen(handler) {
            openHandler = handler;
        }

        function onClose(handler) {
            closeHandler = handler;
        }

        function onError(handler) {
            errorHandler = handler;
        }

        function isOpen() {
            return !!(socket && socket.readyState === 1);
        }

        return {
            connect: connect,
            close: close,
            send: send,
            onMessage: onMessage,
            onOpen: onOpen,
            onClose: onClose,
            onError: onError,
            isOpen: isOpen,
        };
    }

    /**
     * Default /ws URL for the current page origin.
     * @param {{ protocol?: string, host?: string }} [loc]
     */
    function defaultWsUrl(loc) {
        const location =
            loc ||
            (typeof global.location !== "undefined" ? global.location : null);
        if (!location || !location.host) {
            return "ws://localhost/ws";
        }
        const protocol =
            location.protocol === "https:" ? "wss:" : "ws:";
        return protocol + "//" + location.host + "/ws";
    }

    const WsTransport = {
        create: create,
        defaultWsUrl: defaultWsUrl,
    };

    global.ShmerlingWsTransport = WsTransport;

    if (typeof module === "object" && module && module.exports) {
        module.exports = WsTransport;
    }
})(typeof window !== "undefined" ? window : globalThis);
