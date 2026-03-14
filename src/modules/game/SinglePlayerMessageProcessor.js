
const { MessageProcessor } = require("./MessageProcessor");

class SinglePlayerMessageProcessor extends MessageProcessor {
    async onInfoReceived(game, msg) {
        //   console.log("onInfoReceived in Single MessageProcessor");
        super.onInfoReceived(game, msg);
        switch (msg.info) {
            case "offer rematch":
                game.sendMessage(msg, msg.isWhite);
                break;
            case "rematch accepted":

                game.createRemtach(msg.isWhite, (newGame) => {
                    game.closeGame();
                    msg.gameId = newGame.gameId;
                    newGame.sendMessage(msg, msg.isWhite);
                    // newGame.sendMessageToOpponent(msg, msg.isWhite);
                    newGame.init(newGame.whitePlayer.channel, newGame.whitePlayer.userId);
                    //newGame.init(newGame.blackPlayer.channel, newGame.blackPlayer.userId);
                });

                break;
            case "resign":
                await game.resign(msg.isWhite ? "white" : "black");
                msg.info = "Opponent resigned";
                break;
            case "offer draw": {
                const numFullMoves = Math.floor(game.moves.length / 2);
                const offeredBy = msg.isWhite ? "white" : "black";
                if (numFullMoves < 10) {
                    game.sendMessage({ type: "info", info: "draw declined", gameId: game.gameId }, msg.isWhite);
                } else {
                    await game.draw(offeredBy, () => {
                        game.sendMessage({ type: "info", info: "draw accepted", gameId: game.gameId, isWhite: !msg.isWhite }, msg.isWhite);
                    });
                }
                break;
            }
            case "move accepted":
                if (game.moves.length > 0) {
                    game.updateLastMoveTime(msg.moveTime);
                }
                break;
            case "draw accepted":
                break;
            case "draw declined":
                break;
            case "rematch declined":
                break;
            case "outOfTime":
                break;
            default:
                console.log("Unknown info omessage");
                break;
        }
    }

    onCommandReceived(game, msg) {
        if (msg.info == "setState") {
            const state = msg.data;
            game.load(state);
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
            game.sendMoveToWatchers(msg.gameId, msg.isWhite, move);
            if (!game.chessGame.GameOver) {
                game.makeBrainMove(!msg.isWhite);
            }
            else {
                const message = { type: "info", info: "game over", gameId: msg.gameId };
                game.sendMessage(message, msg.isWhite);
            }
        }
        else {
            const message = { type: "info", info: "move validation failed", gameId: msg.gameId };
            game.sendMessage(message, msg.isWhite);
            console.log("onMoveReceived::move validation failed");

        }


    }


}


module.exports = { SinglePlayerMessageProcessor };