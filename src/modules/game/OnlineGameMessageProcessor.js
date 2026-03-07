
const { MessageProcessor } = require("./MessageProcessor");

class OnlineGameMessageProcessor extends MessageProcessor {


    infoTypeHandlers = {
        "move accepted": null, // related to single game only. when brain plays need to capture the move time
        "resign": this.resign,
        "offer draw": this.opponentForwardHandler,
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
        return game.resign(resignedPlayer).then(() => {
            game.sendMessageToOpponent(msg, msg.isWhite);
        });
    }

    opponentForwardHandler(game, msg) {
        game.sendMessageToOpponent(msg, msg.isWhite);
    }

    rematchOfferAccepted(game, msg) {
        game.createRemtach(msg.isWhite, (newGame) => {
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

        });
    }

    chatHandler(game, msg) {
        game.sendMessageToOpponent(msg, msg.isWhite);
    }

    reportOutOfTime(game, msg) {
        game.outOfTime(msg.loser);
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
            console.log("move validation failed");

        }
    }
}

module.exports = { OnlineGameMessageProcessor };