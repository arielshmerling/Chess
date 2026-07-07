/**
 * Unit tests for line-based opening book prefix index.
 * Run: npx mocha ./test/openingBook.lines.test.js
 */
/* eslint-disable */

const assert = require("assert");
const { ChessGame } = require("../src/ChessGame");
const {
    buildPrefixIndex,
    movePrefixFromGame,
    candidateMovesForGame,
    extractLineFromPgnGame,
} = require("../src/openingBookLines");

describe("opening book lines", () => {
    it("buildPrefixIndex aggregates weights per prefix", () => {
        const lines = [
            "e4 e5 Nf3",
            "e4 e5 Bc4",
            "e4 c5",
        ];
        const { prefixIndex, lineCount, prefixCount } = buildPrefixIndex(lines);
        assert.strictEqual(lineCount, 3);
        assert.ok(prefixCount >= 3);

        const start = prefixIndex.get("");
        assert.strictEqual(start.get("e4"), 3);

        const afterE4 = prefixIndex.get("e4");
        assert.strictEqual(afterE4.get("e5"), 2);
        assert.strictEqual(afterE4.get("c5"), 1);

        const afterE4E5 = prefixIndex.get("e4 e5");
        assert.strictEqual(afterE4E5.get("Nf3"), 1);
        assert.strictEqual(afterE4E5.get("Bc4"), 1);
    });

    it("extractLineFromPgnGame replays SAN and stops at max plies", () => {
        const pgnGame = {
            moves: [
                { moveStr: "e4", color: "white" },
                { moveStr: "e5", color: "black" },
                { moveStr: "Nf3", color: "white" },
                { moveStr: "Nc6", color: "black" },
            ],
        };
        assert.strictEqual(extractLineFromPgnGame(pgnGame, 3), "e4 e5 Nf3");
    });

    it("candidateMovesForGame returns legal book options for current position", () => {
        const { prefixIndex } = buildPrefixIndex(["e4 e5 Nf3 Nc6", "e4 e5 Bc4"]);
        const game = new ChessGame();
        game.startNewGame(true);
        const e4 = game.convertPGNMove({ moveStr: "e4", color: "white" });
        game.makeMove(e4.source, e4.target);
        const e5 = game.convertPGNMove({ moveStr: "e5", color: "black" });
        game.makeMove(e5.source, e5.target);

        assert.strictEqual(movePrefixFromGame(game), "e4 e5");
        const { options } = candidateMovesForGame(game, prefixIndex);
        const sans = options.map((o) => o.pgn).sort();
        assert.deepStrictEqual(sans, ["Bc4", "Nf3"]);
    });
});
