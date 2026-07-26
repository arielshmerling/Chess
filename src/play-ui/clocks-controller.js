/**
 * Player clocks: holds the two remaining-time counters, ticks the side to move,
 * and writes the formatted time into the header.
 *
 * Presentation only. The owner decides when a side is on the move, when the game
 * has stopped, and what happens when a clock runs out.
 */
(function (global) {
    "use strict";

    const COLORS = ["white", "black"];

    /**
     * @param {number} seconds
     * @returns {string} hh:mm:ss
     */
    function formatSeconds(seconds) {
        const d = new Date(1970, 0, 1);
        d.setSeconds(seconds);
        return d.toLocaleTimeString("eo", { hour12: false });
    }

    function isColor(color) {
        return COLORS.indexOf(color) !== -1;
    }

    /**
     * @param {object} options
     * @param {(color: "white"|"black") => (HTMLElement|null)} options.getElement
     *        Time element for a side, looked up per write so the panel may re-render.
     * @param {() => boolean} [options.isStopped] - True once the game is over; ticking then halts.
     * @param {(color: "white"|"black") => void} [options.onFlag] - A clock reached zero while playing.
     * @param {{ setInterval: Function, clearInterval: Function }} [options.timers] - Injectable for tests.
     */
    function create(options) {
        const opts = options || {};
        const getElement = opts.getElement || function () {
            return null;
        };
        const isStopped = opts.isStopped || function () {
            return false;
        };
        const onFlag = opts.onFlag || function () {};
        const timers = opts.timers || global;

        const seconds = { white: 0, black: 0 };
        const handles = { white: null, black: null };

        function renderColor(color) {
            const el = getElement(color);
            if (el) {
                el.textContent = formatSeconds(seconds[color]);
            }
        }

        function render() {
            renderColor("white");
            renderColor("black");
        }

        function stopColor(color) {
            if (handles[color]) {
                timers.clearInterval(handles[color]);
                handles[color] = null;
            }
        }

        function stop() {
            stopColor("white");
            stopColor("black");
        }

        function tick(color) {
            seconds[color] -= 1;
            renderColor(color);
            const flagged = seconds[color] <= 0;
            if (!isStopped() && !flagged) {
                return;
            }
            stopColor(color);
            if (flagged && !isStopped()) {
                onFlag(color);
            }
        }

        /**
         * Stop both clocks and run the one for `color`. Anything other than
         * "white"/"black" (no side to move) just leaves both stopped.
         * @param {"white"|"black"|null} color
         */
        function startFor(color) {
            stop();
            if (!isColor(color)) {
                return;
            }
            handles[color] = timers.setInterval(function () {
                tick(color);
            }, 1000);
        }

        /**
         * Set remaining time. Values that are not numbers, or are negative, are
         * left untouched — callers pass partial updates from saved games.
         * @param {{ white?: number, black?: number }} values
         */
        function set(values) {
            const next = values || {};
            COLORS.forEach(function (color) {
                const value = next[color];
                if (typeof value === "number" && value >= 0) {
                    seconds[color] = value;
                    renderColor(color);
                }
            });
        }

        /**
         * Stop both clocks and put them back to a starting time.
         * @param {{ white: number, black: number }} values
         */
        function reset(values) {
            stop();
            const next = values || {};
            seconds.white = Number(next.white) || 0;
            seconds.black = Number(next.black) || 0;
            render();
        }

        return {
            get: function () {
                return { white: seconds.white, black: seconds.black };
            },
            set: set,
            reset: reset,
            startFor: startFor,
            stop: stop,
            isRunning: function () {
                return !!(handles.white || handles.black);
            },
            render: render,
        };
    }

    const ClocksController = {
        create: create,
        formatSeconds: formatSeconds,
    };

    global.PlayClocksController = ClocksController;

    /* Node (unit tests) — browsers load this file as a plain script. */
    if (typeof module === "object" && module && module.exports) {
        module.exports = ClocksController;
    }
})(typeof window !== "undefined" ? window : globalThis);
