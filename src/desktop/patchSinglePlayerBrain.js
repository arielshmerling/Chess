/**
 * Desktop-only guards for stale initial brain moves after a quick reconnect (same game instance).
 * Does not modify SinglePlayerGame source; applied once at desktop server startup.
 */

const { SinglePlayerGame } = require("../modules/game/SinglePlayerGame");

let patched = false;

function applyDesktopSinglePlayerBrainPatch() {
    if (patched) {
        return;
    }
    patched = true;

    const originalInit = SinglePlayerGame.prototype.init;
    SinglePlayerGame.prototype.init = function initDesktopPatched(ws, userId) {
        this._initialBrainMoveToken = (this._initialBrainMoveToken || 0) + 1;
        return originalInit.call(this, ws, userId);
    };

    SinglePlayerGame.prototype.scheduleInitialBrainMoveIfNeeded = function scheduleInitialBrainMoveDesktopPatched() {
        const scheduleToken = this._initialBrainMoveToken;
        const game = this;
        const originalRun = () => {
            if (scheduleToken !== game._initialBrainMoveToken) {
                return;
            }
            if (game.status === "cancelled") {
                return;
            }
            if (!game.chessGame.GameOver && game.chessGame.Turn === "white" && game.whitePlayer.userId === null) {
                void game.makeBrainMove(true);
            }
        };

        if (game.options.engine === "brain42") {
            const brain42 = require("../brain42");
            brain42
                .whenOpeningBookReady()
                .then(originalRun)
                .catch((err) => {
                    console.error("[desktop] Opening book wait failed:", err);
                    originalRun();
                });
            return;
        }
        originalRun();
    };

    const originalMakeBrainMove = SinglePlayerGame.prototype.makeBrainMove;
    SinglePlayerGame.prototype.makeBrainMove = async function makeBrainMoveDesktopPatched(brainPlaysAsWhite) {
        const isOpeningWhiteMove =
            brainPlaysAsWhite
            && this.whitePlayer.userId == null
            && this.moves.length === 0;
        const initGeneration = this._initialBrainMoveToken;
        const openingMoveIsStale = () =>
            isOpeningWhiteMove && initGeneration !== this._initialBrainMoveToken;

        if (!this._brainNextMoveFunc) {
            return;
        }

        const maxDepth = Math.min(5, Math.max(1, Number(this.options.difficulty) || 3));
        const chessGame = this.chessGame;
        const brainNextMoveFunc = this._brainNextMoveFunc;
        const BrainTimeoutFallbackError = this._BrainTimeoutFallbackError;
        const brainName = this._brainName;

        try {
            console.time("brain");
            const brainMove = await brainNextMoveFunc(chessGame, {
                maxDepth,
                config: this.options.engineConfig,
            });
            console.timeEnd("brain");

            if (openingMoveIsStale()) {
                return;
            }

            const move = await this.handleMove(brainPlaysAsWhite, brainMove, "brain");
            if (move.valid) {
                this.sendMoveToOpponenet(brainPlaysAsWhite, brainMove);
                this.sendMoveToWatchers(this.gameId, brainPlaysAsWhite, brainMove);
            }
        } catch (err) {
            if (BrainTimeoutFallbackError && err instanceof BrainTimeoutFallbackError) {
                const fallbackMove = err.fallbackMove;
                const chatMessage = {
                    type: "info",
                    info: "chat",
                    data: "WOW you're good!",
                    gameId: this.gameId,
                    username: brainName,
                    isWhite: brainPlaysAsWhite,
                };
                this.sendMessage(chatMessage, !brainPlaysAsWhite);

                if (openingMoveIsStale()) {
                    return;
                }

                const move = await this.handleMove(brainPlaysAsWhite, fallbackMove, "brain");
                if (move.valid) {
                    this.sendMoveToOpponenet(brainPlaysAsWhite, fallbackMove);
                    this.sendMoveToWatchers(this.gameId, brainPlaysAsWhite, fallbackMove);
                } else {
                    const message = { type: "info", info: "move validation failed", gameId: this.gameId };
                    this.sendMessage(message, brainPlaysAsWhite);
                }
            } else {
                const message = { type: "info", info: "move validation failed", gameId: this.gameId };
                this.sendMessage(message, brainPlaysAsWhite);
            }
        }
    };
}

module.exports = { applyDesktopSinglePlayerBrainPatch };
