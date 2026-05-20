/**
 * Desktop-only SinglePlayerGame behavior. Web SinglePlayerGame source unchanged.
 */

const { GameBase } = require("../modules/game/GameBase");
const { SinglePlayerGame } = require("../modules/game/SinglePlayerGame");

let patched = false;

function applyDesktopSinglePlayerBrainPatch() {
    if (patched) {
        return;
    }
    patched = true;

    const originalInit = SinglePlayerGame.prototype.init;
    SinglePlayerGame.prototype.init = function initDesktopPatched(ws, userId) {
        if (process.env.SHMERLING_MODE === "desktop") {
            const isRejoin = this.moves.length > 0 || this.status === "reJoining";
            if (isRejoin) {
                return originalInit.call(this, ws, userId);
            }
            GameBase.prototype.init.call(this, ws, userId);
            this.status = "in progress";
            this.raiseEvent(this.OnGameStateChanged, { game: this, newState: this.status });
            return;
        }
        return originalInit.call(this, ws, userId);
    };
}

module.exports = { applyDesktopSinglePlayerBrainPatch };
