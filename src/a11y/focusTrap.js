/**
 * Focus trap helper for modal dialogs (WCAG 2.4.3 / 2.1.2).
 * Browser + Node-safe dual export.
 */
(function (global) {
    "use strict";

    var FOCUSABLE =
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
        'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function isVisible(el) {
        if (!el || el.disabled) {
            return false;
        }
        if (el.getAttribute("aria-hidden") === "true") {
            return false;
        }
        if (el.hidden) {
            return false;
        }
        var style = global.getComputedStyle ? global.getComputedStyle(el) : null;
        if (style && (style.visibility === "hidden" || style.display === "none")) {
            return false;
        }
        /* In real browsers prefer layout; in jsdom/layout-less envs keep DOM nodes focusable. */
        if (typeof el.getClientRects === "function") {
            var rects = el.getClientRects();
            if (rects && rects.length === 0 && (el.offsetWidth || el.offsetHeight)) {
                return true;
            }
            if (rects && rects.length > 0) {
                return true;
            }
        }
        return true;
    }

    function getFocusable(container) {
        if (!container || !container.querySelectorAll) {
            return [];
        }
        return Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE)).filter(isVisible);
    }

    /**
     * @param {HTMLElement} container
     * @param {{ initialFocus?: HTMLElement|null }} [opts]
     * @returns {{ release: function(): void, previouslyFocused: Element|null }}
     */
    function trapFocus(container, opts) {
        opts = opts || {};
        var previouslyFocused =
            global.document && global.document.activeElement
                ? global.document.activeElement
                : null;

        function onKeyDown(e) {
            if (!e || e.key !== "Tab") {
                return;
            }
            var nodes = getFocusable(container);
            if (!nodes.length) {
                e.preventDefault();
                if (container.focus) {
                    container.setAttribute("tabindex", "-1");
                    container.focus();
                }
                return;
            }
            var first = nodes[0];
            var last = nodes[nodes.length - 1];
            var active = global.document.activeElement;
            if (e.shiftKey) {
                if (active === first || !container.contains(active)) {
                    e.preventDefault();
                    last.focus();
                }
            } else if (active === last || !container.contains(active)) {
                e.preventDefault();
                first.focus();
            }
        }

        container.addEventListener("keydown", onKeyDown);

        var initial =
            opts.initialFocus && isVisible(opts.initialFocus)
                ? opts.initialFocus
                : getFocusable(container)[0] || container;
        if (initial && initial.focus) {
            if (initial === container) {
                container.setAttribute("tabindex", "-1");
            }
            try {
                initial.focus();
            } catch (err) {
                /* ignore */
            }
        }

        return {
            previouslyFocused: previouslyFocused,
            release: function release() {
                container.removeEventListener("keydown", onKeyDown);
                if (
                    previouslyFocused &&
                    previouslyFocused.focus &&
                    global.document &&
                    global.document.contains &&
                    global.document.contains(previouslyFocused)
                ) {
                    try {
                        previouslyFocused.focus();
                    } catch (err) {
                        /* ignore */
                    }
                }
            },
        };
    }

    var api = {
        trapFocus: trapFocus,
        getFocusable: getFocusable,
    };

    global.ShmerlingFocusTrap = api;
    if (typeof module === "object" && module && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
