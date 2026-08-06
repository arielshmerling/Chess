/**
 * OnlineMode — multiplayer vs human over MatchTransport (Phase 3–4).
 *
 * Phase 3: connect, moves, clocks, resign, cancel-before-move, disconnect notice.
 * Phase 4: draw offer/accept/decline, rematch, reconnect countdown hooks.
 */
(function (global) {
    "use strict";

    const DISCONNECT_GRACE_MS = 1000;
    const DISCONNECT_COUNTDOWN_SEC = 60;

    function loadProtocol() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./onlineProtocol");
            } catch {
                /* fall through */
            }
        }
        return global.ShmerlingOnlineProtocol;
    }

    function loadT() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("../strings/t-bridge").t;
            } catch {
                /* fall through */
            }
        }
        return typeof global.ShmerlingT === "function" ? global.ShmerlingT : function (key) {
            return key;
        };
    }

    const t = loadT();

    function loadCapabilities() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./capabilities");
            } catch {
                /* fall through */
            }
        }
        return global.ShmerlingSessionCapabilities || null;
    }

    function loadContracts() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./contracts");
            } catch {
                /* fall through */
            }
        }
        return (
            global.ShmerlingSessionContracts || {
                MODE_IDS: { ONLINE: "online" },
            }
        );
    }

    /**
     * @param {object} options
     * @param {import("./contracts").MatchTransport} options.transport
     * @param {object} options.gameInfo - id, username, userId, creatorId, …
     * @param {boolean} [options.humanIsWhite=true]
     * @param {boolean} [options.watcher=false]
     * @param {string} [options.wsUrl]
     * @param {() => { white: number, black: number }} [options.getClocks]
     * @param {(clocks: { white: number, black: number }) => void} [options.setClocks]
     * @param {(move: object, meta?: object) => Promise<boolean>|boolean} [options.applyRemoteMove]
     * @param {(gameId: string|number) => Promise<void>|void} [options.cancelBeforeMove]
     * @param {(msg: string, kind?: string) => void} [options.onStatus]
     * @param {(name: string) => void} [options.onOpponentJoined]
     * @param {(payload?: object) => void} [options.onOpponentDisconnected]
     * @param {() => void} [options.onOpponentRejoined]
     * @param {(payload: object) => void} [options.onGameCancelled]
     * @param {(payload?: object) => void} [options.onDrawOffered]
     * @param {(payload?: object) => void} [options.onRematchOffered]
     * @param {(payload: { gameId: string|number }) => void} [options.onRematchAccepted]
     * @param {(payload?: object) => void} [options.onRematchCancelled]
     * @param {(payload?: object) => void|Promise<void>} [options.onConnected]
     * @param {() => void} [options.onConnectionLost]
     * @param {() => void} [options.onConnectionRestored]
     * @param {(seconds: number) => void} [options.onDisconnectCountdown]
     * @param {() => void} [options.onDisconnectCountdownEnd]
     * @param {() => void} [options.onDisconnectCountdownClear]
     */
    function create(options) {
        const opts = options || {};
        const protocol = loadProtocol();
        const capsApi = loadCapabilities();
        const contracts = loadContracts();
        const transport = opts.transport;
        if (!transport) {
            throw new Error("OnlineMode requires a MatchTransport");
        }
        if (!opts.gameInfo || opts.gameInfo.id == null) {
            throw new Error("OnlineMode requires gameInfo.id");
        }

        let session = null;
        let connected = false;
        let connectionLost = false;
        let closingIntentionally = false;
        let reconnectTimer = null;
        let reconnectAttempt = 0;
        let handlersBound = false;
        let applyingRemote = false;
        /** Serialize async inbound handling so watch/online animations cannot race. */
        let inboundChain = Promise.resolve();
        let humanIsWhite = opts.humanIsWhite !== false;
        let watcher = opts.watcher === true;
        const modeId = watcher
            ? (contracts.MODE_IDS && contracts.MODE_IDS.WATCH) || "watch"
            : (contracts.MODE_IDS && contracts.MODE_IDS.ONLINE) || "online";
        let gameInfo = Object.assign({}, opts.gameInfo);
        let opponentPresent =
            !!(gameInfo.blackPlayerName && String(gameInfo.blackPlayerName).trim()) ||
            !humanIsWhite ||
            watcher;
        /** After game over, rematch requires the peer still connected to this finished game. */
        let rematchPeerAvailable = true;
        let disconnectGraceTimer = null;
        let disconnectCountdownHandle = null;
        let disconnectSecondsLeft = 0;
        /** @type {boolean|null} which seat disconnected (from server payload) */
        let disconnectedWasWhite = null;

        function playerLabelForSide(isWhiteSide) {
            if (isWhiteSide === true) {
                const n = gameInfo.whitePlayerName && String(gameInfo.whitePlayerName).trim();
                return n || t("common.white");
            }
            if (isWhiteSide === false) {
                const n = gameInfo.blackPlayerName && String(gameInfo.blackPlayerName).trim();
                return n || t("common.black");
            }
            return t("common.aPlayer");
        }

        function watcherDisconnectWaitingStatus() {
            return t("session.playerDisconnectedWaitingRejoin", {
                name: playerLabelForSide(disconnectedWasWhite),
            });
        }

        function capabilities() {
            if (capsApi && typeof capsApi.getModeCapabilities === "function") {
                return capsApi.getModeCapabilities(modeId);
            }
            if (watcher) {
                return {
                    undo: false,
                    redo: false,
                    resign: false,
                    draw: false,
                    rematch: false,
                    engine: false,
                    network: true,
                    reviewNav: false,
                    positionSetup: false,
                    watchers: true,
                    chat: false,
                };
            }
            return {
                undo: false,
                redo: false,
                resign: true,
                draw: true,
                rematch: true,
                engine: false,
                network: true,
                reviewNav: false,
                positionSetup: false,
                watchers: false,
                chat: true,
            };
        }

        function status(message, kind) {
            if (typeof opts.onStatus === "function") {
                opts.onStatus(message, kind);
            } else if (session) {
                session.emit("info", message, kind || "info");
            }
        }

        function readClocks() {
            if (typeof opts.getClocks === "function") {
                return opts.getClocks() || {};
            }
            return {};
        }

        function writeClocks(snapshot) {
            if (!snapshot) {
                return;
            }
            if (typeof opts.setClocks === "function") {
                opts.setClocks(snapshot);
            }
            if (session) {
                session.emit("clocksUpdated", snapshot, { source: "network" });
            }
        }

        function applyClockFields(source, moverIsWhite) {
            const merged = protocol.mergeClockSnapshot(
                readClocks(),
                source,
                moverIsWhite,
            );
            if (merged) {
                writeClocks(merged);
            }
        }

        function identityPayload() {
            return {
                username: gameInfo.username,
                isWhite: humanIsWhite,
                gameId: gameInfo.id,
                creatorId: gameInfo.creatorId,
                userId: gameInfo.userId,
                watcher: watcher,
            };
        }

        function sendConnect() {
            transport.send(protocol.buildConnectMessage(identityPayload()));
        }

        function sendInfo(info, extra) {
            const payload = Object.assign(
                {
                    info: info,
                    gameId: gameInfo.id,
                    userId: gameInfo.userId,
                    username: gameInfo.username,
                    isWhite: humanIsWhite,
                },
                extra || {},
            );
            transport.send(protocol.buildInfoMessage(payload));
        }

        /**
         * @param {string} text
         * @returns {boolean}
         */
        function sendChat(text) {
            if (watcher || !connected || connectionLost) {
                if (!watcher && (!connected || connectionLost)) {
                    status(t("session.connectionLost"), "error");
                }
                return false;
            }
            const line = text != null ? String(text).trim() : "";
            if (!line) {
                return false;
            }
            transport.send(
                protocol.buildInfoMessage({
                    info: "chat",
                    gameId: gameInfo.id,
                    userId: gameInfo.userId,
                    username: gameInfo.username,
                    isWhite: humanIsWhite,
                    data: line.slice(0, 2000),
                }),
            );
            return true;
        }

        function clearDisconnectGrace() {
            if (disconnectGraceTimer != null) {
                clearTimeout(disconnectGraceTimer);
                disconnectGraceTimer = null;
            }
        }

        function clearDisconnectCountdown() {
            if (disconnectCountdownHandle != null) {
                clearInterval(disconnectCountdownHandle);
                disconnectCountdownHandle = null;
            }
            disconnectSecondsLeft = 0;
            if (typeof opts.onDisconnectCountdownClear === "function") {
                opts.onDisconnectCountdownClear();
            }
        }

        function startDisconnectCountdown() {
            clearDisconnectCountdown();
            disconnectSecondsLeft = DISCONNECT_COUNTDOWN_SEC;
            if (typeof opts.onDisconnectCountdown === "function") {
                opts.onDisconnectCountdown(disconnectSecondsLeft, {
                    disconnectedWasWhite: disconnectedWasWhite,
                });
            }
            disconnectCountdownHandle = setInterval(function () {
                const game = session && session.getGame && session.getGame();
                if (game && game.GameOver) {
                    clearDisconnectCountdown();
                    return;
                }
                disconnectSecondsLeft -= 1;
                if (disconnectSecondsLeft <= 0) {
                    clearDisconnectCountdown();
                    if (typeof opts.onDisconnectCountdownEnd === "function") {
                        opts.onDisconnectCountdownEnd({
                            disconnectedWasWhite: disconnectedWasWhite,
                        });
                    }
                    return;
                }
                if (typeof opts.onDisconnectCountdown === "function") {
                    opts.onDisconnectCountdown(disconnectSecondsLeft, {
                        disconnectedWasWhite: disconnectedWasWhite,
                    });
                }
            }, 1000);
        }

        function onOpponentDisconnectedInbound(payload) {
            clearDisconnectGrace();
            if (payload && typeof payload.disconnectedWasWhite === "boolean") {
                disconnectedWasWhite = payload.disconnectedWasWhite;
            } else {
                disconnectedWasWhite = null;
            }
            const game = session && session.getGame && session.getGame();
            const postGame = !!(game && game.GameOver);
            if (postGame) {
                rematchPeerAvailable = false;
                opponentPresent = false;
                if (typeof opts.onOpponentDisconnected === "function") {
                    opts.onOpponentDisconnected(payload || {});
                }
                if (typeof opts.onRematchCancelled === "function") {
                    opts.onRematchCancelled({ reason: "peerLeft" });
                }
                if (session) {
                    session.emit("opponentDisconnected", payload || {});
                }
                status(t("session.rematchUnavailable"), "info");
                return;
            }
            disconnectGraceTimer = setTimeout(function () {
                disconnectGraceTimer = null;
                if (typeof opts.onOpponentDisconnected === "function") {
                    opts.onOpponentDisconnected(payload || {});
                }
                if (session) {
                    session.emit("opponentDisconnected", payload || {});
                }
                if (watcher) {
                    status(watcherDisconnectWaitingStatus(), "info");
                } else {
                    status(t("session.opponentDisconnected"), "info");
                }
                startDisconnectCountdown();
            }, DISCONNECT_GRACE_MS);
        }

        function onOpponentRejoinedInbound(payload) {
            const quickRejoin = disconnectGraceTimer != null;
            const rejoinedWasWhite =
                payload && typeof payload.rejoinedWasWhite === "boolean"
                    ? payload.rejoinedWasWhite
                    : disconnectedWasWhite;
            clearDisconnectGrace();
            clearDisconnectCountdown();
            disconnectedWasWhite = null;
            opponentPresent = true;
            rematchPeerAvailable = true;
            if (typeof opts.onOpponentRejoined === "function") {
                opts.onOpponentRejoined(payload || {});
            }
            if (session) {
                session.emit("opponentRejoined", payload || {});
            }
            if (!quickRejoin) {
                if (watcher) {
                    status(t("session.playerRejoined", { name: playerLabelForSide(rejoinedWasWhite) }), "info");
                } else {
                    status(t("session.opponentRejoined"), "info");
                }
            }
        }

        function canOfferDraw() {
            if (!session || watcher) {
                return false;
            }
            const game = session.getGame && session.getGame();
            if (!game || game.GameOver) {
                return false;
            }
            const moves = Array.isArray(game.Moves) ? game.Moves : [];
            const humanHasMoved = humanIsWhite
                ? moves.length >= 1
                : moves.length >= 2;
            const myTurn =
                typeof session.isHumanTurn === "function"
                    ? session.isHumanTurn()
                    : false;
            return humanHasMoved && !myTurn;
        }

        function offerDraw() {
            if (!canOfferDraw()) {
                return false;
            }
            sendInfo("offer draw");
            status(t("session.drawOfferSent"), "info");
            return true;
        }

        function acceptDrawOffer() {
            if (!session || watcher) {
                return false;
            }
            sendInfo("draw accepted");
            const offerBy = humanIsWhite ? "black" : "white";
            applyingRemote = true;
            try {
                if (typeof session.acceptDraw === "function") {
                    session.acceptDraw(offerBy);
                }
            } finally {
                applyingRemote = false;
            }
            return true;
        }

        function declineDrawOffer() {
            if (watcher) {
                return false;
            }
            sendInfo("draw declined");
            status(t("session.drawOfferDeclined"), "info");
            return true;
        }

        function offerRematch(offererWantsColor, timeMinutes) {
            if (!session || watcher) {
                return false;
            }
            const game = session.getGame && session.getGame();
            if (!game || !game.GameOver) {
                return false;
            }
            if (!rematchPeerAvailable) {
                status(t("session.rematchUnavailable"), "error");
                return false;
            }
            const color =
                offererWantsColor === "white" || offererWantsColor === "black"
                    ? offererWantsColor
                    : null;
            const extra = {};
            if (color) {
                extra.offererWantsColor = color;
            }
            const tm =
                typeof timeMinutes === "number" && timeMinutes >= 1 && timeMinutes <= 180
                    ? Math.round(timeMinutes)
                    : null;
            if (tm != null) {
                extra.timeMinutes = tm;
            }
            if (Object.keys(extra).length) {
                sendInfo("offer rematch", extra);
            } else {
                sendInfo("offer rematch");
            }
            status(t("session.rematchOfferSent"), "info");
            return true;
        }

        function canOfferRematch() {
            if (watcher || !session) {
                return false;
            }
            const game = session.getGame && session.getGame();
            return !!(game && game.GameOver && rematchPeerAvailable);
        }

        function acceptRematchOffer(offererWantsColor, timeMinutes) {
            if (watcher) {
                return false;
            }
            const color =
                offererWantsColor === "white" || offererWantsColor === "black"
                    ? offererWantsColor
                    : null;
            const extra = {};
            if (color) {
                extra.offererWantsColor = color;
            }
            const tm =
                typeof timeMinutes === "number" && timeMinutes >= 1 && timeMinutes <= 180
                    ? Math.round(timeMinutes)
                    : null;
            if (tm != null) {
                extra.timeMinutes = tm;
            }
            if (Object.keys(extra).length) {
                sendInfo("rematch accepted", extra);
            } else {
                sendInfo("rematch accepted");
            }
            return true;
        }

        function declineRematchOffer() {
            if (watcher) {
                return false;
            }
            sendInfo("rematch declined");
            status(t("session.rematchOfferDeclined"), "info");
            return true;
        }

        function onDrawAccepted(message) {
            if (!session) {
                return;
            }
            const offerBy =
                message && message.isWhite === true
                    ? "black"
                    : message && message.isWhite === false
                      ? "white"
                      : humanIsWhite
                        ? "white"
                        : "black";
            applyingRemote = true;
            try {
                if (typeof session.acceptDraw === "function") {
                    session.acceptDraw(offerBy);
                }
            } finally {
                applyingRemote = false;
            }
            status(t("session.drawAgreed"), "info");
        }

        function onRematchAccepted(message) {
            const newId = message && message.gameId;
            if (newId == null) {
                status(t("session.rematchAcceptedNoGameId"), "error");
                return;
            }
            gameInfo.id = newId;
            clearDisconnectGrace();
            clearDisconnectCountdown();
            if (typeof opts.onRematchAccepted === "function") {
                opts.onRematchAccepted({ gameId: newId, message: message });
            }
            if (session) {
                session.emit("info", t("session.rematchOfferAccepted"), "info");
            }
            status(t("session.rematchOfferAccepted"), "info");
        }

        function processInbound(raw) {
            const classified = protocol.classifyInbound(raw);
            switch (classified.kind) {
                case "move":
                    return onRemoteMove(classified.payload);
                case "clockSync":
                    applyClockFields(classified.payload);
                    return;
                case "opponentJoined":
                    opponentPresent = true;
                    if (typeof opts.onOpponentJoined === "function") {
                        opts.onOpponentJoined(
                            classified.payload && classified.payload.data,
                        );
                    }
                    status(
                        t("session.opponentJoined", {
                            name:
                                classified.payload && classified.payload.data
                                    ? String(classified.payload.data)
                                    : t("session.opponentDefault"),
                        }),
                        "info",
                    );
                    if (session) {
                        session.emit("statusChanged", "opponentJoined");
                    }
                    return;
                case "opponentRejoined":
                    return onOpponentRejoinedInbound(classified.payload);
                case "opponentDisconnected":
                    return onOpponentDisconnectedInbound(classified.payload);
                case "opponentFailedReconnect":
                    clearDisconnectGrace();
                    clearDisconnectCountdown();
                    return onOpponentFailedReconnect(classified.payload);
                case "opponentResigned":
                    clearDisconnectGrace();
                    clearDisconnectCountdown();
                    return onOpponentResigned(classified.payload);
                case "opponentLeft":
                    return onOpponentLeft();
                case "gameCancelled":
                    clearDisconnectGrace();
                    clearDisconnectCountdown();
                    return onGameCancelled(classified.payload);
                case "gameOverNotice":
                    clearDisconnectGrace();
                    clearDisconnectCountdown();
                    {
                        const payload = classified.payload || {};
                        const loserRaw = payload.loser || payload.outOfTime;
                        const loser =
                            loserRaw === "white" || loserRaw === "black"
                                ? loserRaw
                                : null;
                        if (
                            loser &&
                            session &&
                            typeof session.flagTimeout === "function"
                        ) {
                            applyingRemote = true;
                            try {
                                session.flagTimeout(loser);
                            } finally {
                                applyingRemote = false;
                            }
                        }
                        status(t("session.gameOver"), "info");
                        if (session) {
                            session.emit("statusChanged", "gameOver");
                        }
                    }
                    return;
                case "moveValidated":
                    return;
                case "moveValidationFailed":
                    status(t("session.somethingWentWrong"), "error");
                    if (session && !applyingRemote) {
                        applyingRemote = true;
                        try {
                            session.resign(humanIsWhite ? "White" : "Black");
                        } finally {
                            applyingRemote = false;
                        }
                    }
                    return;
                case "offerDraw":
                    if (watcher) {
                        return;
                    }
                    if (typeof opts.onDrawOffered === "function") {
                        opts.onDrawOffered(classified.payload || {});
                    }
                    if (session) {
                        session.emit("drawOffered", classified.payload || {});
                    }
                    return;
                case "drawAccepted":
                    return onDrawAccepted(classified.payload);
                case "drawDeclined":
                    if (watcher) {
                        return;
                    }
                    status(t("session.drawOfferDeclined"), "info");
                    return;
                case "offerRematch":
                    if (watcher) {
                        return;
                    }
                    if (typeof opts.onRematchOffered === "function") {
                        opts.onRematchOffered(classified.payload || {});
                    }
                    return;
                case "rematchAccepted":
                    return onRematchAccepted(classified.payload);
                case "rematchDeclined":
                    if (watcher) {
                        return;
                    }
                    if (typeof opts.onRematchCancelled === "function") {
                        opts.onRematchCancelled({ reason: "declined" });
                    }
                    status(t("session.rematchOfferDeclined"), "info");
                    return;
                case "rematchUnavailable":
                    if (watcher) {
                        return;
                    }
                    rematchPeerAvailable = false;
                    if (typeof opts.onRematchCancelled === "function") {
                        opts.onRematchCancelled({ reason: "unavailable" });
                    }
                    status(t("session.rematchUnavailable"), "info");
                    return;
                case "chat":
                    if (watcher) {
                        return;
                    }
                    if (typeof opts.onChatMessage === "function") {
                        opts.onChatMessage(classified.payload || {});
                    }
                    return;
                case "connected":
                    connected = true;
                    if (typeof opts.onConnected === "function") {
                        return opts.onConnected(classified.payload || {});
                    }
                    return;
                default:
                    return;
            }
        }

        function handleInbound(raw) {
            inboundChain = inboundChain
                .then(function () {
                    return processInbound(raw);
                })
                .catch(function (err) {
                    console.warn(
                        "[OnlineMode] inbound error:",
                        err && err.message ? err.message : err,
                    );
                });
            return inboundChain;
        }

        async function onRemoteMove(message) {
            if (!session || !message || !message.data) {
                return;
            }
            const move = message.data;
            const moverIsWhite =
                typeof message.isWhite === "boolean"
                    ? message.isWhite
                    : !humanIsWhite;
            applyClockFields(move, moverIsWhite);

            applyingRemote = true;
            try {
                if (typeof opts.applyRemoteMove === "function") {
                    await opts.applyRemoteMove(move, {
                        source: "network",
                        moverIsWhite: moverIsWhite,
                    });
                } else {
                    session.playMove(move, { source: "network" });
                }
            } finally {
                applyingRemote = false;
            }
        }

        function onOpponentResigned(message) {
            if (!session) {
                return;
            }
            const resigned =
                message && message.isWhite === true
                    ? "White"
                    : message && message.isWhite === false
                      ? "Black"
                      : humanIsWhite
                        ? "Black"
                        : "White";
            applyingRemote = true;
            try {
                session.resign(resigned);
            } finally {
                applyingRemote = false;
            }
            status(t("session.opponentResigned"), "info");
        }

        function onOpponentLeft() {
            if (!session) {
                return;
            }
            const winnerSide = humanIsWhite ? "White" : "Black";
            const loser = winnerSide === "White" ? "Black" : "White";
            applyingRemote = true;
            try {
                session.resign(loser);
            } finally {
                applyingRemote = false;
            }
            status(t("session.opponentLeftGame"), "info");
        }

        function onOpponentFailedReconnect(message) {
            if (!session) {
                return;
            }
            const loserIsWhite =
                message && message.disconnectedWasWhite === true
                    ? true
                    : message && message.disconnectedWasWhite === false
                      ? false
                      : typeof disconnectedWasWhite === "boolean"
                        ? disconnectedWasWhite
                        : null;
            const loser =
                loserIsWhite === true
                    ? "White"
                    : loserIsWhite === false
                      ? "Black"
                      : humanIsWhite
                        ? "Black"
                        : "White";
            const winner = loser === "White" ? "Black" : "White";
            applyingRemote = true;
            try {
                session.resign(loser);
            } finally {
                applyingRemote = false;
            }
            disconnectedWasWhite = null;
            if (watcher) {
                const loserName = playerLabelForSide(loser === "White");
                const winnerName = playerLabelForSide(winner === "White");
                status(
                    t("session.playerFailedToReconnectWins", {
                        loser: loserName,
                        winner: winnerName,
                    }),
                    "info",
                );
            } else {
                status(t("session.opponentFailedToReconnect"), "info");
            }
        }

        function onGameCancelled(message) {
            const detail =
                message && message.data && String(message.data).trim()
                    ? String(message.data).trim()
                    : "";
            const shown = protocol.formatGameCancelledMessage(detail, t, "session");
            status(shown, "info");
            if (typeof opts.onGameCancelled === "function") {
                opts.onGameCancelled({ message: shown, detail: detail });
            }
            if (session) {
                session.emit("gameOver", {
                    kind: "cancelled",
                    detail: detail,
                });
                session.emit("statusChanged", "cancelled");
            }
            clearReconnectTimer();
            closingIntentionally = true;
            try {
                transport.close();
            } catch {
                /* ignore */
            }
            closingIntentionally = false;
            connected = false;
            connectionLost = false;
        }

        function sendHumanMove(executed) {
            if (watcher || !executed || applyingRemote) {
                return;
            }
            if (!connected || connectionLost || !(transport.isOpen && transport.isOpen())) {
                status(t("session.connectionLost"), "error");
                return;
            }
            const clocks = readClocks();
            const move = Object.assign({}, executed);
            if (typeof clocks.white === "number") {
                move.whiteTimer = clocks.white;
            }
            if (typeof clocks.black === "number") {
                move.blackTimer = clocks.black;
            }
            move.moveTime = humanIsWhite ? clocks.white : clocks.black;
            transport.send(
                protocol.buildMoveMessage({
                    move: move,
                    gameId: gameInfo.id,
                    username: gameInfo.username,
                    isWhite: humanIsWhite,
                }),
            );
        }

        function afterMove(sess, executed, info) {
            if (!info || info.source === "network" || info.source === "engine") {
                return;
            }
            if (info.source === "human" || info.source === "promotion" || info.source === "session") {
                sendHumanMove(executed);
            }
        }

        function clearReconnectTimer() {
            if (reconnectTimer != null) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        }

        function scheduleReconnect() {
            clearReconnectTimer();
            const attempt = reconnectAttempt;
            reconnectAttempt += 1;
            const delayMs = Math.min(1000 * Math.pow(2, Math.min(attempt, 4)), 15000);
            reconnectTimer = setTimeout(function () {
                reconnectTimer = null;
                if (closingIntentionally || !session) {
                    return;
                }
                status(t("session.reconnecting"), "info");
                try {
                    ensureConnected();
                } catch (err) {
                    scheduleReconnect();
                }
            }, delayMs);
        }

        function handleTransportClosed() {
            connected = false;
            if (closingIntentionally) {
                return;
            }
            connectionLost = true;
            status(t("session.connectionLost"), "error");
            if (typeof opts.onConnectionLost === "function") {
                opts.onConnectionLost();
            }
            if (session) {
                session.emit("connectionLost");
            }
            scheduleReconnect();
        }

        function bindTransportHandlers() {
            if (handlersBound) {
                return;
            }
            handlersBound = true;
            transport.onMessage(handleInbound);
            if (typeof transport.onOpen === "function") {
                transport.onOpen(function () {
                    const restored = connectionLost;
                    connected = true;
                    connectionLost = false;
                    reconnectAttempt = 0;
                    clearReconnectTimer();
                    sendConnect();
                    if (restored) {
                        status(t("session.connectionRestored"), "info");
                        if (typeof opts.onConnectionRestored === "function") {
                            opts.onConnectionRestored();
                        }
                        if (session) {
                            session.emit("connectionRestored");
                        }
                    } else if (!opponentPresent && humanIsWhite && !watcher) {
                        status(t("session.waitingForOpponent"), "info");
                    }
                });
            }
            if (typeof transport.onClose === "function") {
                transport.onClose(function () {
                    handleTransportClosed();
                });
            }
            if (typeof transport.onError === "function") {
                transport.onError(function (err) {
                    if (connectionLost || !connected) {
                        return;
                    }
                    status((err && err.message) || t("session.connectionError"), "error");
                });
            }
        }

        function ensureConnected() {
            if (connected && transport.isOpen && transport.isOpen()) {
                return;
            }
            bindTransportHandlers();
            if (transport.isOpen && transport.isOpen()) {
                connected = true;
                connectionLost = false;
                sendConnect();
                return;
            }
            const url =
                opts.wsUrl ||
                (global.ShmerlingWsTransport &&
                typeof global.ShmerlingWsTransport.defaultWsUrl === "function"
                    ? global.ShmerlingWsTransport.defaultWsUrl()
                    : null);
            if (!url) {
                status(t("session.couldNotResolveWebSocketUrl"), "error");
                return;
            }
            transport.connect(url);
            if (transport.isOpen && transport.isOpen()) {
                connected = true;
                connectionLost = false;
                sendConnect();
            }
        }

        function onStarted() {
            ensureConnected();
        }

        function onLoaded() {
            ensureConnected();
        }

        function onGameOver() {
            /* Local resign already sent in requestResign; remote terminals no-op. */
        }

        /**
         * Shell entry for resign / leave-as-resign.
         * @returns {Promise<boolean>}
         */
        async function requestResign() {
            if (!session || watcher) {
                return false;
            }
            const game = session.getGame && session.getGame();
            if (!game || game.GameOver) {
                return false;
            }
            const moves = Array.isArray(game.Moves) ? game.Moves : [];
            if (moves.length === 0) {
                if (typeof opts.cancelBeforeMove === "function") {
                    await opts.cancelBeforeMove(gameInfo.id);
                }
                onGameCancelled({ data: "" });
                return true;
            }
            const clocks = readClocks();
            transport.send(
                protocol.buildInfoMessage({
                    info: "resign",
                    gameId: gameInfo.id,
                    userId: gameInfo.userId,
                    username: gameInfo.username,
                    isWhite: humanIsWhite,
                    moveTime: humanIsWhite ? clocks.white : clocks.black,
                    whiteTimer: clocks.white,
                    blackTimer: clocks.black,
                }),
            );
            session.resign(humanIsWhite ? "White" : "Black");
            return true;
        }

        /**
         * Report local flag fall to the server.
         * @param {string} [loser] white|black
         */
        function reportOutOfTime(loser) {
            if (!session || watcher) {
                return;
            }
            const game = session.getGame && session.getGame();
            if (game && game.GameOver) {
                return;
            }
            const side =
                loser === "white" || loser === "black"
                    ? loser
                    : (game && (game.Turn || (game.GameState && game.GameState.turn))) ||
                      "white";
            const normalized =
                String(side).toLowerCase() === "black" ? "black" : "white";
            /*
             * Do not end the local game until the server confirms (flagFall / game over).
             * Ending early left the lobby "in progress" and allowed on-hold / resume.
             */
            transport.send(
                protocol.buildInfoMessage({
                    info: "outOfTime",
                    gameId: gameInfo.id,
                    userId: gameInfo.userId,
                    username: gameInfo.username,
                    isWhite: humanIsWhite,
                    loser: normalized,
                }),
            );
            status(t("session.flagReported"), "info");
        }

        function setGameInfo(partial) {
            gameInfo = Object.assign({}, gameInfo, partial || {});
        }

        function setHumanIsWhite(next) {
            humanIsWhite = next !== false;
        }

        function isOpponentPresent() {
            return opponentPresent;
        }

        function attach(sess) {
            session = sess;
        }

        function detach() {
            clearDisconnectGrace();
            clearDisconnectCountdown();
            clearReconnectTimer();
            closingIntentionally = true;
            try {
                transport.close();
            } catch {
                /* ignore */
            }
            closingIntentionally = false;
            connected = false;
            connectionLost = false;
            session = null;
        }

        function isConnected() {
            return !!(connected && !connectionLost && transport.isOpen && transport.isOpen());
        }

        return {
            id: modeId,
            capabilities: capabilities,
            attach: attach,
            detach: detach,
            afterMove: afterMove,
            onStarted: onStarted,
            onLoaded: onLoaded,
            onGameOver: onGameOver,
            requestResign: requestResign,
            reportOutOfTime: reportOutOfTime,
            canOfferDraw: canOfferDraw,
            offerDraw: offerDraw,
            acceptDrawOffer: acceptDrawOffer,
            declineDrawOffer: declineDrawOffer,
            offerRematch: offerRematch,
            canOfferRematch: canOfferRematch,
            acceptRematchOffer: acceptRematchOffer,
            declineRematchOffer: declineRematchOffer,
            setGameInfo: setGameInfo,
            setHumanIsWhite: setHumanIsWhite,
            isOpponentPresent: isOpponentPresent,
            isConnected: isConnected,
            ensureConnected: ensureConnected,
            clearDisconnectCountdown: clearDisconnectCountdown,
            sendChat: sendChat,
            /** @internal test helper */
            _handleInbound: handleInbound,
            /** @internal test helper */
            _simulateTransportClose: handleTransportClosed,
        };
    }

    const OnlineMode = { create: create };

    global.ShmerlingOnlineMode = OnlineMode;

    if (typeof module === "object" && module && module.exports) {
        module.exports = OnlineMode;
    }
})(typeof window !== "undefined" ? window : globalThis);
