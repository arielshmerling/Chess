
const { validate } = require("../../serverValidations");
const { ChessGame } = require("../../ChessGame");
const { Player } = require("./Player");
const { v4: uuidv4 } = require("uuid");

class GameBase {
    gameId;
    status;
    createdBy;
    createOn;
    chessGame;
    turn;
    whitePlayer;
    blackPlayer;
    mode;
    reviewType;
    moves;
    messageProcessor;
    lastStatus;
    startedOn;
    lastMoveOn;
    watchers = [];

    // events
    OnMove;
    OnGameOver;
    /** Optional: PracticeGame uses to persist quit mid-game without ending the game in DB */
    OnPracticeQuitMidGame;
    OnGameStateChanged;
    OnRematch;
    OnBookmarkLoaded;


    constructor(gameInfo, player, mode) {

        this.gameId = gameInfo.id || uuidv4();
        this.status = "new";
        this.createdBy = player;
        this.createOn = new Date(); //.toISOString().match(/(\d{2}:){2}\d{2}/)[0];        
        this.chessGame = new ChessGame();
        this.turn = "white";
        this.whitePlayer = mode == "review" ? new Player(null, gameInfo.whitePlayer) : player;
        this.blackPlayer = mode == "review" ? new Player(null, gameInfo.blackPlayer) : player;
        this.mode = mode;
        this.reviewType = gameInfo.reviewType;
        this.moves = gameInfo.moves || [];

    }

    init(ws, userId) {
        const isWhitePlayer = this.whitePlayer.userId == userId;
        if (isWhitePlayer) {
            this.updateChannel(this.whitePlayer, ws);
        }
        else {
            this.updateChannel(this.blackPlayer, ws);
        }
        ws.gameId = this.gameId; // is it necessary?
        ws.on("message", this.onMessageReceived);
        ws.on("close", this.onConnectionClosed);
    }

    joinGame(player) {
        this.blackPlayer = player;
    }

    addWatcher(ws, userName) {
        this.watchers.push({ ws, userName });
        console.log("[addWatcher] gameId=" + this.gameId + " user=" + userName + " totalWatchers=" + this.watchers.length);
        const message = { type: "info", info: "new watcher", gameId: this.gameId, data: userName };
        this.sendMessage(message, true);
        this.sendMessage(message, false);

    }

    stopWatching(player) {
        const index = this.watchers.findIndex(w => w === player);
        if (index !== -1) {
            const watcher = this.watchers[index];
            console.log(`Watcher removed: ${watcher.userName || 'unknown'} from game ${this.gameId}`);
            this.watchers.splice(index, 1);
        }
    }


    /**
     * @param {string} resignedPlayer
     * @param {{ reasonOverride?: string }} [options] If reasonOverride is set, OnGameOver receives it instead of chessGame.GameOverReason (e.g. PracticeGame uses "in progress").
     */
    async resign(resignedPlayer, options = {}) {

        if (this.moves.length === 0) {
            this.status = "cancelled";
        } else {
            this.status = "game over";
        }
        this.chessGame.resign(resignedPlayer);
        const reason =
            options.reasonOverride != null ? options.reasonOverride : this.chessGame.GameOverReason;
        await this.raiseEvent(this.OnGameOver, { game: this, reason });

        const resultMove = this.chessGame.ResultMove;
        if (this.moves.length > 0) { resultMove.moveTime = this.moves[this.moves.length - 1].moveTime; }
        else { resultMove.moveTime = this.chessGame.GameTimeLength; }
        this.moves.push(resultMove);
        await this.raiseEvent(this.OnMove, { game: this, move: resultMove });
    }


    async handleMove(isWhite, moveObj, origin) {

        if (this.chessGame.GameOver) {
            moveObj.valid = false;
            return moveObj;
        }

        if (moveObj.promotion) {
            if (!moveObj.selectedPiece) {
                moveObj.valid = false;
                return moveObj;
            }
        }
        if (!isWhite && origin == "player") {
            moveObj = this.chessGame.flipMove(moveObj);
        }

        if (this.turn == moveObj.piece.color) {
            if (this.chessGame) {
                if (this.chessGame.validateMove(moveObj.source, moveObj.target, this.chessGame.Turn).valid) {
                    const actual = this.chessGame.makeMove(moveObj.source, moveObj.target);
                    if (actual.promoting || actual.promotion) {
                        actual.selectedPiece = (moveObj.selectedPiece);
                        this.chessGame.completePromotion(actual);
                    }
                    actual.moveTime = moveObj.moveTime;
                    this.moves.push(actual);
                    await this.raiseEvent(this.OnMove, { game: this, move: actual });

                    if (this.chessGame.GameOver) {
                        await this.gameOverHandler(moveObj);
                    }
                    else {
                        this.turn = this.chessGame.Turn;
                    }
                    return actual;
                }
                else {
                    console.log("validation failed on:");
                    console.log(moveObj);
                }
            }
        }

        moveObj.valid = false;
        return moveObj;
    }


    async gameOverHandler(moveObj) {
        this.status = "game over";
        await this.raiseEvent(this.OnGameOver, { game: this, reason: this.chessGame.GameOverReason });
        const resultMove = this.chessGame.ResultMove;
        resultMove.moveTime = moveObj.moveTime;
        this.moves.push(resultMove);
        await this.raiseEvent(this.OnMove, { game: this, move: resultMove });
    }

    sendMoveToOpponenet = (isWhitePlayer, moveObj) => {
        const opponenetMove = isWhitePlayer ? this.chessGame.flipMove(moveObj) : moveObj;

        const channel = isWhitePlayer ? this.blackPlayer.channel : this.whitePlayer.channel;
        const message = {
            type: "move",
            data: opponenetMove,
            gameId: this.gameId,
        };

        if (channel) { channel.send(JSON.stringify(message)); }

    };

    sendMoveToWatchers(gameId, isWhite, moveObj) {
        if (!moveObj || moveObj.source == null || moveObj.target == null) return;
        const n = this.watchers.filter(w => w && w.ws && w.ws.readyState === w.ws.OPEN).length;
        console.log("[sendMoveToWatchers] gameId=" + gameId + " watchers=" + n);
        for (const watcher of this.watchers) {
            if (!watcher || !watcher.ws) continue;
            const ws = watcher.ws;
            if (ws.readyState !== ws.OPEN) continue;
            const message = { type: "move", data: moveObj, gameId, isWhite };
            ws.send(JSON.stringify(message));
        }
    }

    getChannel(isWhite) {
        if (isWhite) {
            if (this.whitePlayer) {
                return this.whitePlayer.channel;
            }
        }
        else {
            if (this.blackPlayer) {
                return this.blackPlayer.channel;
            }
        }
        return null;
    }

    sendMessage(message, isWhite) {

        const playerChannel = this.getChannel(isWhite);

        if (playerChannel) {
            if (playerChannel.readyState == playerChannel.OPEN) { playerChannel.send(JSON.stringify(message)); }
        }

    }
    createRemtach(isWhite, callback) {
        const player = isWhite ? this.whitePlayer : this.blackPlayer;
        this.raiseEvent(this.OnRematch, {
            oldGame: this,
            whitePlayer: this.whitePlayer,
            blackPlayer: this.blackPlayer,
            initiator: player,
            cb: callback,
        });
    }


    async draw(offeredBy, callback) {


        this.status = "game over";
        this.chessGame.drawOfferAccepted(offeredBy);

        await this.raiseEvent(this.OnGameOver, {
            game: this,
            reason: this.chessGame.GameOverReason,
        });

        const resultMove = this.chessGame.ResultMove;
        if (this.moves.length > 0) {
            resultMove.moveTime = this.moves[this.moves.length - 1].moveTime;
        }
        this.moves.push(resultMove);
        await this.raiseEvent(this.OnMove, { game: this, move: resultMove });

        callback();
    }

    async outOfTime(loser) {
        this.chessGame.OutOfTime = loser;
        this.status = "game over";
        await this.raiseEvent(this.OnGameOver, {
            game: this,
            reason: `Out Of Time. ${loser} lost`
        });

    }

    onMessageReceived = async (recivedData) => {
        const msg = JSON.parse(recivedData);
        validate(msg, "webSocketsMessage");
        await this.messageProcessor.process(this, msg);
    };

    onConnectionClosed = () => { };

    closeGame = () => {
        if (this.whitePlayer) {
            if (this.whitePlayer.channel) { this.whitePlayer.channel.off("message", this.onMessageReceived); }
        }
        if (this.blackPlayer) {
            if (this.blackPlayer.channel) { this.blackPlayer.channel.off("message", this.onMessageReceived); }
        }
    };

    async raiseEvent(event, param) {
        if (event != null) { await event(param); }
    }


    updateChannel(player, channel) {
        player.channel = channel;
    }

    load(state) {
        this.chessGame.loadGame(JSON.stringify(state));
    }


}

module.exports = { GameBase };