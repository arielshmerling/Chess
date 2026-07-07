/**
 * Opening book lookup when the board is stored in black-player view (whitePlayerView:false).
 * Line-based book uses move-prefix strings, so orientation does not affect lookup.
 *
 * Run: npx mocha ./test/openingBook.lookup.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const {
    loadOpeningBookPrefixIndex,
    movePrefixFromGame,
    candidateMovesForGame,
} = require("../src/openingBookLines");

describe("Opening book lookup (flipped board)", () => {
    /** @type {Map<string, Map<string, number>>} */
    let prefixIndex;

    before(async function () {
        this.timeout(30000);
        const loaded = await loadOpeningBookPrefixIndex();
        prefixIndex = loaded.prefixIndex;
        assert.ok(loaded.lineCount > 0, "opening book lines should load");
    });

    it("empty prefix has first-move options", () => {
        const bucket = prefixIndex.get("");
        assert.ok(bucket && bucket.size > 0, "start position should have book moves");
    });

    it("move prefix is the same when whitePlayerView is false", () => {
        const upright = new ChessGame();
        upright.startNewGame(true);
        const flipped = new ChessGame();
        flipped.startNewGame(false);
        assert.strictEqual(movePrefixFromGame(upright), "");
        assert.strictEqual(movePrefixFromGame(flipped), "");
    });

    it("prefix lookup offers black replies after 1.e4 on flipped view", () => {
        const upright = new ChessGame();
        upright.startNewGame(true);
        const e4 = upright.convertPGNMove({ moveStr: "e4", color: "white" });
        upright.makeMove(e4.source, e4.target);

        const game = new ChessGame();
        game.startNewGame(false);
        game.loadMoves(upright.Moves.slice());

        assert.strictEqual(movePrefixFromGame(game), "e4");
        const { options } = candidateMovesForGame(game, prefixIndex);
        assert.ok(options.length > 0, "book should offer black replies after 1.e4");
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
