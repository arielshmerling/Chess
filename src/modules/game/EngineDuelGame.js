/**
 * Server-driven engine vs engine game (admin Bots). Both seats are AI; humans watch only.
 */

"use strict";

const { GameBase } = require("./GameBase");
const { Player } = require("./Player");

class EngineDuelMessageProcessor {
    async processMessage() {
        /* Participants cannot move; watchers use the watch WebSocket path. */
    }
}

class EngineDuelGame extends GameBase {
    constructor(gameInfo, adminPlayer, mode) {
        super(gameInfo, adminPlayer, mode);
        this.options = gameInfo.options || {};
        const whiteLabel =
            (this.options.whiteLabel && String(this.options.whiteLabel).trim()) || "White engine";
        const blackLabel =
            (this.options.blackLabel && String(this.options.blackLabel).trim()) || "Black engine";
        this.whitePlayer = new Player(null, whiteLabel);
        this.blackPlayer = new Player(null, blackLabel);
        this.messageProcessor = new EngineDuelMessageProcessor();
        this._duelAbort = false;
        this._duelRunning = false;
    }

    /**
     * No human seats — reject play-channel init so admins/members only watch.
     */
    init() {
        return false;
    }

    startDuelBoard() {
        this.chessGame.startNewGame(true);
        this.status = "in progress";
        this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
        this.startServerClocks("white");
    }

    requestAbort() {
        this._duelAbort = true;
    }

    isAbortRequested() {
        return this._duelAbort === true;
    }
}

module.exports = { EngineDuelGame };
