/**
 * Persist single-player game state to JSON files (desktop only).
 */

const gameStore = require("./gameStore");

function registerDesktopGameEvents(game) {
    const persist = async (e) => {
        const g = e.game;
        if (g && g.gameId) {
            await gameStore.persistGame(g);
        }
    };

    game.OnMove = persist;
    game.OnGameStateChanged = async (e) => {
        if (e.game) {
            e.game.status = e.newState;
        }
        await persist(e);
    };
    game.OnGameOver = async (e) => {
        const g = e.game;
        if (g && e.reason != null && g.reason == null) {
            g.reason = e.reason;
        }
        await persist(e);
    };
    game.OnPracticeQuitMidGame = persist;
    game.OnRematch = persist;
    game.OnBookmarkLoaded = async (e) => {
        const g = e.game;
        if (g && e.moves) {
            g.moves = e.moves;
        }
        await persist(e);
    };
    game.OnMoveChanged = async (e) => {
        const g = e.game;
        if (g && e.lastMove && g.moves && g.moves.length > 0) {
            g.moves[g.moves.length - 1] = e.lastMove;
        }
        await persist(e);
    };
}

module.exports = { registerDesktopGameEvents };
