
const { SinglePlayerGame } = require("./SinglePlayerGame");
const { PracticeGame } = require("./PracticeGame");
const { OnlineGame } = require("./OnlineGame");


class GameFactory {

    static createGame(gameInfo, player, mode) {

        switch (gameInfo.gameType) {
            case 1:
            case "SinglePlayerGame":
                return new SinglePlayerGame(gameInfo, player, mode);
            case 2:
            case "OnlineGame":
                return new OnlineGame(gameInfo, player, mode);
            case 3:
            case "PracticeGame":
                return new PracticeGame(gameInfo, player, mode);
            default:
                throw new Error("Unknown game type");
        }
    }
}

module.exports = { GameFactory };
