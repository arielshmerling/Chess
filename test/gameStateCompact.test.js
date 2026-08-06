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

    it("rejects invalid cell color and encoding bytes", function () {
        assert.throws(() => encodeBoardCell({ color: "green", pieceType: 1 }), /invalid piece color/);
        assert.throws(() => decodeBoardCell(7), /invalid board cell/);
        assert.throws(() => decodeBoardCell(15), /invalid board cell/);
    });

    it("rejects bad magic and truncated buffers", function () {
        const {
            decodeBufferToSavedGameStateString,
        } = require("../src/gameStateCompact");
        assert.throws(() => decodeBufferToSavedGameStateString(Buffer.from([1, 2])), /too small/);
        assert.throws(() => decodeBufferToSavedGameStateString(Buffer.from([0, 0, 0])), /bad magic/);
        assert.throws(
            () => encodeSavedGameStateStringToBuffer(JSON.stringify({ board: [[]] })),
            /board must have 8 rows/,
        );
    });

    it("decodes legacy v1 compact buffers", function () {
        const {
            encodeBoardCell,
            decodeBufferToSavedGameStateString,
        } = require("../src/gameStateCompact");
        const parts = [Buffer.from([0x53, 0x43, 0x01])];
        const boardBuf = Buffer.alloc(64);
        for (let i = 0; i < 64; i++) {
            boardBuf[i] = 0;
        }
        boardBuf[4] = encodeBoardCell({ color: "black", pieceType: 1 });
        boardBuf[60] = encodeBoardCell({ color: "white", pieceType: 1 });
        parts.push(boardBuf);
        parts.push(Buffer.from([0x03, 0x05])); /* turn black + whitePlayerView; some castling */
        function u32str(s) {
            const b = Buffer.from(s, "utf8");
            const len = Buffer.alloc(4);
            len.writeUInt32BE(b.length);
            return Buffer.concat([len, b]);
        }
        parts.push(u32str("stalemate"));
        parts.push(u32str(""));
        parts.push(u32str(""));
        const extLen = Buffer.alloc(4);
        extLen.writeUInt32BE(0);
        parts.push(extLen);
        const buf = Buffer.concat(parts);
        const decoded = JSON.parse(decodeBufferToSavedGameStateString(buf));
        assert.strictEqual(decoded.turn, "black");
        assert.strictEqual(decoded.drawReason, "stalemate");
        assert.strictEqual(decoded.whitePlayerView, true);
        assert.deepStrictEqual(decoded.board[0][4], { color: "black", pieceType: 1 });
    });
});
