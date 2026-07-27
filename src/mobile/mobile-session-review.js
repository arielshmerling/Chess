/**
 * Mobile session review adapter (Phase 8 slice 1).
 *
 * Binds GameSession + ReviewMode on /mobile-review. Keeps mobile CSS/DOM and
 * classic chessboard drawing; only ply bookkeeping + nav use the session package.
 *
 * Dual export for Node characterization tests.
 */
(function (global) {
    "use strict";

    /**
     * @returns {boolean}
     */
    function isMobileReviewPage() {
        try {
            const main = global.document && global.document.getElementById("main");
            if (main && main.getAttribute("data-mobile-review") === "true") {
                return true;
            }
            const path = (global.location && global.location.pathname) || "";
            return path === "/mobile-review" || path.indexOf("/mobile-review") === 0;
        } catch {
            return false;
        }
    }

    /**
     * @returns {boolean}
     */
    function sessionApisReady() {
        return !!(
            global.ShmerlingGameSession &&
            typeof global.ShmerlingGameSession.create === "function" &&
            global.ShmerlingReviewMode &&
            typeof global.ShmerlingReviewMode.create === "function"
        );
    }

    /**
     * @returns {boolean}
     */
    function classicReviewReady() {
        const game = global.game;
        const gameInfo = global.gameInfo;
        const gameMoves = global.gameMoves;
        return !!(
            game &&
            gameInfo &&
            gameInfo.mode === "review" &&
            gameMoves &&
            Array.isArray(gameMoves.moves)
        );
    }

    /**
     * @param {object[]} moves
     * @param {object} game
     * @returns {object[]}
     */
    function playableMoves(moves, game) {
        const list = Array.isArray(moves) ? moves : [];
        const out = [];
        for (let i = 0; i < list.length; i++) {
            const m = list[i];
            if (!m) {
                continue;
            }
            if (game && typeof game.isResultMove === "function" && game.isResultMove(m)) {
                out.push(m);
                continue;
            }
            out.push(typeof m === "object" ? Object.assign({}, m) : m);
        }
        return out;
    }

    /**
     * Replay plies onto the classic review board (no animation).
     * @param {number} ply
     * @param {object} ctx
     */
    function syncClassicBoardToPly(ply, ctx) {
        const game = ctx.game;
        const gameMoves = ctx.gameMoves;
        const currentPlayerIsWhite = ctx.currentPlayerIsWhite !== false;
        const moves = (gameMoves && gameMoves.moves) || [];
        const target = Math.max(0, Math.min(Number(ply) || 0, moves.length));

        if (typeof global.movePause === "function") {
            try {
                global.movePause();
            } catch {
                /* ignore */
            }
        }

        game.startNewGame(currentPlayerIsWhite);
        for (let i = 0; i < target; i++) {
            const move = moves[i];
            if (!move) {
                continue;
            }
            if (typeof game.isResultMove === "function" && game.isResultMove(move)) {
                continue;
            }
            if (typeof global.showMoveForReview === "function") {
                global.showMoveForReview(move, false, i);
            }
        }

        global.moveIndex = target;

        if (typeof global.document !== "undefined") {
            const movesTDList = global.document.querySelectorAll("[id ^= 'td_move']");
            movesTDList.forEach(function (td) {
                td.classList.remove("selectedMove");
            });
            if (target > 0) {
                const td = global.document.getElementById("td_move" + target);
                if (td) {
                    td.classList.add("selectedMove");
                    if (typeof global.scrollMoveCellIntoView === "function") {
                        global.scrollMoveCellIntoView(td);
                    }
                }
            }
        }

        if (typeof global.syncReviewClocksForCurrentPly === "function") {
            global.syncReviewClocksForCurrentPly();
        }
        if (typeof global.togglePlayPause === "function") {
            global.togglePlayPause(true);
        }
    }

    /**
     * @param {object} [options]
     * @returns {{ session: object, reviewMode: object, dispose: function }|null}
     */
    function attach(options) {
        const opts = options || {};
        if (!sessionApisReady()) {
            return null;
        }
        const game = opts.game || global.game;
        const gameMoves = opts.gameMoves || global.gameMoves;
        if (!game || !gameMoves || !Array.isArray(gameMoves.moves)) {
            return null;
        }

        const session = global.ShmerlingGameSession.create({
            game: game,
            humanIsWhite: opts.currentPlayerIsWhite !== false,
            engine: null,
            meta: { mobileReview: true },
        });
        const reviewMode = global.ShmerlingReviewMode.create({});
        session.attachMode(reviewMode);
        session.load({ active: true, humanIsWhite: opts.currentPlayerIsWhite !== false });

        const moves = playableMoves(gameMoves.moves, game);
        reviewMode.loadNavigation({
            moves: moves,
            finalStateStr: opts.finalStateStr || null,
            originStateStr: opts.originStateStr || null,
            resignedColor: opts.resignedColor || null,
        });

        const ctx = {
            game: game,
            gameMoves: gameMoves,
            currentPlayerIsWhite: opts.currentPlayerIsWhite !== false,
        };

        const unsub = session.on("reviewPlyChanged", function (nav) {
            syncClassicBoardToPly(nav && nav.plyIndex, ctx);
        });

        function setPly(ply) {
            return reviewMode.setPly(ply);
        }

        function dispose() {
            if (typeof unsub === "function") {
                unsub();
            }
            if (reviewMode && typeof reviewMode.detach === "function") {
                reviewMode.detach();
            }
            if (session && typeof session.dispose === "function") {
                session.dispose();
            }
        }

        return {
            session: session,
            reviewMode: reviewMode,
            setPly: setPly,
            getNavState: function () {
                return reviewMode.getNavState();
            },
            dispose: dispose,
        };
    }

    /**
     * Replace classic review nav globals with ReviewMode.setPly.
     * @param {{ setPly: function, getNavState: function }} bridge
     */
    function bindClassicNav(bridge) {
        if (!bridge || typeof bridge.setPly !== "function") {
            return;
        }

        global.moveStart = function () {
            bridge.setPly(0);
        };
        global.moveEnd = function () {
            const nav = bridge.getNavState();
            bridge.setPly(nav ? nav.moveCount : 0);
        };
        global.moveNext = function () {
            if (global.animating) {
                return;
            }
            const nav = bridge.getNavState();
            if (!nav) {
                return;
            }
            bridge.setPly(nav.plyIndex + 1);
        };
        global.movePrev = function () {
            if (global.animating) {
                return;
            }
            const nav = bridge.getNavState();
            if (!nav) {
                return;
            }
            bridge.setPly(nav.plyIndex - 1);
        };

        let playbackTimer = null;
        global.movePause = function () {
            if (playbackTimer) {
                clearInterval(playbackTimer);
                playbackTimer = null;
            }
            if (typeof global.togglePlayPause === "function") {
                global.togglePlayPause(true);
            }
        };
        global.movePlay = function () {
            if (global.animating || global.dialogOn) {
                return;
            }
            if (typeof global.togglePlayPause === "function") {
                global.togglePlayPause(false);
            }
            if (playbackTimer) {
                clearInterval(playbackTimer);
            }
            playbackTimer = setInterval(function () {
                const nav = bridge.getNavState();
                if (!nav || nav.plyIndex >= nav.moveCount) {
                    global.movePause();
                    return;
                }
                if (global.animating) {
                    return;
                }
                bridge.setPly(nav.plyIndex + 1);
            }, 800);
        };

        rewireNavButtonClicks();
    }

    /** Classic generateMoveButtons captured old function refs — refresh onclick. */
    function rewireNavButtonClicks() {
        if (typeof global.document === "undefined") {
            return;
        }
        const ids = [
            "moveStart",
            "movePrev",
            "movePlay",
            "movePause",
            "moveNext",
            "moveEnd",
        ];
        ids.forEach(function (id) {
            const el = global.document.getElementById(id);
            const fn = global[id];
            if (el && typeof fn === "function") {
                el.onclick = fn;
            }
        });
    }

    function bootWhenReady() {
        if (!isMobileReviewPage() || !sessionApisReady()) {
            return;
        }
        let tries = 0;
        const maxTries = 150;
        const handle = setInterval(function () {
            tries += 1;
            if (!classicReviewReady()) {
                if (tries >= maxTries) {
                    clearInterval(handle);
                    console.warn("[MobileSessionReview] Classic review did not become ready");
                }
                return;
            }
            clearInterval(handle);
            const currentPlayerIsWhite =
                typeof global.currentPlayerIsWhite === "boolean"
                    ? global.currentPlayerIsWhite
                    : true;
            const bridge = attach({
                game: global.game,
                gameMoves: global.gameMoves,
                currentPlayerIsWhite: currentPlayerIsWhite,
            });
            if (!bridge) {
                console.warn("[MobileSessionReview] Could not attach ReviewMode");
                return;
            }
            bindClassicNav(bridge);
            global.__SHMERLING_MOBILE_REVIEW_SESSION__ = bridge;
            /* Stay at end position (classic default after load). */
            const nav = bridge.getNavState();
            if (nav) {
                bridge.setPly(nav.moveCount);
            }
        }, 100);
    }

    const MobileSessionReview = {
        isMobileReviewPage: isMobileReviewPage,
        sessionApisReady: sessionApisReady,
        classicReviewReady: classicReviewReady,
        playableMoves: playableMoves,
        syncClassicBoardToPly: syncClassicBoardToPly,
        attach: attach,
        bindClassicNav: bindClassicNav,
        bootWhenReady: bootWhenReady,
    };

    global.ShmerlingMobileSessionReview = MobileSessionReview;

    if (typeof global.document !== "undefined") {
        if (global.document.readyState === "loading") {
            global.document.addEventListener("DOMContentLoaded", bootWhenReady);
        } else {
            bootWhenReady();
        }
    }

    if (typeof module === "object" && module && module.exports) {
        module.exports = MobileSessionReview;
    }
})(typeof window !== "undefined" ? window : globalThis);
