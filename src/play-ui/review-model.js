/**
 * Review mode: pure helpers for ply navigation and move-list bookkeeping.
 *
 * No DOM and no ChessGame. Callers still own replay against a live board.
 */
(function (global) {
    "use strict";

    /**
     * @param {object|string} move
     * @returns {object}
     */
    function cloneMove(move) {
        if (typeof move === "string") {
            return JSON.parse(move);
        }
        return Object.assign({}, move);
    }

    /**
     * @param {Array<object|string>|null|undefined} moves
     * @returns {Array<object>}
     */
    function cloneMoves(moves) {
        return (moves || []).map(cloneMove);
    }

    /**
     * @param {number} ply
     * @param {number} moveCount
     * @returns {number}
     */
    function clampPly(ply, moveCount) {
        const max = Math.max(0, Number(moveCount) || 0);
        const n = Number(ply);
        if (!Number.isFinite(n)) {
            return 0;
        }
        return Math.max(0, Math.min(n, max));
    }

    /**
     * @param {string|null|undefined} stateStr
     * @returns {string|null} Lower-case colour, or null.
     */
    function resignedColorFromState(stateStr) {
        try {
            const state = JSON.parse(stateStr || "{}");
            const resigned = state.resigned;
            if (!resigned || !String(resigned).trim()) {
                return null;
            }
            return String(resigned).toLowerCase();
        } catch {
            return null;
        }
    }

    /**
     * @param {string|null|undefined} originStateStr
     * @returns {"white"|"black"}
     */
    function originTurn(originStateStr) {
        try {
            const origin = JSON.parse(originStateStr || "{}");
            if (origin.turn === "white" || origin.turn === "black") {
                return origin.turn;
            }
        } catch {
            /* ignore */
        }
        return "white";
    }

    /**
     * Side to move after replaying `ply` half-moves from the review start.
     *
     * @param {object} options
     * @param {Array<object>} options.moves
     * @param {number} options.ply
     * @param {string|null|undefined} [options.originStateStr]
     * @param {(move: object) => ("white"|"black"|null)} [options.moveColor]
     * @returns {"white"|"black"}
     */
    function nextTurnAfterPly(options) {
        const moves = (options && options.moves) || [];
        const moveColor =
            options && typeof options.moveColor === "function"
                ? options.moveColor
                : function () {
                      return null;
                  };
        const start = originTurn(options && options.originStateStr);
        const clamped = clampPly(options && options.ply, moves.length);
        if (clamped === 0) {
            return start;
        }
        const lastMove = moves[clamped - 1];
        const mover = moveColor(lastMove);
        if (mover === "white") {
            return "black";
        }
        if (mover === "black") {
            return "white";
        }
        let turn = start;
        for (let i = 0; i < clamped; i += 1) {
            turn = turn === "white" ? "black" : "white";
        }
        return turn;
    }

    /**
     * Count half-moves that are not result tokens (1-0, 0-1, …).
     *
     * @param {Array<object>} moves
     * @param {(move: object) => boolean} [isResultMove]
     * @returns {number}
     */
    function chessMoveCount(moves, isResultMove) {
        const list = moves || [];
        if (!list.length) {
            return 0;
        }
        if (typeof isResultMove !== "function") {
            return list.length;
        }
        return list.filter(function (move) {
            return !isResultMove(move);
        }).length;
    }

    /**
     * Ply to highlight in the moves panel while branching, or null.
     *
     * @param {object} options
     * @param {boolean} options.reviewMode
     * @param {number|null|undefined} options.branchPly
     * @param {number} options.plyIndex
     * @returns {number|null}
     */
    function selectedPly(options) {
        const opts = options || {};
        if (!opts.reviewMode || opts.branchPly == null || opts.plyIndex <= 0) {
            return null;
        }
        return opts.plyIndex;
    }

    /**
     * Button enabled flags for the review nav bar.
     *
     * @param {object} options
     * @param {number} options.plyIndex
     * @param {number} options.moveCount
     * @param {boolean} options.playing
     * @returns {{ atStart: boolean, atEnd: boolean, start: boolean, back: boolean, forward: boolean, end: boolean, playPause: boolean }}
     */
    function navButtonState(options) {
        const opts = options || {};
        const plyIndex = Number(opts.plyIndex) || 0;
        const moveCount = Math.max(0, Number(opts.moveCount) || 0);
        const playing = !!opts.playing;
        const atStart = plyIndex <= 0;
        const atEnd = plyIndex >= moveCount;
        return {
            atStart: atStart,
            atEnd: atEnd,
            start: !(playing || atStart),
            back: !(playing || atStart),
            forward: !(playing || atEnd),
            end: !(playing || atEnd),
            playPause: !(!playing && atEnd),
        };
    }

    const ReviewModel = {
        cloneMove: cloneMove,
        cloneMoves: cloneMoves,
        clampPly: clampPly,
        resignedColorFromState: resignedColorFromState,
        originTurn: originTurn,
        nextTurnAfterPly: nextTurnAfterPly,
        chessMoveCount: chessMoveCount,
        selectedPly: selectedPly,
        navButtonState: navButtonState,
    };

    global.PlayReviewModel = ReviewModel;

    if (typeof module === "object" && module && module.exports) {
        module.exports = ReviewModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
