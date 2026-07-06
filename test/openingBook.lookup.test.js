/**
 * Opening book lookup when the board is stored in black-player view (whitePlayerView:false).
 * Regression: brain42/brain43 used raw state keys and missed the book whenever the human
 * played black (engine as white on move 1).
 *
 * Run: npx mocha ./test/openingBook.lookup.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const { loadOpeningBookEntries } = require("../src/openingBookLoader");
const {
    savedGameStateToLookupKey,
    savedGameStateToCanonicalLookupKey,
} = require("../src/openingBookJson");

describe("Opening book lookup (flipped board)", () => {
    /** @type {Set<string>} */
    let bookKeys;

    before(async function () {
        this.timeout(30000);
        const entries = await loadOpeningBookEntries();
        bookKeys = new Set(entries.map((e) => e.state));
        assert.ok(bookKeys.size > 0, "opening book should load");
    });

    it("raw key misses the initial position when whitePlayerView is false", () => {
        const game = new ChessGame();
        game.startNewGame(false);
        const raw = savedGameStateToLookupKey(game.SavedGameState);
        assert.strictEqual(game.GameState.whitePlayerView, false);
        assert.ok(!bookKeys.has(raw), "flipped raw key should not be in the book");
    });

    it("canonical key hits the initial position when whitePlayerView is false", () => {
        const game = new ChessGame();
        game.startNewGame(false);
        const { lookupKey, flipMoves } = savedGameStateToCanonicalLookupKey(game.SavedGameState);
        assert.ok(bookKeys.has(lookupKey), "canonical key should match the book");
        assert.strictEqual(flipMoves, true);
    });

    for (const engine of ["brain42", "brain43"]) {
        it(`${engine} picks a book move on move 1 when engine plays white (flipped view)`, async function () {
            this.timeout(30000);
            const mod = require(`../src/${engine}`);
            await mod.whenOpeningBookReady();

            const game = new ChessGame();
            game.startNewGame(false);
            assert.strictEqual(game.Turn, "white");

            const move = await mod.brainNextMoveFunc(game, {
                thinkingTimeMs: 10000,
                pliesPlayed: 0,
            });

            assert.ok(move && move.source && move.target, "engine returns a move");
            assert.strictEqual(move.searchDepthReached, 0, "should be an opening-book hit (depth 0)");
            assert.ok(game.validateMove(move.source, move.target, "white").valid, "book move is legal");
            mod.shutdownWorkers && mod.shutdownWorkers();
        });
    }
});
