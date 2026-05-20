/**
 * Desktop-only move protocol. Web shared modules stay unchanged.
 * Desktop client uses canonical ChessGame board coordinates; web black-player
 * WS moves are flipped on the server — desktop must not use that flip path.
 */

const { GameBase } = require("../modules/game/GameBase");
const { SinglePlayerMessageProcessor } = require("../modules/game/SinglePlayerMessageProcessor");

let patched = false;

function applyDesktopGameProtocolPatch() {
    if (patched) {
        return;
    }
    patched = true;

    const originalHandleMove = GameBase.prototype.handleMove;
    GameBase.prototype.handleMove = async function handleMoveDesktopPatched(isWhite, moveObj, origin) {
        if (process.env.SHMERLING_MODE === "desktop" && !isWhite && origin === "player") {
            return originalHandleMove.call(this, isWhite, moveObj, "brain");
        }
        return originalHandleMove.call(this, isWhite, moveObj, origin);
    };

    const originalOpponentPayload = GameBase.prototype.opponentMovePayload;
    GameBase.prototype.opponentMovePayload = function opponentMovePayloadDesktopPatched(isWhitePlayer, moveObj) {
        if (process.env.SHMERLING_MODE === "desktop") {
            return moveObj;
        }
        return originalOpponentPayload.call(this, isWhitePlayer, moveObj);
    };

    const originalOnMoveReceived = SinglePlayerMessageProcessor.prototype.onMoveReceived;
    SinglePlayerMessageProcessor.prototype.onMoveReceived = async function onMoveReceivedDesktopPatched(
        game,
        msg
    ) {
        if (process.env.SHMERLING_MODE !== "desktop") {
            return originalOnMoveReceived.call(this, game, msg);
        }

        if (!game.startedOn) {
            game.startedOn = new Date().getTime();
        }
        game.lastMoveOn = new Date().getTime();

        const move = await game.handleMove(msg.isWhite, msg.data, "player");

        if (move && move.valid !== false) {
            game.sendMessage(
                { type: "info", info: "move validated successfully", gameId: msg.gameId },
                msg.isWhite
            );
            game.sendMoveToWatchers(msg.gameId, msg.isWhite, move);
            if (!game.chessGame.GameOver) {
                await game.makeBrainMove(!msg.isWhite);
            } else {
                game.sendMessage({ type: "info", info: "game over", gameId: msg.gameId }, msg.isWhite);
            }
        } else {
            game.sendMessage(
                { type: "info", info: "move validation failed", gameId: msg.gameId },
                msg.isWhite
            );
        }
    };
}

module.exports = { applyDesktopGameProtocolPatch };
