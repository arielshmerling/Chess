/**
 * Apply a saved bookmark to an in-memory single-player game.
 */

const gamesManagerService = require("../modules/gamesManager/service");
const bookmarkStore = require("./bookmarkStore");

async function applyBookmark(_userId, gameId, bookmarkId) {
    const game = gamesManagerService.getGameById(gameId);
    const bookmarkDoc = await bookmarkStore.findBookmarkById(bookmarkId);
    if (!bookmarkDoc || !game) {
        return;
    }
    if (game.constructor.name === "SinglePlayerGame") {
        const moves = bookmarkDoc.moves.map((m) => JSON.parse(m));
        game.chessGame.loadMoves(moves);
        game.moves = [...moves];
        game.raiseEvent(game.OnBookmarkLoaded, { game, moves: bookmarkDoc.moves });
        game.chessGame.loadGame(bookmarkDoc.state);
        if (!game.chessGame.GameOver && game.chessGame.Turn === "black") {
            game.makeBrainMove(false);
        }
    } else {
        game.chessGame.loadGame(bookmarkDoc.state);
    }
}

module.exports = { applyBookmark };
