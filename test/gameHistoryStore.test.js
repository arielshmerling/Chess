const assert = require("assert");
const {
    buildPgnRecord,
    formatPgnMoveText,
} = require("../src/desktop/gameHistoryStore");

describe("gameHistoryStore", function () {
    it("formats move text like standard PGN", function () {
        const text = formatPgnMoveText([
            { moveStr: "e4", turn: "white" },
            { moveStr: "c5", turn: "black" },
            { moveStr: "Nf3", turn: "white" },
            { moveStr: "d6", turn: "black" },
        ]);
        assert.strictEqual(text, "1.e4 c5 2.Nf3 d6");
    });

    it("builds a PGN record with headers and result", function () {
        const pgn = buildPgnRecord({
            whitePlayer: "Player",
            blackPlayer: "Brain 4.2",
            result: "1-0",
            date: "2026.06.27",
            engine: "brain42",
            thinkingTimeSeconds: 10,
            moves: [
                { moveStr: "e4", turn: "white" },
                { moveStr: "e5", turn: "black" },
            ],
            termination: "Checkmate. white won.",
        });

        assert.match(pgn, /\[White "Player"\]/);
        assert.match(pgn, /\[Black "Brain 4\.2"\]/);
        assert.match(pgn, /\[Result "1-0"\]/);
        assert.match(pgn, /\[Engine "brain42"\]/);
        assert.match(pgn, /\[ThinkingTime "10s"\]/);
        assert.match(pgn, /1\.e4 e5 1-0/);
    });
});
