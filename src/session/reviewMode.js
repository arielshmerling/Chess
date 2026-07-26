/**
 * ReviewMode — saved-game / bookmark navigation (Phase 2).
 *
 * Owns ply bookkeeping and capabilities. The shell still replays moves onto
 * ChessGame and animates; call setPly / loadNavigation then apply the board.
 */
(function (global) {
    "use strict";

    function loadReviewModel() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("../play-ui/review-model");
            } catch {
                /* fall through */
            }
        }
        return global.PlayReviewModel;
    }

    function loadCapabilities() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./capabilities");
            } catch {
                /* fall through */
            }
        }
        return null;
    }

    function loadContracts() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./contracts");
            } catch {
                /* fall through */
            }
        }
        return { MODE_IDS: { REVIEW: "review" } };
    }

    /**
     * @param {object} [options]
     * @param {object} [options.reviewModel] - PlayReviewModel-compatible helpers
     */
    function create(options) {
        const opts = options || {};
        const ReviewModel = opts.reviewModel || loadReviewModel();
        const capsApi = loadCapabilities();
        const contracts = loadContracts();
        const modeId = (contracts.MODE_IDS && contracts.MODE_IDS.REVIEW) || "review";

        let session = null;
        let fullMoves = [];
        let plyIndex = 0;
        let originStateStr = null;
        let finalStateStr = null;
        let resignedColor = null;
        let branchPly = null;

        function capabilities() {
            if (capsApi && typeof capsApi.getModeCapabilities === "function") {
                return capsApi.getModeCapabilities(modeId);
            }
            return {
                undo: false,
                redo: false,
                resign: false,
                draw: false,
                rematch: false,
                engine: false,
                network: false,
                reviewNav: true,
                positionSetup: false,
                watchers: false,
                chat: false,
            };
        }

        function getNavState() {
            return {
                fullMoves: fullMoves.slice(),
                plyIndex: plyIndex,
                originStateStr: originStateStr,
                finalStateStr: finalStateStr,
                resignedColor: resignedColor,
                branchPly: branchPly,
                moveCount: fullMoves.length,
            };
        }

        function emitPlyChanged(reason) {
            if (!session || typeof session.emit !== "function") {
                return;
            }
            session.emit("reviewPlyChanged", getNavState(), { reason: reason || "setPly" });
            session.emit("statusChanged", "review");
        }

        /**
         * @param {object} loadOpts
         * @param {Array} [loadOpts.moves]
         * @param {string} [loadOpts.finalStateStr]
         * @param {string} [loadOpts.originStateStr]
         * @param {string|null} [loadOpts.resignedColor]
         */
        function loadNavigation(loadOpts) {
            const lo = loadOpts || {};
            const loaded = ReviewModel.cloneMoves(lo.moves || []);
            fullMoves = loaded;
            finalStateStr = lo.finalStateStr != null ? lo.finalStateStr : null;
            originStateStr =
                lo.originStateStr != null && String(lo.originStateStr).trim()
                    ? String(lo.originStateStr)
                    : null;
            if (lo.resignedColor != null) {
                resignedColor = lo.resignedColor;
            } else if (ReviewModel.resignedColorFromState) {
                resignedColor = ReviewModel.resignedColorFromState(finalStateStr);
            } else {
                resignedColor = null;
            }
            plyIndex = fullMoves.length;
            branchPly = null;
            emitPlyChanged("load");
            return getNavState();
        }

        function clearNavigation() {
            fullMoves = [];
            originStateStr = null;
            finalStateStr = null;
            resignedColor = null;
            plyIndex = 0;
            branchPly = null;
            emitPlyChanged("clear");
            return getNavState();
        }

        /**
         * @param {number} ply
         * @returns {number} clamped ply
         */
        function setPly(ply) {
            const clamped = ReviewModel.clampPly(ply, fullMoves.length);
            plyIndex = clamped;
            branchPly = clamped < fullMoves.length ? clamped : null;
            emitPlyChanged("setPly");
            return clamped;
        }

        function attach(sess) {
            session = sess;
            if (session && typeof session.emit === "function") {
                session.emit("capabilitiesChanged", capabilities());
            }
        }

        function detach() {
            session = null;
        }

        return {
            id: modeId,
            capabilities: capabilities,
            attach: attach,
            detach: detach,
            loadNavigation: loadNavigation,
            clearNavigation: clearNavigation,
            setPly: setPly,
            getNavState: getNavState,
        };
    }

    const ReviewMode = { create: create };

    global.ShmerlingReviewMode = ReviewMode;

    if (typeof module === "object" && module && module.exports) {
        module.exports = ReviewMode;
    }
})(typeof window !== "undefined" ? window : globalThis);
