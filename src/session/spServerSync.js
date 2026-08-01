/**
 * Prefer-Play SP server sync — LocalEngine plays locally; moves are mirrored to
 * a clientEngine SinglePlayerGame over /ws for Active Games listing + watch.
 */
(function (global) {
    "use strict";

    function loadWsTransport() {
        if (typeof module === "object" && module && module.exports) {
            try {
                return require("./wsTransport");
            } catch {
                /* fall through */
            }
        }
        return global.ShmerlingWsTransport;
    }

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

    /**
     * Server chess is always white-view. Human/promotion plies must stay in
     * player-view (server flips black player moves). Engine plies use origin
     * "brain" (no server flip) so black-view boards must flip to white-view.
     * @param {object} move
     * @param {{ source?: string, whitePlayerView?: boolean, flipMove?: function }} [ctx]
     */
    function toServerMovePayload(move, ctx) {
        if (!move) {
            return move;
        }
        const c = ctx || {};
        const src = c.source || "";
        const out = Object.assign({}, move, { valid: move.valid !== false });
        if (
            src === "engine" &&
            c.whitePlayerView === false &&
            typeof c.flipMove === "function"
        ) {
            return c.flipMove(out);
        }
        return out;
    }

    /**
     * @param {object} options
     * @param {object} options.gameInfo - id, username, userId, creatorId
     * @param {boolean} [options.humanIsWhite=true]
     * @param {string} [options.wsUrl]
     * @returns {{ connect: function(): Promise<void>, sendHumanMove: function, sendEngineMove: function, sendClockSync: function, sendResign: function, sendOutOfTime: function, detach: function, isReady: function(): boolean }}
     */
    function create(options) {
        const opts = options || {};
        const WsTransport = loadWsTransport();
        const protocol = loadProtocol();
        if (!WsTransport || typeof WsTransport.create !== "function") {
            throw new Error("SpServerSync requires ShmerlingWsTransport");
        }
        if (!opts.gameInfo || opts.gameInfo.id == null) {
            throw new Error("SpServerSync requires gameInfo.id");
        }

        const transport = WsTransport.create({});
        const humanIsWhite = opts.humanIsWhite !== false;
        const gameInfo = Object.assign({}, opts.gameInfo);
        let ready = false;
        let connectPromise = null;

        function identity() {
            return {
                username: gameInfo.username,
                isWhite: humanIsWhite,
                gameId: gameInfo.id,
                creatorId: gameInfo.creatorId,
                userId: gameInfo.userId,
                watcher: false,
            };
        }

        function connect() {
            if (connectPromise) {
                return connectPromise;
            }
            connectPromise = new Promise(function (resolve, reject) {
                const url =
                    opts.wsUrl ||
                    (typeof WsTransport.defaultWsUrl === "function"
                        ? WsTransport.defaultWsUrl()
                        : null);
                if (!url) {
                    reject(new Error("SpServerSync: missing wsUrl"));
                    return;
                }
                let settled = false;
                let fallbackTimer = null;
                function finishOk() {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    if (fallbackTimer != null) {
                        clearTimeout(fallbackTimer);
                        fallbackTimer = null;
                    }
                    ready = true;
                    resolve();
                }
                function finishErr(err) {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    if (fallbackTimer != null) {
                        clearTimeout(fallbackTimer);
                        fallbackTimer = null;
                    }
                    reject(err || new Error("SpServerSync WebSocket error"));
                }
                transport.onMessage(function (msg) {
                    if (msg && msg.type === "info" && msg.info === "connected") {
                        finishOk();
                    }
                });
                transport.onOpen(function () {
                    transport.send(protocol.buildConnectMessage(identity()));
                    /* If an older server has no ack, do not block Prefer-Play forever. */
                    fallbackTimer = setTimeout(finishOk, 1500);
                });
                transport.onError(function (err) {
                    if (!ready) {
                        finishErr(err);
                    }
                });
                transport.onClose(function () {
                    ready = false;
                    connectPromise = null;
                    if (!settled) {
                        finishErr(new Error("SpServerSync WebSocket closed before connected"));
                    }
                });
                try {
                    transport.connect(url);
                } catch (err) {
                    finishErr(err);
                }
            });
            return connectPromise;
        }

        function clocksExtra(clocks) {
            const c = clocks || {};
            const extra = {};
            if (typeof c.whiteTimer === "number") {
                extra.whiteTimer = c.whiteTimer;
            }
            if (typeof c.blackTimer === "number") {
                extra.blackTimer = c.blackTimer;
            }
            if (typeof c.moveTime === "number") {
                extra.moveTime = c.moveTime;
            }
            return extra;
        }

        function sendHumanMove(move, clocks) {
            if (!ready || !move) {
                return;
            }
            const payload = Object.assign({}, move, clocksExtra(clocks));
            transport.send(
                protocol.buildMoveMessage({
                    move: payload,
                    gameId: gameInfo.id,
                    username: gameInfo.username,
                    isWhite: humanIsWhite,
                }),
            );
        }

        function sendEngineMove(move, clocks) {
            if (!ready || !move) {
                return;
            }
            const payload = Object.assign({}, move, clocksExtra(clocks));
            const aiIsWhite = !humanIsWhite;
            transport.send({
                type: "cmd",
                info: "clientEngineMove",
                data: payload,
                gameId: gameInfo.id,
                userId: gameInfo.userId,
                username: gameInfo.username,
                isWhite: aiIsWhite,
                moveTime: payload.moveTime,
                whiteTimer: payload.whiteTimer,
                blackTimer: payload.blackTimer,
            });
        }

        function sendClockSync(clocks) {
            if (!ready) {
                return;
            }
            const c = clocks || {};
            transport.send(
                protocol.buildInfoMessage({
                    info: "clockSync",
                    gameId: gameInfo.id,
                    userId: gameInfo.userId,
                    username: gameInfo.username,
                    isWhite: humanIsWhite,
                    whiteTimer: c.whiteTimer,
                    blackTimer: c.blackTimer,
                }),
            );
        }

        function sendResign(clocks) {
            if (!ready) {
                return;
            }
            transport.send(
                protocol.buildInfoMessage(
                    Object.assign(
                        {
                            info: "resign",
                            gameId: gameInfo.id,
                            userId: gameInfo.userId,
                            username: gameInfo.username,
                            isWhite: humanIsWhite,
                        },
                        clocksExtra(clocks),
                    ),
                ),
            );
        }

        function sendOutOfTime(loser, clocks) {
            if (!ready) {
                return;
            }
            transport.send(
                protocol.buildInfoMessage(
                    Object.assign(
                        {
                            info: "outOfTime",
                            gameId: gameInfo.id,
                            userId: gameInfo.userId,
                            username: gameInfo.username,
                            isWhite: humanIsWhite,
                            loser: loser,
                        },
                        clocksExtra(clocks),
                    ),
                ),
            );
        }

        function detach() {
            ready = false;
            connectPromise = null;
            try {
                transport.close();
            } catch {
                /* ignore */
            }
        }

        function isReady() {
            return ready;
        }

        return {
            connect: connect,
            sendHumanMove: sendHumanMove,
            sendEngineMove: sendEngineMove,
            sendClockSync: sendClockSync,
            sendResign: sendResign,
            sendOutOfTime: sendOutOfTime,
            detach: detach,
            isReady: isReady,
        };
    }

    const api = { create: create, toServerMovePayload: toServerMovePayload };
    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }
    global.ShmerlingSpServerSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
