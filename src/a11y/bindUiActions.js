/**
 * Bind data-* UI actions so pages do not need HTML onclick=/onsubmit= (CSP SEC-05 / ON-39).
 *
 * Supported attributes:
 * - data-nav-href="/path"           → navigate (click)
 * - data-stop-nav                   → stopPropagation (for nested controls)
 * - data-action="send-chat"         → onSendChatButtonClick(event)
 * - data-action="add-bookmark"      → addBookmark()
 * - data-action="close-play-now"    → closePlayNowModal()
 * - data-action="open-play-now"     → openPlayNowModal()
 * - data-action="start-play-home"   → startPlayFromHome()
 * - data-action="close-mobile-moves"→ closeMobileMovesListPanel()
 * - data-action="play-now-submit" on a form → startNewGameFromModal(event)
 */
(function (global) {
    "use strict";

    function callIfFn(name, event) {
        var fn = global[name];
        if (typeof fn === "function") {
            return fn(event);
        }
        return undefined;
    }

    function onClick(event) {
        var el = event.target;
        if (!el || !el.closest) {
            return;
        }

        var stopEl = el.closest("[data-stop-nav]");
        if (stopEl) {
            event.stopPropagation();
        }

        var actionEl = el.closest("[data-action]");
        if (actionEl) {
            var action = actionEl.getAttribute("data-action");
            if (action === "send-chat") {
                event.preventDefault();
                callIfFn("onSendChatButtonClick", event);
                return;
            }
            if (action === "add-bookmark") {
                event.preventDefault();
                callIfFn("addBookmark", event);
                return;
            }
            if (action === "close-play-now") {
                event.preventDefault();
                callIfFn("closePlayNowModal", event);
                return;
            }
            if (action === "open-play-now") {
                event.preventDefault();
                callIfFn("openPlayNowModal", event);
                return;
            }
            if (action === "start-play-home") {
                event.preventDefault();
                callIfFn("startPlayFromHome", event);
                return;
            }
            if (action === "close-mobile-moves") {
                event.preventDefault();
                callIfFn("closeMobileMovesListPanel", event);
                return;
            }
        }

        var navEl = el.closest("[data-nav-href]");
        if (navEl && (!actionEl || actionEl === navEl)) {
            var href = navEl.getAttribute("data-nav-href");
            if (href) {
                if (global.location && typeof global.location.assign === "function") {
                    global.location.assign(href);
                } else if (global.location) {
                    global.location.href = href;
                }
            }
        }
    }

    function onSubmit(event) {
        var form = event.target;
        if (!form || form.getAttribute("data-action") !== "play-now-submit") {
            return;
        }
        event.preventDefault();
        callIfFn("startNewGameFromModal", event);
    }

    function bind(root) {
        var scope = root || global.document;
        if (!scope || scope.__shmerlingUiActionsBound) {
            return;
        }
        scope.__shmerlingUiActionsBound = true;
        scope.addEventListener("click", onClick);
        scope.addEventListener("submit", onSubmit);
    }

    if (global.document) {
        if (global.document.readyState === "loading") {
            global.document.addEventListener("DOMContentLoaded", function () {
                bind(global.document);
            });
        } else {
            bind(global.document);
        }
    }

    global.ShmerlingBindUiActions = { bind: bind };
})(typeof window !== "undefined" ? window : globalThis);
