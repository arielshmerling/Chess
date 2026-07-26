/**
 * Keyboard shortcut routing for the Play shell.
 *
 * Pure: maps a key event to an action id. The shell runs the side effects.
 */
(function (global) {
    "use strict";

    /**
     * @param {EventTarget|null|undefined} target
     * @returns {boolean}
     */
    function shouldIgnoreTarget(target) {
        if (!target || !target.closest) {
            return false;
        }
        return !!target.closest("input, textarea, select, [contenteditable='true']");
    }

    /**
     * @param {KeyboardEvent|object} ev
     * @returns {"logGameState"|"openGamesFolder"|"evaluatePosition"|null}
     */
    function resolve(ev) {
        const event = ev || {};
        if (shouldIgnoreTarget(event.target)) {
            return null;
        }
        if (event.key === "F2") {
            return "logGameState";
        }
        if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            !event.altKey &&
            event.key &&
            event.key.toLowerCase() === "o"
        ) {
            return "openGamesFolder";
        }
        if (
            (event.ctrlKey || event.metaKey) &&
            !event.altKey &&
            event.key &&
            event.key.toLowerCase() === "e"
        ) {
            return "evaluatePosition";
        }
        return null;
    }

    const KeyboardShortcuts = {
        shouldIgnoreTarget: shouldIgnoreTarget,
        resolve: resolve,
    };

    global.PlayKeyboardShortcuts = KeyboardShortcuts;

    if (typeof module === "object" && module && module.exports) {
        module.exports = KeyboardShortcuts;
    }
})(typeof window !== "undefined" ? window : globalThis);
