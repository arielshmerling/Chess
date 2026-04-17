
const { MessageProcessor } = require("./MessageProcessor");

class OnlineGameMessageProcessor extends MessageProcessor {


    infoTypeHandlers = {
        "move accepted": null, // related to single game only. when brain plays need to capture the move time
        "resign": this.resign,
        "offer draw": this.drawOfferForward,
        "draw accepted": this.drawOfferAccepted,
        "draw declined": this.opponentForwardHandler,
        "offer rematch": this.opponentForwardHandler,
        "rematch accepted": this.rematchOfferAccepted,
        "rematch declined": this.opponentForwardHandler,
        "outOfTime": this.reportOutOfTime,
        "chat": this.chatHandler,
    };


    resign(game, msg) {
        const resignedPlayer = msg.isWhite ? "White" : "Black";
        msg.info = "Opponent resigned";
        const snap =
            typeof msg.whiteTimer === "number" && typeof msg.blackTimer === "number"
                ? {
                    moveTime: typeof msg.moveTime === "number" ? msg.moveTime : undefined,
                    whiteTimer: msg.whiteTimer,
                    blackTimer: msg.blackTimer,
                }
                : undefined;
        return game.resign(resignedPlayer, snap ? { resignClockSnapshot: snap } : {}).then(() => {
            game.sendMessageToOpponent(msg, msg.isWhite);
            game.sendInfoToWatchers(msg);
            game.sendMoveToWatchers(game.gameId, resignedPlayer === "White", game.chessGame.ResultMove);
        });
    }

    opponentForwardHandler(game, msg) {
        game.sendMessageToOpponent(msg, msg.isWhite);
        game.sendInfoToWatchers(msg);
    }

    /**
     * Draw only after the player has moved at least once, and only on the opponent's turn (not while waiting for your move).
     */
    drawOfferForward(game, msg) {
        if (game.status === "game over" || game.status === "cancelled") {
            return;
        }
        const moves = game.moves || [];
        const isWhite = msg.isWhite === true;
        const turn = game.chessGame && game.chessGame.Turn;
        if (isWhite) {
            if (moves.length < 1 || turn === "white") {
                return;
            }
        } else {
            if (moves.length < 2 || turn === "black") {
                return;
            }
        }
        game.sendMessageToOpponent(msg, msg.isWhite);
        game.sendInfoToWatchers(msg);
    }

    rematchOfferAccepted(game, msg) {
        game.createRemtach(msg.isWhite, (newGame) => {
            const spectatorText = "New game started — go to Home to watch.";
            game.sendSpectatorRematchNewGameNotice(newGame.gameId, spectatorText);
            game.closeGame();
            msg.gameId = newGame.gameId;
            newGame.sendMessage(msg, msg.isWhite);
            newGame.sendMessageToOpponent(msg, msg.isWhite);
            newGame.init(newGame.whitePlayer.channel, newGame.whitePlayer.userId);
            newGame.init(newGame.blackPlayer.channel, newGame.blackPlayer.userId);
        });
    }

    drawOfferAccepted(game, msg) {
        const offerBy = msg.isWhite ? "black" : "white";
        game.draw(offerBy, () => {
            game.sendMessageToOpponent(msg, msg.isWhite);
            game.sendInfoToWatchers(msg);
        });
    }

    chatHandler(game, msg) {
        game.sendMessageToOpponent(msg, msg.isWhite);
    }

    async reportOutOfTime(game, msg) {
        await game.outOfTime(msg.loser);
        const go = { type: "info", info: "game over", gameId: game.gameId };
        game.sendMessage(go, true);
        game.sendMessage(go, false);
        game.sendInfoToWatchers(go);
    }

    onInfoReceived(game, msg) {
        if (game?.messageProcessor.infoTypeHandlers[msg.info] != null) {
            const infoHandler = game.messageProcessor.infoTypeHandlers[msg.info];
            if (infoHandler) { return infoHandler(game, msg); }
        }
    }

    async onMoveReceived(game, msg) {

        if (!game.startedOn) {
            game.startedOn = new Date().getTime();
        }
        game.lastMoveOn = new Date().getTime();

        const move = await game.handleMove(msg.isWhite, msg.data, "player");

        if (move.valid) {
            const message = { type: "info", info: "move validated successfully", gameId: msg.gameId };
            game.sendMessage(message, msg.isWhite);
            game.sendMoveToOpponent(msg.gameId, msg.isWhite, move);
            game.sendMoveToWatchers(msg.gameId, msg.isWhite, move);
        }
        else {
            const message = { type: "info", info: "move validation failed", gameId: msg.gameId };
            game.sendMessage(message, msg.isWhite);
        }
    }
}

module.exports = { OnlineGameMessageProcessor };