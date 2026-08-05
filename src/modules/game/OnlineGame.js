const { GameBase } = require("./GameBase");
const { OnlineGameMessageProcessor } = require("./OnlineGameMessageProcessor");
const gameClocks = require("./gameClocks");
const { resolvePlayerSeat } = require("./gameSeat");

/** True when no piece has been placed (constructor default before startNewGame). */
function isChessBoardEmpty(board) {
    if (!board || !Array.isArray(board)) {
        return true;
    }
    for (let r = 0; r < board.length; r++) {
        const row = board[r];
        if (!row) {
            continue;
        }
        for (let c = 0; c < row.length; c++) {
            if (row[c] != null) {
                return false;
            }
        }
    }
    return true;
}

class OnlineGame extends GameBase {

    constructor(gameInfo, player, mode) {
        super(gameInfo, player, mode);
        this.blackPlayer = null; // The player creates a game play with white
        this.messageProcessor = new OnlineGameMessageProcessor();
    }

    init(ws, userId) {

        /*
         * Cancelled games must stay dead. Refresh/WS reconnect used to call init and
         * force "in progress" (especially the Black seat path), resurrecting the match.
         */
        if (this.status === "cancelled") {
            const seat = resolvePlayerSeat(this, userId);
            if (seat && ws && typeof ws.send === "function") {
                try {
                    const open =
                        typeof ws.OPEN === "number" ? ws.OPEN : 1;
                    if (ws.readyState === open) {
                        ws.send(
                            JSON.stringify({
                                type: "info",
                                info: "Game cancelled",
                                gameId: this.gameId,
                                data: "opponentLeftBeforeFirstMove",
                            }),
                        );
                    }
                } catch (err) {
                    console.error(
                        "OnlineGame.init cancelled notify:",
                        err && err.message ? err.message : err,
                    );
                }
            }
            try {
                if (ws && typeof ws.close === "function") {
                    ws.close();
                }
            } catch {
                /* ignore */
            }
            return false;
        }

        if (super.init(ws, userId) === false) {
            return false;
        }

        /* Game over: keep the channel for rematch; do not flip status back to live. */
        if (this.status === "game over") {
            return true;
        }

        const uid = userId != null ? String(userId) : "";
        const isWhitePlayer = String(this.whitePlayer.userId) === uid;
        const isCreator = String(this.createdBy.userId) === uid;

        /*
         * startNewGame used to run only when White connected first with no Black. If Black's WebSocket
         * connected first, the server board stayed empty and /gameInfo sent an empty gameState — no pieces on the client.
         * When there are no moves yet and the board is still empty, initialize once (same as White-first).
         */
        if (this.moves.length === 0 && isChessBoardEmpty(this.chessGame.GameState.board)) {
            this.chessGame.startNewGame();
        }

        /*
         * First connection only while waiting for an opponent: creator + no Black yet.
         * If Black already joined (common when Black opens the board before White), the creator
         * must NOT run startNewGame again — that was resetting an in-progress game when White connected second.
         */
        if (isCreator && !this.blackPlayer) {
            this.status = "pending";
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            return true;
        }

        if (!isCreator && this.blackPlayer && String(this.blackPlayer.userId) === uid) {
            this.status = "in progress";
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            const message = { type: "info", info: "opponent joined", gameId: this.gameId, data: this.blackPlayer.userName };
            this.sendMessageToOpponent(message, isWhitePlayer);
            this.sendInfoToWatchers(message);
            if (this.moves.length === 0) {
                this.startServerClocks("white");
            }
            return true;
        }

        if (isCreator && this.blackPlayer) {
            if (this.status === "pending" || this.status === "establishing") {
                this.status = "in progress";
            }
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            if (this.status === "in progress" && this.moves.length === 0
                && this._clockRunningFor == null) {
                this.startServerClocks("white");
            }
            return true;
        }

        this.status = "in progress";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
        const message = { type: "info", info: "opponent joined", gameId: this.gameId, data: this.blackPlayer ? this.blackPlayer.userName : "" };
        this.sendMessageToOpponent(message, isWhitePlayer);
        this.sendInfoToWatchers(message);
        if (this.moves.length === 0 && this._clockRunningFor == null) {
            this.startServerClocks("white");
        }
        return true;
    }

    /**
     * Cancel an online game with no moves yet; notify the other player (if any).
     * @param {string} detail Stable cancel reason code (or legacy English prose) for clients to localize
     * @param {boolean} notifyPlayerIsWhite If true, send to White's channel; if false, to Black's.
     * @returns {Promise<void>}
     */
    async applyCancelledNoMoves(detail, notifyPlayerIsWhite) {
        if (this.status === "game over" || this.status === "cancelled") {
            return;
        }
        if (this.moves && this.moves.length !== 0) {
            return;
        }
        this.clearRejoinWaitIfAny();
        const cancelMsg = {
            type: "info",
            info: "Game cancelled",
            gameId: this.gameId,
            data: detail,
        };
        this.sendMessage(cancelMsg, notifyPlayerIsWhite);
        this.sendInfoToWatchers(cancelMsg);
        this.lastStatus = this.status;
        this.status = "cancelled";
        await this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
        this.closeGame();
    }

    onConnectionClosed = () => {

        if (this.status === "cancelled") { return; }

        /* Chess already finished (e.g. timeout) but status lagged — never put on hold. */
        if (this.chessGame && this.chessGame.GameOver && this.status !== "game over") {
            this.status = "game over";
        }

        const moveCount = this.moves ? this.moves.length : 0;
        const wpCh = this.whitePlayer && this.whitePlayer.channel;
        const bpCh = this.blackPlayer && this.blackPlayer.channel;
        const whiteOpen = wpCh != null && wpCh.readyState === wpCh.OPEN;
        const blackOpen = bpCh != null && bpCh.readyState === bpCh.OPEN;

        /*
         * Infer which seat dropped. If both seats still look open (e.g. a stale socket
         * closed after a reconnect), ignore — do not put the game on hold.
         */
        let disconnectedWasWhite;
        if (!whiteOpen && blackOpen) {
            disconnectedWasWhite = true;
        } else if (whiteOpen && !blackOpen) {
            disconnectedWasWhite = false;
        } else {
            return;
        }

        /*
         * After the game ends, leaving for Home must still notify the peer so rematch
         * cannot hang forever. Do not start reconnect/forfeit timers.
         */
        if (this.status === "game over") {
            this.clearPendingRematchAfterPeerLeft(!disconnectedWasWhite);
            const leftMsg = {
                type: "info",
                info: "Opponent disconnected",
                gameId: this.gameId,
                disconnectedWasWhite,
            };
            this.sendMessage(leftMsg, !disconnectedWasWhite);
            return;
        }

        /**
         * No moves yet: short on-hold window so a tab refresh can reconnect without cancelling.
         * Intentional leave uses POST /cancel-before-move (immediate cancel for the opponent).
         */
        if (moveCount === 0) {
            const message = {
                type: "info",
                info: "Opponent disconnected",
                gameId: this.gameId,
                disconnectedWasWhite,
            };
            this.sendMessage(message, !disconnectedWasWhite);
            this.sendInfoToWatchers(message);
            this.lastStatus = this.status;
            this.status = "on hold";
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            const PRE_MOVE_REFRESH_GRACE_MS = 12000;
            this.waitForRejoin(disconnectedWasWhite, PRE_MOVE_REFRESH_GRACE_MS);
            return;
        }

        const message = {
            type: "info",
            info: "Opponent disconnected",
            gameId: this.gameId,
            disconnectedWasWhite,
        };
        this.sendMessage(message, !disconnectedWasWhite);
        this.sendInfoToWatchers(message);
        this.lastStatus = this.status;
        this.status = "on hold";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
        this.waitForRejoin(disconnectedWasWhite);
    };

    /**
     * Drop a pending rematch and tell the remaining player it is no longer available.
     * @param {boolean} remainingIsWhite
     */
    clearPendingRematchAfterPeerLeft(remainingIsWhite) {
        const hadPending = !!this.pendingRematchOffer;
        this.pendingRematchOffer = null;
        if (!hadPending) {
            return;
        }
        this.sendMessage(
            {
                type: "info",
                info: "rematch unavailable",
                gameId: this.gameId,
            },
            remainingIsWhite === true,
        );
    }


    sendMoveToOpponent(gameId, isWhite, moveObj) {

        const opponenetMove = isWhite ? this.chessGame.flipMove(moveObj) : moveObj;

        const opponentWs = isWhite ? this.blackPlayer.channel : this.whitePlayer.channel;
        const message = {
            type: "move",
            data: opponenetMove,
            gameId: gameId,
        };

        if (!GameBase.isChannelOpen(opponentWs)) {
            return false;
        }
        try {
            opponentWs.send(JSON.stringify(message));
            return true;
        } catch (err) {
            console.error(
                "sendMoveToOpponent failed:",
                err && err.message ? err.message : err,
            );
            return false;
        }
    }

    sendMoveToWatchers(gameId, isWhite, moveObj) {
        for (const watcher of this.watchers) {
            if (!watcher || !watcher.ws) {continue;}

            const wactherWs = watcher.ws;
            const message = {
                type: "move",
                data: moveObj,
                gameId: gameId,
                isWhite
            };

            if (wactherWs && wactherWs.readyState == wactherWs.OPEN) {
                wactherWs.send(JSON.stringify(message));
            }
        }
    }


    sendMessageToOpponent(message, isWhite) {

        let opponentWs;
        if (isWhite) {
            if (this.blackPlayer) {
                opponentWs = this.blackPlayer.channel;
            }
        }
        else {
            if (this.whitePlayer) {
                opponentWs = this.whitePlayer.channel;
            }
        }

        if (!GameBase.isChannelOpen(opponentWs)) {
            return false;
        }
        try {
            opponentWs.send(JSON.stringify(message));
            return true;
        } catch (err) {
            console.error(
                "sendMessageToOpponent failed:",
                err && err.message ? err.message : err,
            );
            return false;
        }
    }

    /**
     * Clears the pending reconnect deadline timer (set in waitForRejoin).
     * Must run when the disconnected player reconnects so an old timer cannot fire mid-game.
     */
    clearRejoinWaitIfAny() {
        if (this._rejoinWaitHandle != null) {
            clearTimeout(this._rejoinWaitHandle);
            this._rejoinWaitHandle = null;
        }
    }

    /**
     * @param {boolean} isWhite - whether we are waiting for the white player to reconnect
     * @param {number} [deadlineMs] - default ~61s; shorter for pre-move refresh grace
     */
    waitForRejoin(isWhite, deadlineMs) {
        this.clearRejoinWaitIfAny();
        /**
         * Align with client: 1s grace after "Opponent disconnected", then 60 × 1s countdown
         * (timer shows 60 for one second, then 59…1) → ~61s from disconnect to counter at 0.
         */
        const RECONNECT_DEADLINE_MS = deadlineMs != null ? deadlineMs : 61000;
        this._rejoinWaitHandle = setTimeout(async () => {
            this._rejoinWaitHandle = null;
            try {
                if (
                    this.status === "in progress" ||
                    this.status === "game over" ||
                    this.status === "pending"
                ) {
                    return;
                }
                if (this.status !== "on hold") {
                    return;
                }
                const moveCount = this.moves ? this.moves.length : 0;
                /** No moves on the board yet — cancel after reconnect deadline; any move played → forfeit below. */
                if (moveCount === 0) {
                    void this.applyCancelledNoMoves("reconnectTimedOutNoMoves", !isWhite);
                    return;
                }
                await this.resign(isWhite ? "white" : "black");
                const message = {
                    type: "info",
                    info: "Opponent failed to reconnect",
                    gameId: this.gameId,
                    disconnectedWasWhite: isWhite,
                };
                this.sendMessage(message, !isWhite);
                this.sendInfoToWatchers(message);
                this.closeGame();
            } catch (err) {
                console.error("waitForRejoin timeout handler:", err);
            }
        }, RECONNECT_DEADLINE_MS);
    }

    updateChannel = (player, channel) => {
        if (!player) {
            return;
        }
        const prev = player.channel;
        /*
         * After clearChannelIfMatches, prev is null on rejoin — still must restore
         * from "on hold" and notify the peer (otherwise disconnect countdown sticks).
         */
        const shouldAnnounceRejoin =
            this.status === "on hold" ||
            (prev != null && !GameBase.isChannelOpen(prev));
        if (shouldAnnounceRejoin) {
            this.clearRejoinWaitIfAny();
            if (this.status === "on hold") {
                this.status = this.lastStatus || "in progress";
                this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
                if (this.status === "in progress" && !(this.chessGame && this.chessGame.GameOver)) {
                    gameClocks.ensureServerClocksActive(this);
                }
            }
            const isWhite =
                this.whitePlayer &&
                String(this.whitePlayer.userId) === String(player.userId);
            const message = {
                type: "info",
                info: "opponent rejoined",
                gameId: this.gameId,
                rejoinedWasWhite: Boolean(isWhite),
            };
            this.sendMessageToOpponent(message, isWhite);
            this.sendInfoToWatchers(message);
        }
        super.updateChannel(player, channel);
    };


}


module.exports = { OnlineGame };