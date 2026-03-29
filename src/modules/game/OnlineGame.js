const { GameBase } = require("./GameBase");
const { OnlineGameMessageProcessor } = require("./OnlineGameMessageProcessor");

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

        super.init(ws, userId);

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
            return;
        }

        if (!isCreator && this.blackPlayer && String(this.blackPlayer.userId) === uid) {
            this.status = "in progress";
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            const message = { type: "info", info: "opponent joined", gameId: this.gameId, data: this.blackPlayer.userName };
            this.sendMessageToOpponent(message, isWhitePlayer);
            this.sendInfoToWatchers(message);
            return;
        }

        if (isCreator && this.blackPlayer) {
            if (this.status === "pending" || this.status === "establishing") {
                this.status = "in progress";
            }
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            return;
        }

        this.status = "in progress";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
        const message = { type: "info", info: "opponent joined", gameId: this.gameId, data: this.blackPlayer ? this.blackPlayer.userName : "" };
        this.sendMessageToOpponent(message, isWhitePlayer);
        this.sendInfoToWatchers(message);
    }


    onConnectionClosed = () => {

        if (this.status === "game over") { return; }
        /**
         * Same flow whether or not any move was played: notify opponent, go on hold, 61s reconnect window.
         * If no moves yet, waitForRejoin still cancels after the deadline; if at least one move was played, forfeit.
         */
        const isWhite = this.whitePlayer.channel.readyState == this.whitePlayer.channel.OPEN;
        const message = { type: "info", info: "Opponent disconnected", gameId: this.gameId };
        this.sendMessage(message, isWhite);
        this.sendInfoToWatchers(message);
        this.lastStatus = this.status;
        this.status = "on hold";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
        this.waitForRejoin(!isWhite);
    };


    sendMoveToOpponent(gameId, isWhite, moveObj) {

        const opponenetMove = isWhite ? this.chessGame.flipMove(moveObj) : moveObj;

        const opponentWs = isWhite ? this.blackPlayer.channel : this.whitePlayer.channel;
        const message = {
            type: "move",
            data: opponenetMove,
            gameId: gameId,
        };

        if (opponentWs) { opponentWs.send(JSON.stringify(message)); }
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

        if (opponentWs) { opponentWs.send(JSON.stringify(message)); }

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

    // isWhite - whether the player we are waiting for is the white player
    waitForRejoin(isWhite) {
        this.clearRejoinWaitIfAny();
        /**
         * Align with client: 1s grace after "Opponent disconnected", then 60 × 1s countdown
         * (timer shows 60 for one second, then 59…1) → ~61s from disconnect to counter at 0.
         */
        const RECONNECT_DEADLINE_MS = 61000;
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
                    this.status = "cancelled";
                    await this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
                    const cancelMsg = {
                        type: "info",
                        info: "Game cancelled",
                        gameId: this.gameId,
                        data: "Reconnect timed out with no moves played.",
                    };
                    this.sendMessage(cancelMsg, !isWhite);
                    this.sendInfoToWatchers(cancelMsg);
                    this.closeGame();
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
        if (player) {
            if (player.channel) {
                if (player.channel.readyState != player.channel.OPEN) {
                    this.clearRejoinWaitIfAny();
                    this.status = this.lastStatus;
                    this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
                    const message = { type: "info", info: "opponent rejoined", gameId: this.gameId };
                    const isWhite = (this.whitePlayer.userId == player.userId);
                    this.sendMessageToOpponent(message, isWhite);
                    this.sendInfoToWatchers(message);
                }
            }
            super.updateChannel(player, channel);

        }
    };


}


module.exports = { OnlineGame };