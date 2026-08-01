
const { validateWebSocketMessage } = require("../../serverValidations");
const { ChessGame } = require("../../ChessGame");
const { Player } = require("./Player");
const { v4: uuidv4 } = require("uuid");
const {
    resolvePlayerSeat,
    seatForChannel,
    applySocketMessageIdentity,
} = require("./gameSeat");
const gameClocks = require("./gameClocks");

/** Copy clock snapshot from an inbound move onto a stored move object (seconds). */
function copyClocksFromTo(source, target) {
    if (!source || !target) {
        return;
    }
    if (typeof source.whiteTimer === "number" && Number.isFinite(source.whiteTimer)) {
        target.whiteTimer = Math.round(source.whiteTimer);
    }
    if (typeof source.blackTimer === "number" && Number.isFinite(source.blackTimer)) {
        target.blackTimer = Math.round(source.blackTimer);
    }
}

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
        /** If set, only this user may join as Black (friend invite); open queue when null. */
        this.invitedUserId = gameInfo.invitedUserId != null ? String(gameInfo.invitedUserId) : null;
        this.isPrivate = gameInfo.isPrivate === true;

    }

    init(ws, userId) {
        const seat = resolvePlayerSeat(this, userId);
        if (!seat) {
            try {
                if (ws && typeof ws.close === "function") {
                    ws.close();
                }
            } catch (err) {
                console.error("reject unauthorized game seat:", err && err.message ? err.message : err);
            }
            return false;
        }
        if (seat === "white") {
            this.updateChannel(this.whitePlayer, ws);
        } else {
            if (!this.blackPlayer) {
                try {
                    if (ws && typeof ws.close === "function") {
                        ws.close();
                    }
                } catch (err) {
                    console.error("reject connect with no black seat:", err && err.message ? err.message : err);
                }
                return false;
            }
            this.updateChannel(this.blackPlayer, ws);
        }
        ws.gameId = this.gameId;
        const onMsg = (data) => {
            void this.onMessageReceived(data, ws);
        };
        ws._gameMessageHandler = onMsg;
        ws.on("message", onMsg);
        ws.on("close", this.onConnectionClosed);
        /* Prefer-Play SP sync waits for this before mirroring moves (avoids race where
           client sends plies before this listener is attached). */
        try {
            if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: "info", info: "connected", gameId: this.gameId }));
            }
        } catch (err) {
            console.error("connected ack failed:", err && err.message ? err.message : err);
        }
        return true;
    }

    joinGame(player) {
        this.blackPlayer = player;
    }

    addWatcher(ws, userName) {
        this.watchers.push({ ws, userName });
        const message = { type: "info", info: "new watcher", gameId: this.gameId, data: userName };
        this.sendMessage(message, true);
        this.sendMessage(message, false);

    }

    stopWatching(player) {
        const index = this.watchers.findIndex(w => w === player);
        if (index !== -1) {
            this.watchers.splice(index, 1);
        }
    }


    /**
     * @param {string} resignedPlayer
     * @param {{ reasonOverride?: string, resignClockSnapshot?: { moveTime?: number, whiteTimer: number, blackTimer: number } }} [options] If reasonOverride is set, OnGameOver receives it instead of chessGame.GameOverReason (e.g. PracticeGame uses "in progress"). resignClockSnapshot stores clocks from the client at resign time.
     */
    async resign(resignedPlayer, options = {}) {

        gameClocks.clearFlagTimer(this);
        gameClocks.pauseClocks(this);

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
        const snap = options.resignClockSnapshot;
        if (snap && typeof snap.whiteTimer === "number" && typeof snap.blackTimer === "number") {
            if (typeof snap.moveTime === "number" && Number.isFinite(snap.moveTime)) {
                resultMove.moveTime = Math.round(snap.moveTime);
            }
            copyClocksFromTo(snap, resultMove);
        }
        else if (this.moves.length > 0) {
            const lm = this.moves[this.moves.length - 1];
            resultMove.moveTime = lm.moveTime;
            copyClocksFromTo(lm, resultMove);
        }
        else { resultMove.moveTime = this.chessGame.GameTimeLength; }
        this.moves.push(resultMove);
        await this.raiseEvent(this.OnMove, { game: this, move: resultMove });
    }


    async handleMove(isWhite, moveObj, origin) {

        if (this.chessGame.GameOver) {
            moveObj.valid = false;
            return moveObj;
        }

        if (!isWhite && origin == "player") {
            moveObj = this.chessGame.flipMove(moveObj);
        }

        const hasSelectedPiece = moveObj.selectedPiece != null && moveObj.selectedPiece !== undefined;

        // Client sends move 1: pawn to promotion square (promotion true, no selectedPiece).
        // Move 2 (after UI): same squares + selectedPiece. Server chess is already in promoting state.
        if (this.chessGame.GameState.promoting && hasSelectedPiece && moveObj.promotion) {
            const pending = this.chessGame.LastMove;
            if (pending && pending.promotion
                && pending.source.row === moveObj.source.row && pending.source.col === moveObj.source.col
                && pending.target.row === moveObj.target.row && pending.target.col === moveObj.target.col) {
                pending.selectedPiece = moveObj.selectedPiece;
                this.chessGame.completePromotion(pending);
                pending.moveTime = moveObj.moveTime;
                copyClocksFromTo(moveObj, pending);
                await this.raiseEvent(this.OnMove, { game: this, move: pending });
                if (this.chessGame.GameOver) {
                    await this.gameOverHandler(moveObj);
                }
                else {
                    this.turn = this.chessGame.Turn;
                }
                pending.valid = true;
                gameClocks.afterValidatedMove(this, !!isWhite, pending);
                return pending;
            }
            moveObj.valid = false;
            return moveObj;
        }

        const sideToMove = this.chessGame ? this.chessGame.Turn : this.turn;
        if (!moveObj.piece && moveObj.source && this.chessGame) {
            const board = this.chessGame.GameState && this.chessGame.GameState.board;
            const src = board && board[moveObj.source.row] && board[moveObj.source.row][moveObj.source.col];
            if (src) {
                moveObj.piece = src;
            }
        }
        if (moveObj.piece && sideToMove == moveObj.piece.color) {
            this.turn = sideToMove;
            if (this.chessGame) {
                if (this.chessGame.validateMove(moveObj.source, moveObj.target, this.chessGame.Turn).valid) {
                    const actual = this.chessGame.makeMove(moveObj.source, moveObj.target);
                    if (actual.promotion && hasSelectedPiece) {
                        actual.selectedPiece = moveObj.selectedPiece;
                        this.chessGame.completePromotion(actual);
                    }
                    actual.moveTime = moveObj.moveTime;
                    copyClocksFromTo(moveObj, actual);
                    this.moves.push(actual);
                    await this.raiseEvent(this.OnMove, { game: this, move: actual });

                    if (this.chessGame.GameOver) {
                        await this.gameOverHandler(moveObj);
                    }
                    else {
                        this.turn = this.chessGame.Turn;
                    }
                    gameClocks.afterValidatedMove(this, !!isWhite, actual);
                    return actual;
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
        copyClocksFromTo(moveObj, resultMove);
        this.moves.push(resultMove);
        await this.raiseEvent(this.OnMove, { game: this, move: resultMove });
    }

    opponentMovePayload(isWhitePlayer, moveObj) {
        return isWhitePlayer ? this.chessGame.flipMove(moveObj) : moveObj;
    }

    sendMoveToOpponenet = (isWhitePlayer, moveObj) => {
        const opponenetMove = this.opponentMovePayload(isWhitePlayer, moveObj);

        const channel = isWhitePlayer ? this.blackPlayer.channel : this.whitePlayer.channel;
        const message = {
            type: "move",
            data: opponenetMove,
            gameId: this.gameId,
            isWhite: isWhitePlayer,
        };

        if (channel) { channel.send(JSON.stringify(message)); }

    };

    sendMoveToWatchers(gameId, isWhite, moveObj) {
        if (!moveObj || moveObj.source == null || moveObj.target == null) {return;}
        for (const watcher of this.watchers) {
            if (!watcher || !watcher.ws) {continue;}
            const ws = watcher.ws;
            if (ws.readyState !== ws.OPEN) {continue;}
            const message = { type: "move", data: moveObj, gameId, isWhite };
            ws.send(JSON.stringify(message));
        }
    }

    sendClockSyncToWatchers(whiteTimer, blackTimer) {
        if (typeof whiteTimer !== "number" || typeof blackTimer !== "number") {return;}
        const message = { type: "clockSync", gameId: this.gameId, whiteTimer, blackTimer };
        for (const watcher of this.watchers) {
            if (!watcher || !watcher.ws) {continue;}
            const ws = watcher.ws;
            if (ws.readyState === ws.OPEN) {ws.send(JSON.stringify(message));}
        }
    }

    sendInfoToWatchers(message) {
        if (!message || message.type !== "info") {return;}
        for (const watcher of this.watchers) {
            if (!watcher || !watcher.ws) {continue;}
            const ws = watcher.ws;
            if (ws.readyState === ws.OPEN) {ws.send(JSON.stringify(message));}
        }
    }

    /**
     * After an online rematch, spectators stay on the old game id; tell them the new game id and to re-open from Home.
     * @param {string} newGameId
     * @param {string} bodyText
     */
    sendSpectatorRematchNewGameNotice(newGameId, bodyText) {
        const data = bodyText && String(bodyText).trim() ? String(bodyText).trim() : "";
        const message = {
            type: "info",
            info: "spectator rematch new game",
            gameId: newGameId,
            data,
        };
        for (const watcher of this.watchers) {
            if (!watcher || !watcher.ws) {continue;}
            const ws = watcher.ws;
            if (ws.readyState === ws.OPEN) {
                try {
                    ws.send(JSON.stringify(message));
                } catch (err) {
                    console.error("sendSpectatorRematchNewGameNotice:", err && err.message ? err.message : err);
                }
            }
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
    createRemtach(isWhite, callback, options) {
        const opts = options || {};
        const player = isWhite ? this.whitePlayer : this.blackPlayer;
        this.raiseEvent(this.OnRematch, {
            oldGame: this,
            whitePlayer: this.whitePlayer,
            blackPlayer: this.blackPlayer,
            initiator: player,
            cb: callback,
            acceptorIsWhite: isWhite === true,
            offererWantsColor: opts.offererWantsColor,
        });
    }


    async draw(offeredBy, callback) {


        gameClocks.clearFlagTimer(this);
        gameClocks.pauseClocks(this);

        this.status = "game over";
        this.chessGame.drawOfferAccepted(offeredBy);

        await this.raiseEvent(this.OnGameOver, {
            game: this,
            reason: this.chessGame.GameOverReason,
        });

        const resultMove = this.chessGame.ResultMove;
        if (this.moves.length > 0) {
            const lm = this.moves[this.moves.length - 1];
            resultMove.moveTime = lm.moveTime;
            copyClocksFromTo(lm, resultMove);
        }
        this.moves.push(resultMove);
        await this.raiseEvent(this.OnMove, { game: this, move: resultMove });

        callback();
    }

    async outOfTime(loser) {
        gameClocks.clearFlagTimer(this);
        gameClocks.pauseClocks(this);
        this.chessGame.OutOfTime = loser;
        this.status = "game over";
        await this.raiseEvent(this.OnGameOver, {
            game: this,
            reason: `Out Of Time. ${loser} lost`
        });

        const resultMove = this.chessGame.ResultMove;
        if (resultMove) {
            if (this.moves.length > 0) {
                const lm = this.moves[this.moves.length - 1];
                resultMove.moveTime = lm.moveTime;
                copyClocksFromTo(lm, resultMove);
            }
            else {
                resultMove.moveTime = this.chessGame.GameTimeLength;
            }
            if (typeof this.clockWhiteSec === "number") {
                resultMove.whiteTimer = Math.round(this.clockWhiteSec);
            }
            if (typeof this.clockBlackSec === "number") {
                resultMove.blackTimer = Math.round(this.clockBlackSec);
            }
            this.moves.push(resultMove);
            await this.raiseEvent(this.OnMove, { game: this, move: resultMove });
        }
    }

    /** Start White's clock when both players are ready (online) or SP game begins. */
    startServerClocks(side = "white") {
        gameClocks.ensureClocks(this);
        gameClocks.startTurnClock(this, side === "black" ? "black" : "white");
    }

    onMessageReceived = async (recivedData, ws) => {
        let msg;
        try {
            msg = JSON.parse(recivedData);
        } catch (e) {
            console.error("WebSocket JSON parse failed:", e.message);
            return;
        }
        /* Routed only on /ws app handler; ignore if same socket still receives these. */
        if (msg.type === "connection" || msg.type === "watch" || msg.type === "subscribeLobby" || msg.type === "presenceSubscribe") {
            return;
        }

        const seat = seatForChannel(this, ws);
        if (!seat) {
            return;
        }

        const validation = validateWebSocketMessage(msg);
        if (!validation.ok) {
            console.error("WebSocket message validation failed:", validation.error);
            return;
        }
        const value = validation.value;
        if (!applySocketMessageIdentity(this, value, seat)) {
            return;
        }
        try {
            await this.messageProcessor.process(this, value, ws);
        } catch (e) {
            console.error("WebSocket message processing error:", e && e.message ? e.message : e);
        }
    };

    onConnectionClosed = () => { };

    closeGame = () => {
        gameClocks.clearFlagTimer(this);
        if (this.whitePlayer) {
            if (this.whitePlayer.channel) {
                const ch = this.whitePlayer.channel;
                if (ch._gameMessageHandler) {
                    ch.off("message", ch._gameMessageHandler);
                } else {
                    ch.off("message", this.onMessageReceived);
                }
            }
        }
        if (this.blackPlayer) {
            if (this.blackPlayer.channel) {
                const ch = this.blackPlayer.channel;
                if (ch._gameMessageHandler) {
                    ch.off("message", ch._gameMessageHandler);
                } else {
                    ch.off("message", this.onMessageReceived);
                }
            }
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
        this.turn = this.chessGame.Turn;
    }


}

module.exports = { GameBase };