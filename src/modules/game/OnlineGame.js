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
        if (this.moves.length === 0) {
            this.status = "cancelled";
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            const isWhite = this.whitePlayer.channel.readyState === this.whitePlayer.channel.OPEN;
            const message = { type: "info", info: "Game cancelled", gameId: this.gameId, data: "Opponent left before first move" };
            this.sendMessage(message, isWhite);
            this.sendInfoToWatchers(message);
            return;
        }
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

    // isWhite - whether the player we are waiting for is the white player
    waitForRejoin(isWhite) {
        const handle = setInterval(async () => {


            if (this.status == "in progress" ||
                this.status == "game over" ||
                this.status == "pending"

            ) {
                clearInterval(handle);
            }
            if (this.status == "on hold") {
                clearInterval(handle);
                this.status = "game over";
                this.chessGame.resign(isWhite ? "white" : "black");
                this.raiseEvent(this.OnGameOver, { game: this, reason: this.chessGame.GameOverReason });
                const message = { type: "info", info: "Opponent failed to reconnect", gameId: this.gameId };
                this.sendMessage(message, !isWhite);
                this.sendInfoToWatchers(message);
                this.closeGame();

            }
        }, 60000);
    }

    updateChannel = (player, channel) => {
        if (player) {
            if (player.channel) {
                if (player.channel.readyState != player.channel.OPEN) {
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