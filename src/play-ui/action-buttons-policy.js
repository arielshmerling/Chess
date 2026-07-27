/**
 * Action-rail enable/disable policy for the Play shell.
 *
 * Pure: given a snapshot of shell flags, returns which button ids are disabled.
 * The shell still applies the map to the DOM.
 */
(function (global) {
    "use strict";

    /**
     * @param {object} state
     * @param {boolean} [state.hasGame]
     * @param {boolean} [state.playSessionReady]
     * @param {boolean} [state.gameActive]
     * @param {boolean} [state.positionSetup]
     * @param {boolean} [state.configuration]
     * @param {boolean} [state.animating]
     * @param {boolean} [state.dialogOn]
     * @param {boolean} [state.engineThinking]
     * @param {boolean} [state.gameOver]
     * @param {boolean} [state.hasMoves]
     * @param {boolean} [state.humanTurn]
     * @param {boolean} [state.allowUndo]
     * @param {boolean} [state.canUndoMovePair]
     * @param {boolean} [state.redoPairAvailable]
     * @param {boolean} [state.canUsePositionSetup]
     * @param {boolean} [state.canUseBrainConfig]
     * @param {object} [state.capabilities] - ModeCapabilities from session
     * @returns {Object.<string, boolean>}
     */
    function disabledMap(state) {
        const s = state || {};
        const caps = s.capabilities || null;
        const out = {};

        if (!s.hasGame || !s.playSessionReady) {
            out.positionSetupBtn = true;
            out.configurationBtn = true;
            out.rematchBtn = true;
            return out;
        }

        out.configurationBtn =
            !!s.animating || !!s.dialogOn || (!s.configuration && !s.canUseBrainConfig);

        if (!s.gameActive && !s.positionSetup && !s.configuration) {
            out.resignBtn = true;
            out.drawBtn = true;
            out.undoBtn = true;
            out.redoBtn = true;
            out.lastMoveBtn = true;
            out.saveBtn = true;
            out.rematchBtn = !!s.animating || !!s.dialogOn;
            out.positionSetupBtn = !!s.animating || !!s.dialogOn;
            out.flipBtn = true;
            return out;
        }

        out.positionSetupBtn =
            !!s.animating ||
            !!s.dialogOn ||
            !!s.configuration ||
            (!s.positionSetup && !s.canUsePositionSetup);

        if (s.positionSetup) {
            out.resignBtn = true;
            out.drawBtn = true;
            out.undoBtn = true;
            out.redoBtn = true;
            out.lastMoveBtn = true;
            out.saveBtn = true;
            out.rematchBtn = true;
            out.flipBtn = !!s.animating;
            return out;
        }

        if (s.configuration) {
            out.resignBtn = true;
            out.drawBtn = true;
            out.undoBtn = true;
            out.redoBtn = true;
            out.lastMoveBtn = true;
            out.saveBtn = true;
            out.rematchBtn = true;
            out.flipBtn = !!s.animating;
            return out;
        }

        const over = !!s.gameOver;
        out.resignBtn = over || !!s.animating;
        out.drawBtn = over || !!s.animating || !s.humanTurn;
        const undoRedoDisabled =
            !s.allowUndo || over || !!s.animating || !!s.engineThinking || !!s.dialogOn;
        out.undoBtn = undoRedoDisabled || !s.canUndoMovePair;
        out.redoBtn = undoRedoDisabled || !s.redoPairAvailable;
        out.lastMoveBtn = !s.hasMoves;
        out.flipBtn = !!s.animating;
        out.saveBtn = !s.hasGame || !!s.animating || !!s.dialogOn;
        out.rematchBtn = !!s.animating || !!s.dialogOn;

        if (caps) {
            if (caps.resign === false) {
                out.resignBtn = true;
            }
            if (caps.draw === false) {
                out.drawBtn = true;
            }
            if (caps.undo === false) {
                out.undoBtn = true;
            }
            if (caps.redo === false) {
                out.redoBtn = true;
            }
            if (caps.rematch === false) {
                out.rematchBtn = true;
            }
        }
        return out;
    }

    /**
     * @param {Object.<string, boolean>} map
     * @param {(id: string, disabled: boolean) => void} setDisabled
     */
    function apply(map, setDisabled) {
        if (!map || typeof setDisabled !== "function") {
            return;
        }
        Object.keys(map).forEach(function (id) {
            setDisabled(id, map[id]);
        });
    }

    const ActionButtonsPolicy = {
        disabledMap: disabledMap,
        apply: apply,
    };

    global.PlayActionButtonsPolicy = ActionButtonsPolicy;

    if (typeof module === "object" && module && module.exports) {
        module.exports = ActionButtonsPolicy;
    }
})(typeof window !== "undefined" ? window : globalThis);
