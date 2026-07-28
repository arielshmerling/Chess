/**
 * Mobile session local-engine adapter (Phase 8 slice 2).
 *
 * Binds GameSession + LocalEngineMode on /mobile-game for SinglePlayerGame when
 * gameInfo.clientEngine is set. Keeps mobile CSS/DOM and classic chessboard
 * drawing; brain runs via EnginePort (HTTP) instead of server makeBrainMove.
 *
 * Dual export for Node characterization tests.
 */
(function (global) {
    "use strict";

    /**
     * @returns {boolean}
     */
    function isMobileGamePage() {
        try {
            if (global.document && global.document.body &&
                global.document.body.classList.contains("mobile-game-shell")) {
                const path = (global.location && global.location.pathname) || "";
                if (path === "/mobile-review" || path.indexOf("/mobile-review") === 0) {
                    return false;
                }
                return path === "/mobile-game" || path.indexOf("/mobile-game") === 0 ||
                    !!(global.document.getElementById("main") &&
                        global.document.getElementById("main").classList.contains("mobile-game-page"));
            }
            return false;
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
            global.ShmerlingLocalEngineMode &&
            typeof global.ShmerlingLocalEngineMode.create === "function" &&
            global.ShmerlingCreateEnginePort &&
            typeof global.ShmerlingCreateEnginePort.create === "function"
        );
    }

    /**
     * @param {object} [gameInfo]
     * @returns {boolean}
     */
    function shouldAttach(gameInfo) {
        const info = gameInfo || global.gameInfo;
        return !!(
            info &&
            info.gameType === "SinglePlayerGame" &&
            info.clientEngine === true &&
            !info.watcher &&
            info.mode !== "review"
        );
    }

    /**
     * Convert a client-board move to server white-view coordinates.
     * @param {object} move
     * @param {object} game
     * @returns {object}
     */
    function toServerWhiteViewMove(move, game) {
        if (!move || !game) {
            return move;
        }
        if (game.WhitePlayerView) {
            return move;
        }
        if (typeof game.flipMove === "function") {
            return game.flipMove(move);
        }
        return move;
    }

    /**
     * Strip non-schema fields and ensure timers for WS validation.
     * @param {object} move
     * @param {object} timers
     * @returns {object}
     */
    function movePayloadForServer(move, timers) {
        const t = timers || {};
        const out = Object.assign({}, move);
        if (typeof out.moveTime !== "number") {
            out.moveTime = typeof t.moveTime === "number" ? t.moveTime : 0;
        }
        if (typeof t.whiteTimer === "number") {
            out.whiteTimer = t.whiteTimer;
        }
        if (typeof t.blackTimer === "number") {
            out.blackTimer = t.blackTimer;
        }
        return out;
    }

    /**
     * @param {object} [options]
     * @returns {{ session: object, localEngineMode: object, dispose: function }|null}
     */
    function attach(options) {
        const opts = options || {};
        if (!sessionApisReady()) {
            return null;
        }
        const game = opts.game || global.game;
        const gameInfo = opts.gameInfo || global.gameInfo;
        if (!game || !shouldAttach(gameInfo)) {
            return null;
        }

        const humanIsWhite =
            typeof opts.currentPlayerIsWhite === "boolean"
                ? opts.currentPlayerIsWhite
                : typeof global.currentPlayerIsWhite === "boolean"
                  ? global.currentPlayerIsWhite
                  : true;

        const enginePort = global.ShmerlingCreateEnginePort.create({ isElectron: false });
        const difficulty =
            gameInfo.difficulty != null ? Number(gameInfo.difficulty) : 3;

        const session = global.ShmerlingGameSession.create({
            game: game,
            humanIsWhite: humanIsWhite,
            engine: enginePort,
            meta: {
                engine: gameInfo.engine || "brain43",
                difficulty: difficulty,
                thinkingTimeSeconds: difficulty,
                mobileLocalEngine: true,
            },
        });

        let wrappedSendMove = false;
        let originalSendMove = null;

        const localEngineMode = global.ShmerlingLocalEngineMode.create({
            autoRunOnAttach: false,
            canRun: function () {
                /* Do not read window.animating — chessboard keeps animating as a let binding. */
                return !(
                    global.dialogOn ||
                    (game && game.GameOver)
                );
            },
            applyEngineMove: async function (move) {
                return applyClassicEngineMove(move, {
                    game: game,
                    gameInfo: gameInfo,
                    humanIsWhite: humanIsWhite,
                });
            },
            onStatus: function (message, kind) {
                /* Mobile board flash is full-screen — only surface errors, not "Engine thinking…". */
                if (kind === "error" && typeof global.displayMessage === "function" && message) {
                    global.displayMessage(String(message), 3000);
                }
            },
        });

        session.attachMode(localEngineMode);
        session.load({
            active: true,
            humanIsWhite: humanIsWhite,
            meta: {
                engine: gameInfo.engine || "brain43",
                difficulty: difficulty,
                thinkingTimeSeconds: difficulty,
                mobileLocalEngine: true,
            },
        });

        function runEngineAfterHumanMove() {
            if (localEngineMode && typeof localEngineMode.maybeRunEngine === "function") {
                return localEngineMode.maybeRunEngine("afterHumanMove");
            }
            return null;
        }

        /* Direct hook from chessboard tryMove (more reliable than wrapping sendMove alone). */
        global.__SHMERLING_AFTER_HUMAN_MOVE__ = runEngineAfterHumanMove;

        if (typeof global.sendMove === "function") {
            originalSendMove = global.sendMove;
            wrappedSendMove = true;
            global.sendMove = async function (moveObj) {
                const result = await originalSendMove.apply(this, arguments);
                Promise.resolve().then(runEngineAfterHumanMove);
                return result;
            };
        }

        Promise.resolve().then(function () {
            return localEngineMode.maybeRunEngine("attach");
        });

        function dispose() {
            if (global.__SHMERLING_AFTER_HUMAN_MOVE__ === runEngineAfterHumanMove) {
                try {
                    delete global.__SHMERLING_AFTER_HUMAN_MOVE__;
                } catch {
                    global.__SHMERLING_AFTER_HUMAN_MOVE__ = null;
                }
            }
            if (wrappedSendMove && originalSendMove) {
                global.sendMove = originalSendMove;
            }
            if (localEngineMode && typeof localEngineMode.detach === "function") {
                localEngineMode.detach();
            }
            if (session && typeof session.dispose === "function") {
                session.dispose();
            }
        }

        return {
            session: session,
            localEngineMode: localEngineMode,
            dispose: dispose,
        };
    }

    /**
     * Animate + makeMove on classic board, then sync AI ply to server.
     * @param {object} move
     * @param {object} ctx
     * @returns {Promise<boolean>}
     */
    async function applyClassicEngineMove(move, ctx) {
        const game = ctx.game;
        const gameInfo = ctx.gameInfo;
        if (!move || !game || game.GameOver) {
            return false;
        }

        try {
            if (typeof global.animateMove === "function") {
                try {
                    await global.animateMove(move, { skipFinalSync: true });
                } catch (animErr) {
                    /* Apply move even if animation cannot run (missing img, etc.). */
                }
            }

            let moveObj;
            if (move.promotion) {
                moveObj = game.makeMove(move.source, move.target);
                if (move.selectedPiece != null) {
                    const promo = Object.assign({}, moveObj, {
                        selectedPiece: move.selectedPiece,
                        promotion: true,
                    });
                    game.completePromotion(promo);
                    moveObj = promo;
                }
            } else {
                moveObj = game.makeMove(move.source, move.target);
            }

            if (!moveObj) {
                return false;
            }

            global.lastMove = moveObj;

            if (typeof global.switchClocks === "function") {
                global.switchClocks();
            }

            const aiIsWhite = !ctx.humanIsWhite;
            const whiteTimer = typeof global.whiteTimer === "number" ? global.whiteTimer : 0;
            const blackTimer = typeof global.blackTimer === "number" ? global.blackTimer : 0;
            const moveTime = aiIsWhite ? whiteTimer : blackTimer;
            const serverMove = movePayloadForServer(
                toServerWhiteViewMove(moveObj, game),
                { moveTime: moveTime, whiteTimer: whiteTimer, blackTimer: blackTimer },
            );

            if (typeof global.sendMessage === "function" && gameInfo && gameInfo.id) {
                await global.sendMessage({
                    type: "cmd",
                    info: "clientEngineMove",
                    data: serverMove,
                    gameId: gameInfo.id,
                    userId: gameInfo.userId,
                    username: gameInfo.username,
                    isWhite: aiIsWhite,
                    moveTime: moveTime,
                    whiteTimer: whiteTimer,
                    blackTimer: blackTimer,
                });
            }

            if (typeof global.moveAccepted === "function") {
                await global.moveAccepted(moveObj);
            }

            if (typeof global.getMovesForTable === "function" &&
                typeof global.updateMovesTable === "function") {
                const gameMoves = await global.getMovesForTable();
                global.gameMoves = gameMoves;
                global.updateMovesTable(gameMoves.moves || []);
                global.moveIndex = gameMoves.moves ? gameMoves.moves.length : 0;
            }

            if (typeof global.sendMessage === "function" && gameInfo && gameInfo.id) {
                await global.sendMessage({
                    type: "info",
                    info: "clockSync",
                    gameId: gameInfo.id,
                    whiteTimer: whiteTimer,
                    blackTimer: blackTimer,
                });
            }

            if (typeof global.applyMousePreference === "function" &&
                gameInfo && gameInfo.mousePreference === "double") {
                global.applyMousePreference("double");
            }

            return true;
        } catch (err) {
            if (typeof console !== "undefined" && console.warn) {
                console.warn("[MobileSessionLocalEngine] applyEngineMove failed:", err);
            }
            return false;
        }
    }

    function bootWhenReady() {
        if (!isMobileGamePage() || !sessionApisReady()) {
            return;
        }

        function tryAttach() {
            if (global.__SHMERLING_MOBILE_LOCAL_ENGINE_SESSION__) {
                return true;
            }
            const gameInfo = global.gameInfo;
            const game = global.game;
            if (!game || !gameInfo || !gameInfo.gameType) {
                return false;
            }
            if (!shouldAttach(gameInfo)) {
                return false;
            }
            const bridge = attach({
                game: game,
                gameInfo: gameInfo,
                currentPlayerIsWhite: global.currentPlayerIsWhite !== false,
            });
            if (!bridge) {
                console.warn("[MobileSessionLocalEngine] Could not attach LocalEngineMode");
                return false;
            }
            global.__SHMERLING_MOBILE_LOCAL_ENGINE_SESSION__ = bridge;
            console.log("[MobileSessionLocalEngine] LocalEngineMode attached");
            return true;
        }

        if (typeof global.document !== "undefined") {
            global.document.addEventListener("shmerling-chessboard-ready", function onReady() {
                tryAttach();
            });
        }

        let tries = 0;
        const maxTries = 200;
        const handle = setInterval(function () {
            tries += 1;
            if (tryAttach() || tries >= maxTries) {
                clearInterval(handle);
            }
        }, 100);
    }

    const MobileSessionLocalEngine = {
        isMobileGamePage: isMobileGamePage,
        sessionApisReady: sessionApisReady,
        shouldAttach: shouldAttach,
        toServerWhiteViewMove: toServerWhiteViewMove,
        movePayloadForServer: movePayloadForServer,
        attach: attach,
        applyClassicEngineMove: applyClassicEngineMove,
        bootWhenReady: bootWhenReady,
    };

    global.ShmerlingMobileSessionLocalEngine = MobileSessionLocalEngine;

    if (typeof global.document !== "undefined") {
        if (global.document.readyState === "loading") {
            global.document.addEventListener("DOMContentLoaded", bootWhenReady);
        } else {
            bootWhenReady();
        }
    }

    if (typeof module === "object" && module && module.exports) {
        module.exports = MobileSessionLocalEngine;
    }
})(typeof window !== "undefined" ? window : globalThis);
