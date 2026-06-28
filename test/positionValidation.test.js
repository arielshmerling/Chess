const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");

global.window = global;
require("../src/desktop/ui/desktop-position-validation");

const { getMessage } = global.DesktopPositionValidation;

describe("desktop position validation", function () {
    let game;

    beforeEach(function () {
        game = new ChessGame(true);
        game.startNewGame(true);
    });

    it("accepts the standard starting position for play", function () {
        assert.strictEqual(getMessage(game, "play"), null);
        assert.strictEqual(getMessage(game, "save"), null);
    });

    it("rejects an empty board", function () {
        const empty = JSON.parse(JSON.stringify(game.GameState));
        for (let r = 0; r < 8; r += 1) {
            for (let c = 0; c < 8; c += 1) {
                empty.board[r][c] = null;
            }
        }
        game.loadGame(JSON.stringify(empty));

        const err = getMessage(game, "play");
        assert.ok(err);
        assert.match(err, /white king/i);
    });

    it("rejects adjacent kings", function () {
        const state = JSON.parse(JSON.stringify(game.GameState));
        for (let r = 0; r < 8; r += 1) {
            for (let c = 0; c < 8; c += 1) {
                state.board[r][c] = null;
            }
        }
        state.board[4][4] = { color: "white", pieceType: game.KING };
        state.board[4][5] = { color: "black", pieceType: game.KING };
        game.loadGame(JSON.stringify(state));

        const err = getMessage(game, "save");
        assert.ok(err);
        assert.match(err, /adjacent squares/i);
    });

    it("uses purpose-specific headers", function () {
        const empty = JSON.parse(JSON.stringify(game.GameState));
        for (let r = 0; r < 8; r += 1) {
            for (let c = 0; c < 8; c += 1) {
                empty.board[r][c] = null;
            }
        }
        game.loadGame(JSON.stringify(empty));

        assert.match(getMessage(game, "save"), /^Cannot save this position:/);
        assert.match(getMessage(game, "play"), /^Cannot play from this position:/);
    });
});
