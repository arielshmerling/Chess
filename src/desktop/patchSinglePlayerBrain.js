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
                return Promise.resolve(null);
            }
            if (game.status === "cancelled") {
                return Promise.resolve(null);
            }
            if (
                !game.chessGame.GameOver &&
                game.chessGame.Turn === "white" &&
                game.whitePlayer &&
                game.whitePlayer.userId === null
            ) {
                return game.makeBrainMove(true);
            }
            return Promise.resolve(null);
        };

        if (game.options.engine === "brain42") {
            const brain42 = require("../brain42");
            return brain42
                .whenOpeningBookReady()
                .then(originalRun)
                .catch((err) => {
                    console.error("[desktop] Opening book wait failed:", err);
                    return originalRun();
                });
        }
        return originalRun();
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
            return null;
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
                return null;
            }

            const move = await this.handleMove(brainPlaysAsWhite, brainMove, "brain");
            if (move && move.valid !== false) {
                const clientMove = this.opponentMovePayload(brainPlaysAsWhite, move);
                this.sendMoveToOpponenet(brainPlaysAsWhite, move);
                this.sendMoveToWatchers(this.gameId, brainPlaysAsWhite, move);
                return { move, clientMove, brainPlaysAsWhite };
            }
            console.warn("[desktop] Brain move rejected by handleMove");
            return null;
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
                    return null;
                }

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
}

module.exports = { applyDesktopSinglePlayerBrainPatch };
