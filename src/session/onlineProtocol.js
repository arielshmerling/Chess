/**
 * Online WebSocket message builders / classifiers (Phase 3).
 *
 * Pure helpers — no I/O. Wire shape matches classic chessboard.js / OnlineGame.
 */
(function (global) {
    "use strict";

    /**
     * @param {object} opts
     * @param {string} opts.username
     * @param {boolean} opts.isWhite
     * @param {string|number} opts.gameId
     * @param {string|number} [opts.creatorId]
     * @param {string|number} opts.userId
     * @param {boolean} [opts.watcher]
     */
    function buildConnectMessage(opts) {
        const o = opts || {};
        return {
            type: o.watcher ? "watch" : "connection",
            data: {
                username: o.username,
                isWhite: !!o.isWhite,
                gameId: o.gameId,
                creatorId: o.creatorId,
                userId: o.userId,
            },
        };
    }

    /**
     * @param {object} opts
     * @param {object} opts.move
     * @param {string|number} opts.gameId
     * @param {string} opts.username
     * @param {boolean} opts.isWhite
     */
    function buildMoveMessage(opts) {
        const o = opts || {};
        return {
            type: "move",
            data: o.move,
            gameId: o.gameId,
            username: o.username,
            isWhite: !!o.isWhite,
        };
    }

    /**
     * @param {object} opts
     * @param {string} opts.info
     * @param {string|number} opts.gameId
     * @param {string|number} [opts.userId]
     * @param {string} [opts.username]
     * @param {boolean} [opts.isWhite]
     * @param {number} [opts.moveTime]
     * @param {number} [opts.whiteTimer]
     * @param {number} [opts.blackTimer]
     * @param {string} [opts.loser]
     * @param {*} [opts.data]
     * @param {"white"|"black"} [opts.offererWantsColor]
     */
    function buildInfoMessage(opts) {
        const o = opts || {};
        const msg = {
            type: "info",
            info: o.info,
            gameId: o.gameId,
        };
        if (o.userId != null) {
            msg.userId = o.userId;
        }
        if (o.username != null) {
            msg.username = o.username;
        }
        if (typeof o.isWhite === "boolean") {
            msg.isWhite = o.isWhite;
        }
        if (typeof o.moveTime === "number") {
            msg.moveTime = o.moveTime;
        }
        if (typeof o.whiteTimer === "number") {
            msg.whiteTimer = o.whiteTimer;
        }
        if (typeof o.blackTimer === "number") {
            msg.blackTimer = o.blackTimer;
        }
        if (o.loser != null) {
            msg.loser = o.loser;
        }
        if (o.data !== undefined) {
            msg.data = o.data;
        }
        if (o.offererWantsColor === "white" || o.offererWantsColor === "black") {
            msg.offererWantsColor = o.offererWantsColor;
        }
        return msg;
    }

    /**
     * Classify an inbound server message for OnlineMode (Phase 3–4).
     * @param {object} message
     * @returns {{ kind: string, payload?: * }}
     */
    function classifyInbound(message) {
        if (!message || typeof message !== "object") {
            return { kind: "unknown" };
        }
        if (message.type === "move") {
            return { kind: "move", payload: message };
        }
        if (message.type === "clockSync") {
            return { kind: "clockSync", payload: message };
        }
        if (message.type === "info") {
            const info = message.info;
            switch (info) {
                case "opponent joined":
                    return { kind: "opponentJoined", payload: message };
                case "opponent rejoined":
                    return { kind: "opponentRejoined", payload: message };
                case "Opponent disconnected":
                    return { kind: "opponentDisconnected", payload: message };
                case "Opponent failed to reconnect":
                    return { kind: "opponentFailedReconnect", payload: message };
                case "Opponent resigned":
                    return { kind: "opponentResigned", payload: message };
                case "Game cancelled":
                    return { kind: "gameCancelled", payload: message };
                case "game over":
                    return { kind: "gameOverNotice", payload: message };
                case "move validated successfully":
                    return { kind: "moveValidated", payload: message };
                case "move validation failed":
                    return { kind: "moveValidationFailed", payload: message };
                case "Opponenet left the game":
                    return { kind: "opponentLeft", payload: message };
                case "offer draw":
                    return { kind: "offerDraw", payload: message };
                case "draw accepted":
                    return { kind: "drawAccepted", payload: message };
                case "draw declined":
                    return { kind: "drawDeclined", payload: message };
                case "offer rematch":
                    return { kind: "offerRematch", payload: message };
                case "rematch accepted":
                    return { kind: "rematchAccepted", payload: message };
                case "rematch declined":
                    return { kind: "rematchDeclined", payload: message };
                case "chat":
                    return { kind: "chat", payload: message };
                default:
                    return { kind: "infoOther", payload: message };
            }
        }
        if (message.type === "cmd") {
            return { kind: "cmd", payload: message };
        }
        return { kind: "unknown", payload: message };
    }

    /**
     * Merge clock fields from a move or clockSync payload.
     * @param {object|null} current - { white, black }
     * @param {object} source - move or message with timers
     * @param {boolean} [moverIsWhite] - when only moveTime is set
     * @returns {{ white: number, black: number }|null}
     */
    function mergeClockSnapshot(current, source, moverIsWhite) {
        const cur = current || {};
        let white = typeof cur.white === "number" ? cur.white : null;
        let black = typeof cur.black === "number" ? cur.black : null;
        const src = source || {};
        if (typeof src.whiteTimer === "number") {
            white = src.whiteTimer;
        }
        if (typeof src.blackTimer === "number") {
            black = src.blackTimer;
        }
        if (
            typeof src.moveTime === "number" &&
            typeof moverIsWhite === "boolean"
        ) {
            if (moverIsWhite) {
                white = src.moveTime;
            } else {
                black = src.moveTime;
            }
        }
        if (typeof white !== "number" || typeof black !== "number") {
            return null;
        }
        return { white: white, black: black };
    }

    const OnlineProtocol = {
        buildConnectMessage: buildConnectMessage,
        buildMoveMessage: buildMoveMessage,
        buildInfoMessage: buildInfoMessage,
        classifyInbound: classifyInbound,
        mergeClockSnapshot: mergeClockSnapshot,
    };

    global.ShmerlingOnlineProtocol = OnlineProtocol;

    if (typeof module === "object" && module && module.exports) {
        module.exports = OnlineProtocol;
    }
})(typeof window !== "undefined" ? window : globalThis);
