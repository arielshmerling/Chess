
const path = require("path");
const { GameBase } = require("./GameBase");
const { Player } = require("./Player");
const { SinglePlayerMessageProcessor } = require("./SinglePlayerMessageProcessor");

const ALLOWED_ENGINES = ["brain2", "brain3", "brain4", "brain5"];

function loadEngine(engineName) {
    const name = (engineName && ALLOWED_ENGINES.includes(engineName)) ? engineName : "brain4";
    const enginePath = path.join(__dirname, "..", "..", name);
    const mod = require(enginePath);

    if (name === "brain2") {
        const { Brain } = mod;
        return {
            brainNextMoveFunc: async (game, options) => {
                const maxDepth = options?.maxDepth != null ? Math.min(5, Math.max(1, options.maxDepth)) : 1;
                const brain = new Brain(maxDepth);
                return brain.nextMove(game);
            },
            Name: "Brain 2",
            BrainTimeoutFallbackError: class BrainTimeoutFallbackError extends Error {}
        };
    }

    const BrainTimeoutFallbackError = mod.BrainTimeoutFallbackError || class BrainTimeoutFallbackError extends Error {};
    return {
        brainNextMoveFunc: mod.brainNextMoveFunc,
        Name: mod.Name || name,
        BrainTimeoutFallbackError
    };
}

class SinglePlayerGame extends GameBase {
    //  brain;
    worker;

    //events
    OnMoveChanged;

    constructor(gameInfo, player, mode) {
        super(gameInfo, player, mode);
        this.options = gameInfo.options || {};
        if (mode === "review") {
            this.whitePlayer = new Player(null, gameInfo.whitePlayer);
            this.blackPlayer = new Player(null, gameInfo.blackPlayer);
            this._brainNextMoveFunc = null;
            this._brainName = null;
            this._BrainTimeoutFallbackError = null;
        } else {
            const engine = loadEngine(this.options.engine);
            this._brainNextMoveFunc = engine.brainNextMoveFunc;
            this._brainName = engine.Name;
            this._BrainTimeoutFallbackError = engine.BrainTimeoutFallbackError;
            console.log("SinglePlayerGame engine:", this.options.engine, "->", this._brainName);
            const humanPlayer = player;
            const aiPlayer = new Player(null, this._brainName);
            if (gameInfo.playAsBlack) {
                this.whitePlayer = aiPlayer;
                this.blackPlayer = humanPlayer;
            } else {
                this.whitePlayer = humanPlayer;
                this.blackPlayer = aiPlayer;
            }
        }
        this.messageProcessor = new SinglePlayerMessageProcessor();
    }

    init(ws, userId) {
        super.init(ws, userId);
        //this.brain = new Brain();
        this.chessGame.startNewGame(true); // for now, online game are always white view. might be changed in the future
        this.status = "in progress";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
        // When human plays black, engine plays white and must make the first move
        if (!this.chessGame.GameOver && this.chessGame.Turn === "white" && this.whitePlayer.userId === null) {
            this.makeBrainMove(true);
        }
    }


    /**
     * 
     * @param {string} gameId - A unique number identified the game
     * @param {boolean} isWhite - Wheathe the AI player, plays with white piece set
     */
    makeBrainMove = async (brainPlaysAsWhite) => {

        const chessGame = this.chessGame;

        const brainNextMoveFunc = this._brainNextMoveFunc;
        const BrainTimeoutFallbackError = this._BrainTimeoutFallbackError;
        const brainName = this._brainName;
        if (!brainNextMoveFunc) { return; }

        const maxDepth = Math.min(5, Math.max(1, Number(this.options.difficulty) || 3));
        try {
            // console.profile();
            console.time("brain");
            const brainMove = await brainNextMoveFunc(chessGame, { maxDepth });
            console.timeEnd("brain");
            //    console.profileEnd();

            console.log("Brain suggested a move: " + chessGame.getPGNMoveNotation(brainMove));
            const move = await this.handleMove(brainPlaysAsWhite, brainMove, "brain");
            if (move.valid) {
                this.sendMoveToOpponenet(brainPlaysAsWhite, brainMove);

            }
            else {
                console.log("Brain created an invalid move");
            }

        } catch (err) {
            // Check if this is a timeout fallback error
            if (BrainTimeoutFallbackError && err instanceof BrainTimeoutFallbackError) {
                // Use the fallback move
                const fallbackMove = err.fallbackMove;
                console.log("Brain timed out, using fallback move: " + chessGame.getPGNMoveNotation(fallbackMove));

                // Send chat message
                const chatMessage = {
                    type: "info",
                    info: "chat",
                    data: "WOW you're good!",
                    gameId: this.gameId,
                    username: brainName,
                    isWhite: brainPlaysAsWhite
                };
                this.sendMessage(chatMessage, !brainPlaysAsWhite); // Send to the human player

                // Execute the fallback move
                const move = await this.handleMove(brainPlaysAsWhite, fallbackMove, "brain");
                if (move.valid) {
                    this.sendMoveToOpponenet(brainPlaysAsWhite, fallbackMove);
                } else {
                    console.log("Fallback move validation failed");
                    const message = { type: "info", info: "move validation failed", gameId: this.gameId };
                    this.sendMessage(message, brainPlaysAsWhite);
                }
            } else {
                const message = { type: "info", info: "move validation failed", gameId: this.gameId };
                this.sendMessage(message, brainPlaysAsWhite);
                console.log("makeBrainMove - " + err);
            }
        }
    };

    onConnectionClosed = () => {
        if (this.status != "game over") {
            this.lastStatus = this.status;
            this.status = "on hold";
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
        }
    };

    updateLastMoveTime = (gameTime) => {

        const lastMove = this.moves[this.moves.length - 1];
        lastMove.moveTime = gameTime;
        this.raiseEvent(this.OnMoveChanged, { game: this, lastMove });
    };

    async resign(resignedPlayer) {
        await super.resign(resignedPlayer);
        const message = {
            type: "move",
            data: this.chessGame.ResultMove,
            gameId: this.gameId,
        };
        this.sendMessage(message, resignedPlayer);
    }
}


module.exports = { SinglePlayerGame };