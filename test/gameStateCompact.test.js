const assert = require("assert");
const {
    encodeBoardCell,
    decodeBoardCell,
    encodeSavedGameStateStringToBuffer,
    encodeSavedGameStateStringToLookupKey,
    decodeLookupKeyToSavedGameStateString,
} = require("../src/gameStateCompact");

const START_STATE = {
    board: [
        [
            { color: "black", pieceType: 4 },
            { color: "black", pieceType: 2 },
            { color: "black", pieceType: 3 },
            { color: "black", pieceType: 5 },
            { color: "black", pieceType: 1 },
            { color: "black", pieceType: 3 },
            { color: "black", pieceType: 2 },
            { color: "black", pieceType: 4 },
        ],
        Array(8).fill({ color: "black", pieceType: 0 }),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill(null),
        Array(8).fill({ color: "white", pieceType: 0 }),
        [
            { color: "white", pieceType: 4 },
            { color: "white", pieceType: 2 },
            { color: "white", pieceType: 3 },
            { color: "white", pieceType: 5 },
            { color: "white", pieceType: 1 },
            { color: "white", pieceType: 3 },
            { color: "white", pieceType: 2 },
            { color: "white", pieceType: 4 },
        ],
    ],
    turn: "white",
    check: false,
    checkmate: false,
    draw: false,
    whiteKingMoved: false,
    blackKingMoved: false,
    queensideWhiteRookMoved: false,
    queensideBlackRookMoved: false,
    kingsideWhiteRookMoved: false,
    kingsideBlackRookMoved: false,
    promoting: false,
};

describe("gameStateCompact", function () {
    it("encodes and decodes board cells", function () {
        assert.strictEqual(encodeBoardCell(null), 0);
        assert.strictEqual(encodeBoardCell({ color: "white", pieceType: 1 }), 2);
        assert.strictEqual(encodeBoardCell({ color: "black", pieceType: 5 }), 14);

        assert.strictEqual(decodeBoardCell(0), null);
        assert.deepStrictEqual(decodeBoardCell(2), { color: "white", pieceType: 1 });
        assert.deepStrictEqual(decodeBoardCell(14), { color: "black", pieceType: 5 });
    });

    it("round-trips a starting position through v2 compact encoding", function () {
        const stateStr = JSON.stringify(START_STATE);
        const buf = encodeSavedGameStateStringToBuffer(stateStr);

        assert.strictEqual(buf[0], 0x53);
        assert.strictEqual(buf[1], 0x43);
        assert.strictEqual(buf[2], 0x02);
        assert.strictEqual(buf.length, 3 + 64 + 2);

        const key = encodeSavedGameStateStringToLookupKey(stateStr);
        const decodedStr = decodeLookupKeyToSavedGameStateString(key);
        const decoded = JSON.parse(decodedStr);

        assert.strictEqual(decoded.turn, "white");
        assert.strictEqual(decoded.check, false);
        assert.strictEqual(decoded.whiteKingMoved, false);
        assert.strictEqual(decoded.board.length, 8);
        assert.deepStrictEqual(decoded.board[0][0], { color: "black", pieceType: 4 });
        assert.deepStrictEqual(decoded.board[7][4], { color: "white", pieceType: 1 });
    });

    it("preserves check and castling flags in compact encoding", function () {
        const state = {
            ...START_STATE,
            turn: "black",
            check: true,
            whiteKingMoved: true,
            kingsideBlackRookMoved: true,
        };
        const decoded = JSON.parse(
            decodeLookupKeyToSavedGameStateString(
                encodeSavedGameStateStringToLookupKey(JSON.stringify(state)),
            ),
        );

        assert.strictEqual(decoded.turn, "black");
        assert.strictEqual(decoded.check, true);
        assert.strictEqual(decoded.whiteKingMoved, true);
        assert.strictEqual(decoded.kingsideBlackRookMoved, true);
    });

    it("rejects invalid board JSON", function () {
        assert.throws(
            () => encodeSavedGameStateStringToBuffer("{not json"),
            /invalid SavedGameState JSON/,
        );
        assert.throws(
            () => encodeSavedGameStateStringToBuffer(JSON.stringify({ turn: "white" })),
            /missing board array/,
        );
    });
});
