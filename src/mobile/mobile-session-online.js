/**
 * Mobile session online adapter (Phase 8 slices 3–4).
 *
 * Binds GameSession + OnlineMode on /mobile-game (and mobile /watch → mobile-game)
 * for OnlineGame participants and watchers. Keeps mobile CSS/DOM and classic
 * chessboard drawing; MatchTransport owns /ws (classic startWebSockets skipped).
 *
 * Dual export for Node characterization tests.
 */
(function (global) {
    "use strict";

    const t =
        typeof module === "object" && module && module.exports
            ? require("../strings/t-bridge").t
            : typeof global.ShmerlingT === "function"
              ? global.ShmerlingT
              : function (key) {
                    return key;
                };

    /**
     * @returns {boolean}
     */
    function isMobileGamePage() {
        try {
            if (
                global.document &&
                global.document.body &&
                global.document.body.classList.contains("mobile-game-shell")
            ) {
                const path = (global.location && global.location.pathname) || "";
                if (path === "/mobile-review" || path.indexOf("/mobile-review") === 0) {
                    return false;
                }
                /* /watch on mobile renders mobile-game.ejs (Phase 8 watch shell). */
                if (path === "/watch" || path.indexOf("/watch") === 0) {
                    return true;
                }
                return (
                    path === "/mobile-game" ||
                    path.indexOf("/mobile-game") === 0 ||
                    !!(
                        global.document.getElementById("main") &&
                        global.document
                            .getElementById("main")
                            .classList.contains("mobile-game-page")
                    )
                );
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
            global.ShmerlingOnlineMode &&
            typeof global.ShmerlingOnlineMode.create === "function" &&
            global.ShmerlingWsTransport &&
            typeof global.ShmerlingWsTransport.create === "function"
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
            info.gameType === "OnlineGame" &&
            info.mode !== "review"
        );
    }

    /**
     * @param {object} [gameInfo]
     * @returns {boolean}
     */
    function isWatcherSession(gameInfo) {
        const info = gameInfo || global.gameInfo;
        return !!(info && info.watcher);
    }

    /**
     * @returns {{ white: number, black: number }}
     */
    function readClassicClocks() {
        return {
            white: typeof global.whiteTimer === "number" ? global.whiteTimer : 0,
            black: typeof global.blackTimer === "number" ? global.blackTimer : 0,
        };
    }

    /**
     * @param {{ white?: number, black?: number }} snapshot
     */
    function writeClassicClocks(snapshot) {
        if (!snapshot) {
            return;
        }
        if (typeof snapshot.white === "number") {
            global.whiteTimer = snapshot.white;
            if (global.whiteHandle) {
                clearInterval(global.whiteHandle);
                global.whiteHandle = null;
            }
            const whiteClock = global.document && global.document.getElementById("whiteClockTimeText");
            if (whiteClock && typeof global.timerToText === "function") {
                whiteClock.innerText = global.timerToText(global.whiteTimer);
            }
        }
        if (typeof snapshot.black === "number") {
            global.blackTimer = snapshot.black;
            if (global.blackHandle) {
                clearInterval(global.blackHandle);
                global.blackHandle = null;
            }
            const blackClock = global.document && global.document.getElementById("blackClockTimeText");
            if (blackClock && typeof global.timerToText === "function") {
                blackClock.innerText = global.timerToText(global.blackTimer);
            }
        }
        if (typeof global.switchClocks === "function" && global.game && !global.game.GameOver) {
            global.switchClocks();
        }
    }

    /**
     * Mirror classic WS opponent-move side effects (no outbound re-send).
     * @param {object} move
     * @param {object} ctx
     * @returns {Promise<boolean>}
     */
    async function applyClassicRemoteMove(move, ctx) {
        const game = ctx.game;
        const gameInfo = ctx.gameInfo;
        if (!move || !game || game.GameOver) {
            return false;
        }

        const adjusted =
            typeof global.adjustIncomingNetworkMoveForBoardView === "function"
                ? global.adjustIncomingNetworkMoveForBoardView(move)
                : move;

        try {
            if (adjusted.promotion && adjusted.selectedPiece == null) {
                return false;
            }

            if (typeof global.animateMove === "function") {
                try {
                    await global.animateMove(adjusted, { skipFinalSync: true });
                } catch (animErr) {
                    /* Apply move even if animation cannot run (missing img, etc.). */
                }
            }

            let moveObj;
            if (adjusted.promotion) {
                moveObj = game.makeMove(adjusted.source, adjusted.target);
                game.completePromotion(adjusted);
            } else {
                moveObj = game.makeMove(adjusted.source, adjusted.target);
            }

            global.lastMove = moveObj;

            if (typeof global.moveAccepted === "function") {
                await global.moveAccepted(moveObj);
            }

            if (adjusted.moveTime != null && typeof adjusted.moveTime === "number") {
                const moverIsWhite =
                    ctx.moverIsWhite != null
                        ? ctx.moverIsWhite
                        : !ctx.humanIsWhite;
                if (moverIsWhite) {
                    global.whiteTimer = adjusted.moveTime;
                    if (global.whiteHandle) {
                        clearInterval(global.whiteHandle);
                        global.whiteHandle = null;
                    }
                    const whiteClock =
                        global.document && global.document.getElementById("whiteClockTimeText");
                    if (whiteClock && typeof global.timerToText === "function") {
                        whiteClock.innerText = global.timerToText(global.whiteTimer);
                    }
                } else {
                    global.blackTimer = adjusted.moveTime;
                    if (global.blackHandle) {
                        clearInterval(global.blackHandle);
                        global.blackHandle = null;
                    }
                    const blackClock =
                        global.document && global.document.getElementById("blackClockTimeText");
                    if (blackClock && typeof global.timerToText === "function") {
                        blackClock.innerText = global.timerToText(global.blackTimer);
                    }
                }
            }

            if (typeof global.switchClocks === "function") {
                global.switchClocks();
            }

            if (
                typeof global.getMovesForTable === "function" &&
                typeof global.updateMovesTable === "function"
            ) {
                const gameMoves = await global.getMovesForTable();
                global.gameMoves = gameMoves;
                global.updateMovesTable(gameMoves.moves || []);
                global.moveIndex = gameMoves.moves ? gameMoves.moves.length : 0;
                const td =
                    global.document &&
                    global.document.getElementById("td_move" + global.moveIndex);
                if (td && typeof global.scrollMoveCellIntoView === "function") {
                    global.scrollMoveCellIntoView(td);
                }
            }

            if (
                gameInfo &&
                gameInfo.gameType === "OnlineGame" &&
                !gameInfo.watcher &&
                !game.GameOver &&
                typeof global.syncOnlineGameDrawButton === "function"
            ) {
                global.syncOnlineGameDrawButton();
            }

            if (
                typeof global.applyMousePreference === "function" &&
                gameInfo &&
                gameInfo.mousePreference === "double"
            ) {
                global.applyMousePreference("double");
            }

            return true;
        } catch (err) {
            if (typeof console !== "undefined" && console.warn) {
                console.warn("[MobileSessionOnline] applyRemoteMove failed:", err);
            }
            return false;
        }
    }

    /**
     * @param {object} [options]
     * @returns {{ session: object, onlineMode: object, transport: object, dispose: function }|null}
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
        const watcher = opts.watcher === true || isWatcherSession(gameInfo);

        const transport = global.ShmerlingWsTransport.create({});
        const session = global.ShmerlingGameSession.create({
            game: game,
            humanIsWhite: humanIsWhite,
            engine: null,
            meta: {
                mobileOnline: true,
                mobileWatch: watcher,
                whitePlayerName: gameInfo.whitePlayerName,
                blackPlayerName: gameInfo.blackPlayerName,
            },
        });

        let originalSendMessage = null;
        let wrappedSendMessage = false;

        const onlineMode = global.ShmerlingOnlineMode.create({
            transport: transport,
            gameInfo: {
                id: gameInfo.id,
                username: gameInfo.username,
                userId: gameInfo.userId,
                creatorId: gameInfo.creatorId,
                whitePlayerName: gameInfo.whitePlayerName,
                blackPlayerName: gameInfo.blackPlayerName,
            },
            humanIsWhite: humanIsWhite,
            watcher: watcher,
            wsUrl:
                typeof global.ShmerlingWsTransport.defaultWsUrl === "function"
                    ? global.ShmerlingWsTransport.defaultWsUrl()
                    : null,
            getClocks: readClassicClocks,
            setClocks: writeClassicClocks,
            applyRemoteMove: async function (move, meta) {
                return applyClassicRemoteMove(move, {
                    game: game,
                    gameInfo: gameInfo,
                    humanIsWhite: humanIsWhite,
                    moverIsWhite: meta && meta.moverIsWhite,
                });
            },
            cancelBeforeMove: async function (gameId) {
                if (watcher) {
                    return;
                }
                try {
                    await fetch("/cancel-before-move", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ gameId: gameId }),
                    });
                } catch {
                    /* ignore */
                }
            },
            onStatus: function (message) {
                if (typeof global.displayMessage === "function" && message) {
                    global.displayMessage(String(message), 3000);
                }
            },
            onOpponentJoined: function (name) {
                const label =
                    name && String(name).trim() ? String(name).trim() : t("session.opponentDefault");
                if (watcher) {
                    /* Spectators keep both name plates from gameInfo / later updates. */
                    return;
                }
                const el = global.document &&
                    global.document.getElementById(
                        humanIsWhite ? "blackPlayerName" : "whitePlayerName",
                    );
                if (el) {
                    el.innerText = label;
                }
                if (humanIsWhite) {
                    gameInfo.blackPlayerName = label;
                } else {
                    gameInfo.whitePlayerName = label;
                }
                if (typeof global.enableButtons === "function") {
                    global.enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
                }
                if (typeof global.syncOnlineGameDrawButton === "function") {
                    global.syncOnlineGameDrawButton();
                }
            },
            onOpponentDisconnected: function () {
                if (watcher) {
                    return;
                }
                if (typeof global.startDisconnectionTimer === "function") {
                    global.startDisconnectionTimer();
                }
            },
            onOpponentRejoined: function () {
                if (typeof global.hideDisconnectionCountdown === "function") {
                    global.hideDisconnectionCountdown();
                }
            },
            onDrawOffered: function () {
                if (watcher) {
                    return;
                }
                if (typeof global.messageBox === "function") {
                    global.messageBox(
                        t("mobile.drawOfferAgree"),
                        function () {
                            if (onlineMode && onlineMode.acceptDrawOffer) {
                                onlineMode.acceptDrawOffer();
                            }
                        },
                        function () {
                            if (onlineMode && onlineMode.declineDrawOffer) {
                                onlineMode.declineDrawOffer();
                            }
                        },
                    );
                }
            },
            onRematchOffered: function (payload) {
                if (watcher) {
                    return;
                }
                if (typeof global.messageBox === "function") {
                    global.messageBox(
                        t("mobile.rematchOfferAgree"),
                        function () {
                            const wants =
                                payload &&
                                (payload.offererWantsColor === "white" ||
                                    payload.offererWantsColor === "black")
                                    ? payload.offererWantsColor
                                    : undefined;
                            if (onlineMode && onlineMode.acceptRematchOffer) {
                                onlineMode.acceptRematchOffer(wants);
                            }
                        },
                        function () {
                            if (onlineMode && onlineMode.declineRematchOffer) {
                                onlineMode.declineRematchOffer();
                            }
                        },
                    );
                }
            },
            onRematchAccepted: function (payload) {
                if (watcher) {
                    if (typeof global.displayMessage === "function") {
                        global.displayMessage(t("mobile.newGameWatchFromHome"), 4000);
                    }
                    return;
                }
                const newId = payload && payload.gameId;
                if (newId == null) {
                    return;
                }
                /* Full reload so classic + adapter re-boot on the new game id. */
                global.location.href =
                    "/mobile-game?id=" + encodeURIComponent(String(newId));
            },
            onGameCancelled: function () {
                if (typeof global.displayMessage === "function") {
                    global.displayMessage(t("classic.gameCancelled"), 3000);
                }
            },
            onDisconnectCountdown: function (seconds) {
                if (watcher) {
                    return;
                }
                const el =
                    global.document &&
                    (humanIsWhite
                        ? global.document.getElementById("blackPlayerDiconnectionTimer")
                        : global.document.getElementById("whitePlayerDiconnectionTimer"));
                if (el && typeof global.formatDisconnectionCountdown === "function") {
                    el.classList.remove("hide");
                    el.innerText = global.formatDisconnectionCountdown(seconds);
                } else if (el) {
                    el.classList.remove("hide");
                    el.innerText = String(seconds);
                }
            },
            onDisconnectCountdownClear: function () {
                if (typeof global.hideDisconnectionCountdown === "function") {
                    global.hideDisconnectionCountdown();
                }
            },
        });

        session.attachMode(onlineMode);
        session.load({
            active: true,
            humanIsWhite: humanIsWhite,
            meta: {
                mobileOnline: true,
                mobileWatch: watcher,
                whitePlayerName: gameInfo.whitePlayerName,
                blackPlayerName: gameInfo.blackPlayerName,
            },
        });

        if (typeof global.sendMessage === "function") {
            originalSendMessage = global.sendMessage;
            wrappedSendMessage = true;
            global.sendMessage = async function (message) {
                if (transport && typeof transport.send === "function") {
                    transport.send(message);
                    return;
                }
                return originalSendMessage.apply(this, arguments);
            };
        }

        try {
            delete global.__SHMERLING_PENDING_MOBILE_ONLINE__;
        } catch {
            global.__SHMERLING_PENDING_MOBILE_ONLINE__ = null;
        }

        function dispose() {
            if (wrappedSendMessage && originalSendMessage) {
                global.sendMessage = originalSendMessage;
            }
            if (onlineMode && typeof onlineMode.detach === "function") {
                onlineMode.detach();
            }
            if (session && typeof session.dispose === "function") {
                session.dispose();
            }
        }

        return {
            session: session,
            onlineMode: onlineMode,
            transport: transport,
            dispose: dispose,
            sendRaw: function (message) {
                transport.send(message);
            },
        };
    }

    function bootWhenReady() {
        if (!isMobileGamePage() || !sessionApisReady()) {
            return;
        }

        function tryAttach() {
            if (global.__SHMERLING_MOBILE_ONLINE_SESSION__) {
                return true;
            }
            const gameInfo = global.gameInfo;
            const game = global.game;
            if (!game || !gameInfo || !gameInfo.gameType) {
                return false;
            }
            if (!shouldAttach(gameInfo)) {
                return "skip";
            }
            /* Wait until classic deferred the socket (or rematch pending). */
            if (!global.__SHMERLING_PENDING_MOBILE_ONLINE__) {
                return false;
            }
            const bridge = attach({
                game: game,
                gameInfo: gameInfo,
                currentPlayerIsWhite: global.currentPlayerIsWhite !== false,
                watcher: !!gameInfo.watcher,
            });
            if (!bridge) {
                console.warn("[MobileSessionOnline] Could not attach OnlineMode");
                return false;
            }
            global.__SHMERLING_MOBILE_ONLINE_SESSION__ = bridge;
            console.log("[MobileSessionOnline] OnlineMode attached");
            return true;
        }

        if (typeof global.document !== "undefined") {
            global.document.addEventListener("shmerling-chessboard-ready", function () {
                tryAttach();
            });
        }

        let tries = 0;
        const maxTries = 200;
        const handle = setInterval(function () {
            tries += 1;
            const result = tryAttach();
            if (result === true || result === "skip" || tries >= maxTries) {
                clearInterval(handle);
            }
        }, 100);
    }

    const MobileSessionOnline = {
        isMobileGamePage: isMobileGamePage,
        sessionApisReady: sessionApisReady,
        shouldAttach: shouldAttach,
        isWatcherSession: isWatcherSession,
        readClassicClocks: readClassicClocks,
        writeClassicClocks: writeClassicClocks,
        applyClassicRemoteMove: applyClassicRemoteMove,
        attach: attach,
        bootWhenReady: bootWhenReady,
    };

    global.ShmerlingMobileSessionOnline = MobileSessionOnline;

    if (typeof global.document !== "undefined") {
        if (global.document.readyState === "loading") {
            global.document.addEventListener("DOMContentLoaded", bootWhenReady);
        } else {
            bootWhenReady();
        }
    }

    if (typeof module === "object" && module && module.exports) {
        module.exports = MobileSessionOnline;
    }
})(typeof window !== "undefined" ? window : globalThis);
