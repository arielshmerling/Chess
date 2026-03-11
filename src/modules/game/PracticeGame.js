const { GameBase } = require("./GameBase");
const { Player } = require("./Player");
const { PracticeGameMessageProcessor } = require("./PracticeGameMessageProcessor");

class PracticeGame extends GameBase {
    constructor(gameInfo, player, mode) {
        super(gameInfo, player, mode);
        console.log("This is the practice game class. ");
        this.whitePlayer = mode == "review" ? new Player(null, gameInfo.whitePlayer) : player;
        this.blackPlayer = mode == "review" ? new Player(null, gameInfo.blackPlayer) : player;
        this.messageProcessor = new PracticeGameMessageProcessor();
    }

    init(ws, userId) {
        super.init(ws, userId);
        this.status = "in progress";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
    }

    onConnectionClosed = () => {
        if (this.status === "game over" || this.status === "cancelled") { return; }
        this.status = "cancelled";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
    };

    async resign(resignedPlayer) {
        await super.resign(resignedPlayer);
        this.status = "game over";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
    }
}

module.exports = { PracticeGame };