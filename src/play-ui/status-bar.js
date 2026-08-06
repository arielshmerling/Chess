/**
 * Footer status bar and match-header chrome (title, player names, clock highlight).
 *
 * The status controller owns the temporary event message and auto-clear timer.
 * Default idle text and game policy stay with the shell via getDefaultText.
 */
(function (global) {
    "use strict";

    const t =
        typeof module === "object" && module && module.exports
            ? require("../strings/t-bridge").t
            : typeof global.ShmerlingT === "function"
              ? global.ShmerlingT
              : function (key) {
                    return key;
                };

    const STATUS_BAR_CLASSES = [
        "desktop-play-status-bar--event",
        "desktop-play-status-bar--check",
        "desktop-play-status-bar--checkmate",
        "desktop-play-status-bar--draw",
        "desktop-play-status-bar--promotion",
        "desktop-play-status-bar--info",
        "desktop-play-status-bar--timeout",
        "desktop-play-status-bar--error",
    ];

    const CLOCK_ACTIVE = "desktop-play-header-clock--active";

    /**
     * Idle / in-progress copy when no temporary event is showing.
     *
     * @param {object} state
     * @param {boolean} [state.hasGame]
     * @param {boolean} [state.gameActive]
     * @param {boolean} [state.positionSetup]
     * @param {boolean} [state.configuration]
     * @param {boolean} [state.review]
     * @param {boolean} [state.boardHasPieces]
     * @param {boolean} [state.gameOver]
     * @param {boolean} [state.canPlayAdvancedTools]
     * @returns {string}
     */
    function defaultStatusText(state) {
        const s = state || {};
        if (!s.hasGame) {
            return "";
        }
        if (!s.gameActive && !s.positionSetup && !s.configuration) {
            if (s.review && s.boardHasPieces) {
                return "";
            }
            if (s.boardHasPieces) {
                return t("play.status.setMoveColorEngineThinkTime");
            }
            return s.canPlayAdvancedTools
                ? t("play.status.chooseNewGameOrSetup")
                : t("play.status.chooseNewGame");
        }
        if (s.gameOver) {
            return t("play.status.gameOver");
        }
        return t("play.status.gameInProgress");
    }

    /**
     * @param {HTMLElement|null} statusEl
     * @param {object} options
     * @param {string|null} [options.message]
     * @param {string|null} [options.kind]
     * @param {string} [options.defaultText]
     */
    function renderStatus(statusEl, options) {
        if (!statusEl) {
            return;
        }
        const opts = options || {};
        STATUS_BAR_CLASSES.forEach(function (cls) {
            statusEl.classList.remove(cls);
        });
        if (opts.message) {
            statusEl.textContent = opts.message;
            statusEl.classList.add("desktop-play-status-bar--event");
            if (opts.kind) {
                statusEl.classList.add("desktop-play-status-bar--" + opts.kind);
            }
            return;
        }
        statusEl.textContent = opts.defaultText || "";
    }

    /**
     * @param {object} elements
     * @param {HTMLElement|null} [elements.headerBlack]
     * @param {HTMLElement|null} [elements.headerWhite]
     * @param {object} state
     * @param {boolean} [state.hasGame]
     * @param {boolean} [state.gameOver]
     * @param {boolean} [state.suppressForAlert]
     * @param {"white"|"black"|string|null} [state.turn]
     */
    function applyClockHighlight(elements, state) {
        const els = elements || {};
        const s = state || {};
        if (!s.hasGame) {
            return;
        }
        const active = !s.gameOver && !s.suppressForAlert;
        if (els.headerBlack) {
            els.headerBlack.classList.toggle(CLOCK_ACTIVE, active && s.turn === "black");
        }
        if (els.headerWhite) {
            els.headerWhite.classList.toggle(CLOCK_ACTIVE, active && s.turn === "white");
        }
    }

    /**
     * @param {object} elements
     * @param {HTMLElement|null} [elements.titleEl]
     * @param {HTMLElement|null} [elements.whiteNameEl]
     * @param {HTMLElement|null} [elements.blackNameEl]
     * @param {object} data
     * @param {string} [data.title]
     * @param {string} [data.whiteName]
     * @param {string} [data.blackName]
     * @param {boolean} [data.updateNames]
     */
    function applyMatchHeader(elements, data) {
        const els = elements || {};
        const d = data || {};
        if (els.titleEl && d.title != null) {
            els.titleEl.textContent = d.title;
        }
        if (!d.updateNames) {
            return;
        }
        if (els.whiteNameEl) {
            els.whiteNameEl.textContent = d.whiteName || t("common.white");
        }
        if (els.blackNameEl) {
            els.blackNameEl.textContent = d.blackName || t("common.black");
        }
    }

    /**
     * @param {object} options
     * @param {() => (HTMLElement|null)} options.getElement
     * @param {() => string} [options.getDefaultText]
     * @param {(event: { message: string|null, kind: string|null }) => void} [options.onAfterRender]
     * @param {{ setTimeout: Function, clearTimeout: Function }} [options.timers]
     */
    function create(options) {
        const opts = options || {};
        const getElement = opts.getElement || function () {
            return null;
        };
        const getDefaultText = opts.getDefaultText || function () {
            return "";
        };
        const onAfterRender = opts.onAfterRender || function () {};
        const timers = opts.timers || global;

        let message = null;
        let kind = null;
        let timerHandle = null;

        function clearTimer() {
            if (timerHandle) {
                timers.clearTimeout(timerHandle);
                timerHandle = null;
            }
        }

        function refresh() {
            renderStatus(getElement(), {
                message: message,
                kind: kind,
                defaultText: getDefaultText(),
            });
            onAfterRender({ message: message, kind: kind });
        }

        function clear() {
            clearTimer();
            message = null;
            kind = null;
            refresh();
        }

        /**
         * @param {string} nextMessage
         * @param {number} [durationMs]
         * @param {string} [nextKind]
         */
        function show(nextMessage, durationMs, nextKind) {
            if (!nextMessage) {
                clear();
                return;
            }
            clearTimer();
            message = nextMessage;
            kind = nextKind || "info";
            refresh();
            if (durationMs) {
                const kept = nextMessage;
                timerHandle = timers.setTimeout(function () {
                    if (message === kept) {
                        clear();
                    }
                }, durationMs);
            }
        }

        return {
            show: show,
            clear: clear,
            refresh: refresh,
            getEvent: function () {
                return { message: message, kind: kind };
            },
            isNonInfoAlert: function () {
                return !!(message && kind && kind !== "info");
            },
        };
    }

    const StatusBar = {
        defaultStatusText: defaultStatusText,
        renderStatus: renderStatus,
        applyClockHighlight: applyClockHighlight,
        applyMatchHeader: applyMatchHeader,
        create: create,
    };

    global.PlayStatusBar = StatusBar;

    if (typeof module === "object" && module && module.exports) {
        module.exports = StatusBar;
    }
})(typeof window !== "undefined" ? window : globalThis);
