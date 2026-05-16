/**
 * Desktop single-player game snapshots as JSON files under userData/games/.
 */

const fs = require("fs").promises;
const path = require("path");
const runtime = require("./runtime");

function gameFilePath(gameId) {
    return path.join(runtime.getGamesDir(), `${String(gameId)}.json`);
}

/**
 * @param {object} game live SinglePlayerGame instance
 */
async function persistGame(game) {
    if (!game || !game.gameId) {
        return;
    }
    const snapshot = {
        gameId: String(game.gameId),
        gameType: game.constructor.name,
        status: game.status,
        mode: game.mode,
        options: game.options || {},
        whitePlayerName: game.whitePlayer ? game.whitePlayer.userName : "",
        blackPlayerName: game.blackPlayer ? game.blackPlayer.userName : "",
        moves: game.moves || [],
        reason: game.reason != null ? game.reason : null,
        result:
            game.chessGame && game.chessGame.ResultMove && game.chessGame.ResultMove.moveStr
                ? game.chessGame.ResultMove.moveStr
                : null,
        savedAt: new Date().toISOString(),
    };
    await fs.writeFile(gameFilePath(game.gameId), JSON.stringify(snapshot, null, 2), "utf8");
}

/**
 * @param {object} game
 * @returns {Promise<{ id: string, _id: string }>}
 */
async function assignGameIdFromStore(game) {
    await persistGame(game);
    const id = String(game.gameId);
    return { id, _id: id };
}

module.exports = {
    persistGame,
    assignGameIdFromStore,
};
