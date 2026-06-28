
const path = require("path");
const { GameBase } = require("./GameBase");
const { Player } = require("./Player");
const { SinglePlayerMessageProcessor } = require("./SinglePlayerMessageProcessor");
const brainConfigService = require("./brainConfigService");

const ALLOWED_ENGINES = ["brain2", "brain3", "brain4", "brain41", "brain42", "brain43"];

function loadEngine(engineName) {
    const name = (engineName && ALLOWED_ENGINES.includes(engineName)) ? engineName : "brain4";
    const enginePath = path.join(__dirname, "..", "..", name);
    const mod = require(enginePath);

    if (name === "brain2") {
        const { Brain } = mod;
        return {
            brainNextMoveFunc: async (game, options) => {
                const maxDepth = options?.maxDepth != null ? Math.min(6, Math.max(1, options.maxDepth)) : 1;
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
            const engineName = this.options.engine || "brain4";
            this.options.engineConfig = brainConfigService.loadBrainConfig(engineName);
            if (engineName === "brain42" || engineName === "brain43") {
                require(path.join(__dirname, "..", "..", engineName)).preloadOpeningBook();
            }
            this._brainNextMoveFunc = engine.brainNextMoveFunc;
            this._brainName = engine.Name;
            this._BrainTimeoutFallbackError = engine.BrainTimeoutFallbackError;
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
        const isRejoin = this.moves.length > 0 || this.status === "reJoining";
        if (isRejoin) {
            super.init(ws, userId);
            this.status = "in progress";
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            return;
        }
        super.init(ws, userId);
        //this.brain = new Brain();
        this.chessGame.startNewGame(true); // for now, online game are always white view. might be changed in the future
        this.status = "in progress";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
        // When human plays black, engine plays white and must make the first move
        if (!this.chessGame.GameOver && this.chessGame.Turn === "white" && this.whitePlayer.userId === null) {
            void this.scheduleInitialBrainMoveIfNeeded();
        }
    }

    setHumanPlaysWhite(humanIsWhite) {
        if (this.mode === "review") {
            return;
        }
        let human = null;
        let ai = null;
        if (this.whitePlayer && this.whitePlayer.userId != null) {
            human = this.whitePlayer;
            ai = this.blackPlayer;
        } else if (this.blackPlayer && this.blackPlayer.userId != null) {
            human = this.blackPlayer;
            ai = this.whitePlayer;
        }
        if (!human) {
            return;
        }
        const brainName = this._brainName || "Brain";
        const humanChannel = human.channel;
        if (!ai || ai.userId != null) {
            ai = new Player(null, brainName);
        }
        if (humanIsWhite) {
            this.whitePlayer = human;
            this.blackPlayer = ai;
        } else {
            this.blackPlayer = human;
            this.whitePlayer = ai;
        }
        human.channel = humanChannel;
        if (this.whitePlayer === human) {
            this.whitePlayer.channel = humanChannel;
            if (this.blackPlayer) {
                this.blackPlayer.channel = null;
            }
        } else if (this.blackPlayer === human) {
            this.blackPlayer.channel = humanChannel;
            if (this.whitePlayer) {
                this.whitePlayer.channel = null;
            }
        }
    }

    scheduleBrainMoveIfAiTurn() {
        if (this.chessGame.GameOver) {
            return Promise.resolve(null);
        }
        this.turn = this.chessGame.Turn;
        const turn = this.chessGame.Turn;
        const aiPlaysWhite = this.whitePlayer && this.whitePlayer.userId == null;
        const aiPlaysBlack = this.blackPlayer && this.blackPlayer.userId == null;
        if (turn === "white" && aiPlaysWhite) {
            return this.scheduleInitialBrainMoveIfNeeded();
        }
        if (turn === "black" && aiPlaysBlack) {
            return this.makeBrainMove(false);
        }
        return Promise.resolve(null);
    }

    scheduleInitialBrainMoveIfNeeded() {
        const run = () => {
            if (
                !this.chessGame.GameOver &&
                this.chessGame.Turn === "white" &&
                this.whitePlayer &&
                this.whitePlayer.userId === null
            ) {
                return this.makeBrainMove(true);
            }
            return Promise.resolve(null);
        };
        if (this.options.engine === "brain42" || this.options.engine === "brain43") {
            return require(path.join(__dirname, "..", "..", this.options.engine))
                .whenOpeningBookReady()
                .then(run)
                .catch((err) => {
                    console.error("[SinglePlayerGame] Opening book preload failed:", err);
                    return run();
                });
        }
        return run();
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
        if (!brainNextMoveFunc) { return null; }

        const maxDepth = Math.min(6, Math.max(1, Number(this.options.difficulty) || 3));
        try {
            // console.profile();
            console.time("brain");
            const brainMove = await brainNextMoveFunc(chessGame, {
                maxDepth,
                config: this.options.engineConfig,
            });
            console.timeEnd("brain");
            //    console.profileEnd();

            const move = await this.handleMove(brainPlaysAsWhite, brainMove, "brain");
            if (move && move.valid !== false) {
                const clientMove = this.opponentMovePayload(brainPlaysAsWhite, move);
                this.sendMoveToOpponenet(brainPlaysAsWhite, move);
                this.sendMoveToWatchers(this.gameId, brainPlaysAsWhite, move);
                return { move, clientMove, brainPlaysAsWhite };
            }
            console.warn("[SinglePlayerGame] Brain move rejected by handleMove");
            return null;

        } catch (err) {
            // Check if this is a timeout fallback error
            if (BrainTimeoutFallbackError && err instanceof BrainTimeoutFallbackError) {
                // Use the fallback move
                const fallbackMove = err.fallbackMove;

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
                if (move && move.valid !== false) {
                    const clientMove = this.opponentMovePayload(brainPlaysAsWhite, move);
                    this.sendMoveToOpponenet(brainPlaysAsWhite, move);
                    this.sendMoveToWatchers(this.gameId, brainPlaysAsWhite, move);
                    return { move, clientMove, brainPlaysAsWhite };
                }
                const message = { type: "info", info: "move validation failed", gameId: this.gameId };
                this.sendMessage(message, brainPlaysAsWhite);
            } else {
                const message = { type: "info", info: "move validation failed", gameId: this.gameId };
                this.sendMessage(message, brainPlaysAsWhite);
            }
        }
        return null;
    };

    /** True if the human player has made at least one move (white moves first, so black has moved only when moves.length >= 2). */
    humanHasMadeAnyMove = () => {
        const humanIsWhite = this.whitePlayer && this.whitePlayer.userId != null;
        if (humanIsWhite) {
            return this.moves.length >= 1;
        }
        return this.moves.length >= 2;
    };

    onConnectionClosed = () => {
        if (this.status === "game over") { return; }
        if (this.status === "cancelled") { return; }
        // No moves at all: game never really started → cancelled (covers human white with 0 moves)
        if (this.moves.length === 0) {
            this.status = "cancelled";
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            return;
        }
        // Human plays black: only the engine's first move exists → cancelled
        if (!this.humanHasMadeAnyMove()) {
            this.status = "cancelled";
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            return;
        }
        this.lastStatus = this.status;
        this.status = "on hold";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
    };

    updateLastMoveTime = (gameTime, whiteT, blackT) => {
        const lastMove = this.moves[this.moves.length - 1];
        if (!lastMove) {
            return;
        }
        if (typeof gameTime === "number" && Number.isFinite(gameTime)) {
            lastMove.moveTime = gameTime;
        }
        if (typeof whiteT === "number" && Number.isFinite(whiteT)) {
            lastMove.whiteTimer = Math.round(whiteT);
        }
        if (typeof blackT === "number" && Number.isFinite(blackT)) {
            lastMove.blackTimer = Math.round(blackT);
        }
        this.raiseEvent(this.OnMoveChanged, { game: this, lastMove });
    };

    async resign(resignedPlayer, options = {}) {
        if (!this.humanHasMadeAnyMove()) {
            this.status = "cancelled";
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            return;
        }
        await super.resign(resignedPlayer, options);
        const message = {
            type: "move",
            data: this.chessGame.ResultMove,
            gameId: this.gameId,
        };
        this.sendMessage(message, resignedPlayer);
        this.sendMoveToWatchers(this.gameId, resignedPlayer === "white", this.chessGame.ResultMove);
        this.sendInfoToWatchers({ type: "info", info: "Opponent resigned", gameId: this.gameId, isWhite: resignedPlayer === "white" });
    }
}


module.exports = { SinglePlayerGame };
