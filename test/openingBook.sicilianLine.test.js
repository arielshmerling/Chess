/**
 * Opening book coverage for 1.e4 c5 2.d3 Nc6 3.c3
 * Run: npx mocha ./test/openingBook.sicilianLine.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const {
    loadOpeningBookPrefixIndex,
    movePrefixFromGame,
    candidateMovesForGame,
} = require("../src/openingBookLines");

function playSan(game, san, color) {
    const move = game.convertPGNMove({ moveStr: san, color });
    const actual = game.makeMove(move.source, move.target);
    if (actual.promotion) {
        actual.selectedPiece = game.QUEEN;
        game.completePromotion(actual);
    }
}

function bookSansAt(prefixIndex, game) {
    const { options } = candidateMovesForGame(game, prefixIndex);
    return options.map((o) => o.pgn);
}

describe("opening book — 1.e4 c5 2.d3 Nc6 3.c3", function () {
    let prefixIndex;

    before(async function () {
        this.timeout(60000);
        const loaded = await loadOpeningBookPrefixIndex();
        prefixIndex = loaded.prefixIndex;
        assert.ok(loaded.lineCount > 0);
    });

    it("has book moves through 2...Nc6 including c3", function () {
        const game = new ChessGame();
        game.startNewGame(true);
        playSan(game, "e4", "white");
        playSan(game, "c5", "black");
        playSan(game, "d3", "white");
        playSan(game, "Nc6", "black");

        const moves = bookSansAt(prefixIndex, game);
        assert.ok(moves.length > 0, "expected book moves for white after 2...Nc6");
        assert.strictEqual(movePrefixFromGame(game), "e4 c5 d3 Nc6");
        assert.ok(moves.includes("c3"), "expected 3.c3 to be a book continuation");
    });

    it("has book moves for black after 3.c3", function () {
        const game = new ChessGame();
        game.startNewGame(true);
        playSan(game, "e4", "white");
        playSan(game, "c5", "black");
        playSan(game, "d3", "white");
        playSan(game, "Nc6", "black");
        playSan(game, "c3", "white");

        assert.strictEqual(game.Turn, "black");
        assert.strictEqual(movePrefixFromGame(game), "e4 c5 d3 Nc6 c3");
        const moves = bookSansAt(prefixIndex, game);
        assert.ok(
            moves.length > 0,
            "expected line-book continuations for black after 3.c3",
        );
    });
});
