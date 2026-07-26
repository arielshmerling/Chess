/**
 * Local-engine turn helpers for the Play shell.
 *
 * Pure policy for "should we call the brain / what happens after computeMove".
 * The shell still owns ChessGame, Board animation, clocks, and status text.
 * This is the Phase 1 seed of LocalEngineMode — not a full GameSession yet.
 */
(function (global) {
    "use strict";

    /**
     * @param {*} err
     * @returns {boolean}
     */
    function isSearchAbortedError(err) {
        return !!(err && (err.name === "SearchAbortedError" || err.message === "Search aborted"));
    }

    /**
     * Whether the shell may start an engine turn right now.
     *
     * @param {object} state
     * @param {boolean} [state.hasGame]
     * @param {boolean} [state.hasSession]
     * @param {boolean} [state.hasEngine]
     * @param {boolean} [state.gameOver]
     * @param {boolean} [state.aiTurn]
     * @param {boolean} [state.positionSetup]
     * @param {boolean} [state.configuration]
     * @param {boolean} [state.animating]
     * @param {boolean} [state.engineThinking]
     * @param {boolean} [state.dialogOn]
     * @returns {boolean}
     */
    function canStartTurn(state) {
        const s = state || {};
        if (!s.hasGame || !s.hasSession || !s.hasEngine) {
            return false;
        }
        if (s.gameOver || !s.aiTurn) {
            return false;
        }
        if (s.positionSetup || s.configuration) {
            return false;
        }
        if (s.animating || s.engineThinking || s.dialogOn) {
            return false;
        }
        return true;
    }

    /**
     * Args passed to DesktopEngine.computeMove / brain IPC.
     *
     * @param {object} input
     * @param {object} input.gameState
     * @param {Array} [input.moves]
     * @param {string} [input.engine]
     * @param {number|null|undefined} [input.thinkingTimeSeconds]
     * @param {number|null|undefined} [input.difficulty]
     * @param {number} [input.pliesPlayed]
     * @param {boolean} [input.immediateResign]
     * @returns {object}
     */
    function buildComputeArgs(input) {
        const src = input || {};
        const thinking =
            src.thinkingTimeSeconds != null ? src.thinkingTimeSeconds : src.difficulty;
        return {
            gameState: src.gameState,
            moves: src.moves || [],
            engine: src.engine,
            thinkingTimeSeconds: thinking,
            pliesPlayed: Number(src.pliesPlayed) || 0,
            immediateResign: src.immediateResign === true,
        };
    }

    /**
     * Decide what the shell should do after computeMove returns (not throws).
     *
     * @param {object|null|undefined} move
     * @param {object} [options]
     * @param {boolean} [options.gameOver]
     * @param {boolean} [options.immediateResign]
     * @param {*} [options.defaultPromotionPiece]
     * @returns {{
     *   action: "noop"|"resign"|"error"|"apply",
     *   message?: string,
     *   move?: object,
     *   mateNote?: string,
     *   logScore?: boolean
     * }}
     */
    function decideAfterCompute(move, options) {
        const opts = options || {};
        if (opts.gameOver) {
            return { action: "noop" };
        }
        if (move && move.searchAborted) {
            return { action: "noop" };
        }
        if (move && move.opponentMateDetected) {
            const mateNote =
                move.opponentMateIn != null && Number.isFinite(move.opponentMateIn)
                    ? " (mate in " + move.opponentMateIn + ")"
                    : "";
            if (opts.immediateResign) {
                return { action: "resign", mateNote: mateNote };
            }
            /* Fall through: still play a move when immediate resign is off. */
        }
        if (!move) {
            return {
                action: "error",
                message: "Engine could not find a move",
            };
        }
        const next = Object.assign({}, move);
        if (next.promotion && next.selectedPiece == null && opts.defaultPromotionPiece != null) {
            next.selectedPiece = opts.defaultPromotionPiece;
        }
        return {
            action: "apply",
            move: next,
            logScore: next.score != null && Number.isFinite(next.score),
            mateNote:
                move.opponentMateDetected
                    ? move.opponentMateIn != null && Number.isFinite(move.opponentMateIn)
                        ? " (mate in " + move.opponentMateIn + ")"
                        : ""
                    : undefined,
        };
    }

    /**
     * Status copy after a side resigns (human or engine-from-mate).
     *
     * @param {string} resignedColor
     * @param {{ white?: string, black?: string }|null} [names]
     * @returns {string}
     */
    function resignStatusMessage(resignedColor, names) {
        const isWhite = String(resignedColor).toLowerCase() === "white";
        const fallback = isWhite ? "White" : "Black";
        const name = names
            ? (isWhite ? names.white : names.black) || fallback
            : fallback;
        return "Game over. " + name + " resign.";
    }

    const EngineTurn = {
        isSearchAbortedError: isSearchAbortedError,
        canStartTurn: canStartTurn,
        buildComputeArgs: buildComputeArgs,
        decideAfterCompute: decideAfterCompute,
        resignStatusMessage: resignStatusMessage,
    };

    global.PlayEngineTurn = EngineTurn;

    if (typeof module === "object" && module && module.exports) {
        module.exports = EngineTurn;
    }
})(typeof window !== "undefined" ? window : globalThis);
