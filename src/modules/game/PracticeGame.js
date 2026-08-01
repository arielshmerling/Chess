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
        if (super.init(ws, userId) === false) {
            return false;
        }
        this.status = "in progress";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
        return true;
    }

    /** One human plays both colors — client may set isWhite per ply. */
    allowsClientChosenSide() {
        return true;
    }

    onConnectionClosed = () => {
        // After explicit practice quit we persist as in progress; do not overwrite with cancelled on WS close
        if (this._practiceQuitMidGame) { return; }
        if (this.status === "game over" || this.status === "cancelled") { return; }
        this.status = "cancelled";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
    };

    /**
     * Practice quit mid-game: do not run resign flow (no result move, no game over in DB).
     * Persist state in progress, reason null, result null.
     */
    /* eslint-disable-next-line no-unused-vars -- same signature as GameBase/OnlineGame */
    async resign(_resignedPlayer) {
        this._practiceQuitMidGame = true;
        this.status = "in progress";
        if (this.OnPracticeQuitMidGame) {
            await this.raiseEvent(this.OnPracticeQuitMidGame, { game: this });
        }
    }
}

module.exports = { PracticeGame };