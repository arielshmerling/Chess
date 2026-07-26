/**
 * Tiny pub/sub used by GameSession (Phase 2).
 */
(function (global) {
    "use strict";

    function createEventBus() {
        /** @type {Object.<string, Array<Function>>} */
        const listeners = Object.create(null);

        function on(event, handler) {
            if (!event || typeof handler !== "function") {
                return function () {};
            }
            if (!listeners[event]) {
                listeners[event] = [];
            }
            listeners[event].push(handler);
            return function off() {
                const list = listeners[event];
                if (!list) {
                    return;
                }
                const idx = list.indexOf(handler);
                if (idx !== -1) {
                    list.splice(idx, 1);
                }
            };
        }

        function emit(event) {
            const list = listeners[event];
            if (!list || !list.length) {
                return;
            }
            const args = Array.prototype.slice.call(arguments, 1);
            list.slice().forEach(function (handler) {
                handler.apply(null, args);
            });
        }

        function clear() {
            Object.keys(listeners).forEach(function (key) {
                delete listeners[key];
            });
        }

        return {
            on: on,
            emit: emit,
            clear: clear,
        };
    }

    const api = { create: createEventBus };

    global.ShmerlingSessionEventBus = api;

    if (typeof module === "object" && module && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
