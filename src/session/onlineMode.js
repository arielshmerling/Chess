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
        let handlersBound = false;
        let applyingRemote = false;
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
        let disconnectGraceTimer = null;
        let disconnectCountdownHandle = null;
        let disconnectSecondsLeft = 0;
        /** @type {boolean|null} which seat disconnected (from server payload) */
        let disconnectedWasWhite = null;

        function playerLabelForSide(isWhiteSide) {
            if (isWhiteSide === true) {
                const n = gameInfo.whitePlayerName && String(gameInfo.whitePlayerName).trim();
                return n || "White";
            }
            if (isWhiteSide === false) {
                const n = gameInfo.blackPlayerName && String(gameInfo.blackPlayerName).trim();
                return n || "Black";
            }
            return "A player";
        }

        function watcherDisconnectWaitingStatus() {
            return (
                playerLabelForSide(disconnectedWasWhite) +
                " disconnected — waiting for rejoin"
            );
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
                chat: false,
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
                    status("Opponent disconnected", "info");
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
            if (typeof opts.onOpponentRejoined === "function") {
                opts.onOpponentRejoined(payload || {});
            }
            if (session) {
                session.emit("opponentRejoined", payload || {});
            }
            if (!quickRejoin) {
                if (watcher) {
                    status(playerLabelForSide(rejoinedWasWhite) + " rejoined", "info");
                } else {
                    status("Opponent rejoined", "info");
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
            status("Draw offer sent", "info");
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
            status("Draw offer declined", "info");
            return true;
        }

        function offerRematch(offererWantsColor) {
            if (!session || watcher) {
                return false;
            }
            const game = session.getGame && session.getGame();
            if (!game || !game.GameOver) {
                return false;
            }
            const color =
                offererWantsColor === "white" || offererWantsColor === "black"
                    ? offererWantsColor
                    : null;
            if (color) {
                sendInfo("offer rematch", { offererWantsColor: color });
            } else {
                sendInfo("offer rematch");
            }
            status("Rematch offer sent", "info");
            return true;
        }

        function acceptRematchOffer(offererWantsColor) {
            if (watcher) {
                return false;
            }
            const color =
                offererWantsColor === "white" || offererWantsColor === "black"
                    ? offererWantsColor
                    : null;
            if (color) {
                sendInfo("rematch accepted", { offererWantsColor: color });
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
            status("Rematch offer declined", "info");
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
            status("Draw agreed", "info");
        }

        function onRematchAccepted(message) {
            const newId = message && message.gameId;
            if (newId == null) {
                status("Rematch accepted but no new game id", "error");
                return;
            }
            gameInfo.id = newId;
            clearDisconnectGrace();
            clearDisconnectCountdown();
            if (typeof opts.onRematchAccepted === "function") {
                opts.onRematchAccepted({ gameId: newId, message: message });
            }
            if (session) {
                session.emit("info", "Rematch offer accepted", "info");
            }
            status("Rematch offer accepted", "info");
        }

        function handleInbound(raw) {
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
                        (classified.payload && classified.payload.data
                            ? String(classified.payload.data)
                            : "Opponent") + " joined",
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
                    clearDisconnectCountdown();
                    status("Game over", "info");
                    if (session) {
                        session.emit("statusChanged", "gameOver");
                    }
                    return;
                case "moveValidated":
                    return;
                case "moveValidationFailed":
                    status("Something went wrong", "error");
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
                    status("Draw offer declined", "info");
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
                    status("Rematch offer declined", "info");
                    return;
                default:
                    return;
            }
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
            status("Opponent resigned", "info");
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
            status("Opponent left the game", "info");
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
                    loserName + " failed to reconnect — " + winnerName + " wins",
                    "info",
                );
            } else {
                status("Opponent failed to reconnect", "info");
            }
        }

        function onGameCancelled(message) {
            const detail =
                message && message.data && String(message.data).trim()
                    ? String(message.data).trim()
                    : "";
            const shown = detail
                ? "Game cancelled — " + detail
                : "Game cancelled";
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
            transport.close();
            connected = false;
        }

        function sendHumanMove(executed) {
            if (watcher || !connected || !executed || applyingRemote) {
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

        function bindTransportHandlers() {
            if (handlersBound) {
                return;
            }
            handlersBound = true;
            transport.onMessage(handleInbound);
            if (typeof transport.onOpen === "function") {
                transport.onOpen(function () {
                    connected = true;
                    sendConnect();
                    if (!opponentPresent && humanIsWhite && !watcher) {
                        status("Waiting for opponent…", "info");
                    }
                });
            }
            if (typeof transport.onClose === "function") {
                transport.onClose(function () {
                    connected = false;
                });
            }
            if (typeof transport.onError === "function") {
                transport.onError(function (err) {
                    status(
                        (err && err.message) || "Connection error",
                        "error",
                    );
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
                status("Could not resolve WebSocket URL", "error");
                return;
            }
            transport.connect(url);
            if (transport.isOpen && transport.isOpen()) {
                connected = true;
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
            const side =
                loser ||
                (game && (game.Turn || (game.GameState && game.GameState.turn))) ||
                "white";
            transport.send(
                protocol.buildInfoMessage({
                    info: "outOfTime",
                    gameId: gameInfo.id,
                    userId: gameInfo.userId,
                    username: gameInfo.username,
                    isWhite: humanIsWhite,
                    loser: side,
                }),
            );
            if (session && typeof session.flagTimeout === "function") {
                applyingRemote = true;
                try {
                    session.flagTimeout(side);
                } finally {
                    applyingRemote = false;
                }
            }
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
            try {
                transport.close();
            } catch {
                /* ignore */
            }
            connected = false;
            session = null;
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
            acceptRematchOffer: acceptRematchOffer,
            declineRematchOffer: declineRematchOffer,
            setGameInfo: setGameInfo,
            setHumanIsWhite: setHumanIsWhite,
            isOpponentPresent: isOpponentPresent,
            ensureConnected: ensureConnected,
            clearDisconnectCountdown: clearDisconnectCountdown,
            /** @internal test helper */
            _handleInbound: handleInbound,
        };
    }

    const OnlineMode = { create: create };

    global.ShmerlingOnlineMode = OnlineMode;

    if (typeof module === "object" && module && module.exports) {
        module.exports = OnlineMode;
    }
})(typeof window !== "undefined" ? window : globalThis);
