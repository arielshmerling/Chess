/**
 * Session mode labels and dock visibility rules for the Play shell.
 *
 * Pure helpers — no DOM. The shell still owns enter/exit side effects
 * (Board setup mode, brain panel mount, clocks).
 */
(function (global) {
    "use strict";

    /**
     * @param {object} state
     * @param {boolean} [state.positionSetup]
     * @param {boolean} [state.configuration]
     * @param {boolean} [state.reviewPlayback]
     * @param {boolean} [state.review]
     * @param {boolean} [state.watch]
     * @param {boolean} [state.practice]
     * @returns {string}
     */
    function sessionTypeLabel(state) {
        const s = state || {};
        if (s.positionSetup) {
            return "Position Setup";
        }
        if (s.configuration) {
            return "Configuration mode";
        }
        if (s.reviewPlayback) {
            return "Playback Mode";
        }
        if (s.review) {
            return "Review Mode";
        }
        if (s.watch) {
            return "Watch Mode";
        }
        if (s.practice) {
            return "Practice Mode";
        }
        return "Play Mode";
    }

    /**
     * Whether the header "Play from position" run panel should show.
     *
     * @param {object} state
     * @param {boolean} [state.positionSetup]
     * @param {boolean} [state.gameActive]
     * @param {boolean} [state.hasLoadedSavedGame]
     * @param {boolean} [state.boardHasPieces]
     * @returns {boolean}
     */
    function shouldShowGameRun(state) {
        const s = state || {};
        if (s.positionSetup) {
            return true;
        }
        return !s.gameActive && !!s.hasLoadedSavedGame && !!s.boardHasPieces;
    }

    /**
     * Position setup may open when advanced tools are allowed and either the
     * game is over or no moves have been played yet.
     *
     * @param {object} state
     * @param {boolean} state.canPlayAdvancedTools
     * @param {boolean} state.hasGame
     * @param {boolean} [state.gameOver]
     * @param {number} [state.moveCount]
     * @returns {boolean}
     */
    function canUsePositionSetup(state) {
        const s = state || {};
        if (!s.canPlayAdvancedTools || !s.hasGame) {
            return false;
        }
        if (s.gameOver) {
            return true;
        }
        return (Number(s.moveCount) || 0) === 0;
    }

    /**
     * Brain configuration may open when advanced tools are allowed and the
     * shell is not in position setup or an active game.
     *
     * @param {object} state
     * @param {boolean} state.canPlayAdvancedTools
     * @param {boolean} [state.positionSetup]
     * @param {boolean} [state.gameActive]
     * @returns {boolean}
     */
    function canUseBrainConfig(state) {
        const s = state || {};
        if (!s.canPlayAdvancedTools) {
            return false;
        }
        return !s.positionSetup && !s.gameActive;
    }

    /**
     * Opening one of the exclusive docks clears the other.
     *
     * @param {"positionSetup"|"configuration"|null} entering
     * @param {{ positionSetup?: boolean, configuration?: boolean }} current
     * @returns {{ positionSetup: boolean, configuration: boolean }}
     */
    function exclusiveDockModes(entering, current) {
        const cur = current || {};
        if (entering === "positionSetup") {
            return { positionSetup: true, configuration: false };
        }
        if (entering === "configuration") {
            return { positionSetup: false, configuration: true };
        }
        return {
            positionSetup: !!cur.positionSetup,
            configuration: !!cur.configuration,
        };
    }

    const SessionMode = {
        sessionTypeLabel: sessionTypeLabel,
        shouldShowGameRun: shouldShowGameRun,
        canUsePositionSetup: canUsePositionSetup,
        canUseBrainConfig: canUseBrainConfig,
        exclusiveDockModes: exclusiveDockModes,
    };

    global.PlaySessionMode = SessionMode;

    if (typeof module === "object" && module && module.exports) {
        module.exports = SessionMode;
    }
})(typeof window !== "undefined" ? window : globalThis);
