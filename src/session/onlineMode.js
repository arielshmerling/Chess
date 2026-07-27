/**
 * OnlineMode — multiplayer vs human over MatchTransport (Phase 3).
 *
 * Core play: connect, moves both ways, server clocks, resign,
 * cancel-before-move, game over, basic disconnect messaging.
 * Draw / rematch / chat / watch deferred to Phase 4.
 */
(function (global) {
    "use strict";

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
        return { MODE_IDS: { ONLINE: "online" } };
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
     * @param {() => void} [options.onOpponentDisconnected]
     * @param {() => void} [options.onOpponentRejoined]
     * @param {(payload: object) => void} [options.onGameCancelled]
     */
    function create(options) {
        const opts = options || {};
        const protocol = loadProtocol();
        const capsApi = loadCapabilities();
        const contracts = loadContracts();
        const modeId = (contracts.MODE_IDS && contracts.MODE_IDS.ONLINE) || "online";
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
        let gameInfo = Object.assign({}, opts.gameInfo);
        let opponentPresent =
            !!(gameInfo.blackPlayerName && String(gameInfo.blackPlayerName).trim()) ||
            !humanIsWhite ||
            watcher;

        function capabilities() {
            if (capsApi && typeof capsApi.getModeCapabilities === "function") {
                return capsApi.getModeCapabilities(modeId);
            }
            return {
                undo: false,
                redo: false,
                resign: true,
                draw: false,
                rematch: false,
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
                    opponentPresent = true;
                    if (typeof opts.onOpponentRejoined === "function") {
                        opts.onOpponentRejoined();
                    }
                    if (session) {
                        session.emit("opponentRejoined", classified.payload || {});
                    }
                    status("Opponent rejoined", "info");
                    return;
                case "opponentDisconnected":
                    if (typeof opts.onOpponentDisconnected === "function") {
                        opts.onOpponentDisconnected();
                    }
                    if (session) {
                        session.emit(
                            "opponentDisconnected",
                            classified.payload || {},
                        );
                    }
                    status("Opponent disconnected", "info");
                    return;
                case "opponentFailedReconnect":
                    return onOpponentFailedReconnect(classified.payload);
                case "opponentResigned":
                    return onOpponentResigned(classified.payload);
                case "opponentLeft":
                    return onOpponentLeft();
                case "gameCancelled":
                    return onGameCancelled(classified.payload);
                case "gameOverNotice":
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
            const loser =
                message && message.disconnectedWasWhite === true
                    ? "White"
                    : message && message.disconnectedWasWhite === false
                      ? "Black"
                      : humanIsWhite
                        ? "Black"
                        : "White";
            applyingRemote = true;
            try {
                session.resign(loser);
            } finally {
                applyingRemote = false;
            }
            status("Opponent failed to reconnect", "info");
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
            setGameInfo: setGameInfo,
            setHumanIsWhite: setHumanIsWhite,
            isOpponentPresent: isOpponentPresent,
            ensureConnected: ensureConnected,
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
