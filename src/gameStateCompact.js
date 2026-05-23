/**
 * Compact binary encoding of {@link ChessGame}'s stripped snapshot (same information as {@link ChessGame#SavedGameState}:
 * JSON text after removing capturedPiecesList, lastMove, fiftyMovesCounter).
 *
 * v2 (encode): `SC` + 0x02, 64 board bytes, 2 flag bytes — position + castling + game-result flags only.
 * v1 (decode only): legacy layout with UTF-8 strings and extension JSON.
 *
 * Not stored in the book key: drawReason, resigned, outOfTime, whitePlayerView (decode supplies defaults).
 */

/** ASCII `SC` + version 2 — current state-compact format. */
const STATE_COMPACT_MAGIC_V2 = Buffer.from([0x53, 0x43, 0x02]);
const STATE_COMPACT_MAGIC_V1 = Buffer.from([0x53, 0x43, 0x01]);

const STATE_V2_BODY_LENGTH = 64 + 2;

function encodeBoardCell(cell) {
    if (cell == null) {
        return 0;
    }
    const pt = cell.pieceType;
    const c = cell.color;
    if (c === "white") {
        return 1 + pt;
    }
    if (c === "black") {
        return 9 + pt;
    }
    throw new Error("gameStateCompact: invalid piece color");
}

function decodeBoardCell(byte) {
    if (byte === 0) {
        return null;
    }
    if (byte >= 1 && byte <= 6) {
        return { color: "white", pieceType: byte - 1 };
    }
    if (byte >= 9 && byte <= 14) {
        return { color: "black", pieceType: byte - 9 };
    }
    throw new Error("gameStateCompact: invalid board cell encoding");
}

function readU32Payload(buf, readOffset, label) {
    if (readOffset + 4 > buf.length) {
        throw new Error(`gameStateCompact: truncated (${label} len)`);
    }
    const payloadByteLength = buf.readUInt32BE(readOffset);
    readOffset += 4;
    if (readOffset + payloadByteLength > buf.length) {
        throw new Error(`gameStateCompact: truncated (${label} bytes)`);
    }
    const text = buf.toString("utf8", readOffset, readOffset + payloadByteLength);
    return { text, nextOffset: readOffset + payloadByteLength };
}

function flagsToCoreObject(board, flags1, flags2) {
    return {
        board,
        turn: flags1 & 1 ? "black" : "white",
        check: !!(flags1 & 4),
        checkmate: !!(flags1 & 8),
        draw: !!(flags1 & 16),
        drawReason: "",
        resigned: "",
        outOfTime: "",
        whiteKingMoved: !!(flags1 & 32),
        blackKingMoved: !!(flags1 & 64),
        whitePlayerView: true,
        promoting: !!(flags1 & 128),
        kingsideWhiteRookMoved: !!(flags2 & 1),
        queensideWhiteRookMoved: !!(flags2 & 2),
        kingsideBlackRookMoved: !!(flags2 & 4),
        queensideBlackRookMoved: !!(flags2 & 8),
    };
}

function buildFlagsFromObject(obj) {
    const turnBlack = obj.turn === "black";
    const flags1 = (turnBlack ? 1 : 0)
        | (obj.check ? 4 : 0)
        | (obj.checkmate ? 8 : 0)
        | (obj.draw ? 16 : 0)
        | (obj.whiteKingMoved ? 32 : 0)
        | (obj.blackKingMoved ? 64 : 0)
        | (obj.promoting ? 128 : 0);
    const flags2 = (obj.kingsideWhiteRookMoved ? 1 : 0)
        | (obj.queensideWhiteRookMoved ? 2 : 0)
        | (obj.kingsideBlackRookMoved ? 4 : 0)
        | (obj.queensideBlackRookMoved ? 8 : 0);
    return { flags1: flags1 & 0xff, flags2: flags2 & 0xff };
}

/**
 * @param {string} savedGameStateStr - JSON text from ChessGame.prototype.SavedGameState
 * @returns {Buffer}
 */
function encodeSavedGameStateStringToBuffer(savedGameStateStr) {
    let obj;
    try {
        obj = JSON.parse(savedGameStateStr);
    } catch (e) {
        throw new Error(`gameStateCompact: invalid SavedGameState JSON: ${e.message}`);
    }
    if (!obj || typeof obj !== "object" || !Array.isArray(obj.board)) {
        throw new Error("gameStateCompact: missing board array");
    }
    if (obj.board.length !== 8) {
        throw new Error("gameStateCompact: board must have 8 rows");
    }
    const boardBuf = Buffer.alloc(64);
    let bi = 0;
    for (let r = 0; r < 8; r++) {
        const row = obj.board[r];
        if (!Array.isArray(row) || row.length !== 8) {
            throw new Error(`gameStateCompact: invalid board row ${r}`);
        }
        for (let c = 0; c < 8; c++) {
            boardBuf[bi++] = encodeBoardCell(row[c]);
        }
    }
    const { flags1, flags2 } = buildFlagsFromObject(obj);
    return Buffer.concat([
        STATE_COMPACT_MAGIC_V2,
        boardBuf,
        Buffer.from([flags1, flags2]),
    ]);
}

function decodeV1Buffer(buf) {
    let readOffset = 3;
    const board = [];
    for (let rowIndex = 0; rowIndex < 8; rowIndex++) {
        const row = [];
        for (let colIndex = 0; colIndex < 8; colIndex++) {
            row.push(decodeBoardCell(buf[readOffset++]));
        }
        board.push(row);
    }
    const flags1 = buf[readOffset++];
    const flags2 = buf[readOffset++];

    const drawReason = readU32Payload(buf, readOffset, "drawReason");
    readOffset = drawReason.nextOffset;
    const resigned = readU32Payload(buf, readOffset, "resigned");
    readOffset = resigned.nextOffset;
    const outOfTime = readU32Payload(buf, readOffset, "outOfTime");
    readOffset = outOfTime.nextOffset;

    if (readOffset + 4 > buf.length) {
        throw new Error("gameStateCompact: truncated extension length");
    }
    const extensionByteLength = buf.readUInt32BE(readOffset);
    readOffset += 4;
    if (readOffset + extensionByteLength > buf.length) {
        throw new Error("gameStateCompact: truncated extension body");
    }
    readOffset += extensionByteLength;

    if (readOffset !== buf.length) {
        throw new Error("gameStateCompact: trailing bytes");
    }

    const core = flagsToCoreObject(board, flags1, flags2);
    core.drawReason = drawReason.text;
    core.resigned = resigned.text;
    core.outOfTime = outOfTime.text;
    core.whitePlayerView = !!(flags1 & 2);
    return JSON.stringify(core);
}

function decodeV2Buffer(buf) {
    if (buf.length !== STATE_COMPACT_MAGIC_V2.length + STATE_V2_BODY_LENGTH) {
        throw new Error("gameStateCompact: v2 buffer wrong size");
    }
    let readOffset = STATE_COMPACT_MAGIC_V2.length;
    const board = [];
    for (let rowIndex = 0; rowIndex < 8; rowIndex++) {
        const row = [];
        for (let colIndex = 0; colIndex < 8; colIndex++) {
            row.push(decodeBoardCell(buf[readOffset++]));
        }
        board.push(row);
    }
    const flags1 = buf[readOffset++];
    const flags2 = buf[readOffset++];
    return JSON.stringify(flagsToCoreObject(board, flags1, flags2));
}

/**
 * @param {Buffer} buf
 * @returns {string} JSON text suitable for {@link ChessGame#loadGame}
 */
function decodeBufferToSavedGameStateString(buf) {
    if (!buf || buf.length < 3) {
        throw new Error("gameStateCompact: buffer too small");
    }
    if (buf[0] === 0x53 && buf[1] === 0x43 && buf[2] === 0x02) {
        return decodeV2Buffer(buf);
    }
    if (buf[0] === 0x53 && buf[1] === 0x43 && buf[2] === 0x01) {
        return decodeV1Buffer(buf);
    }
    throw new Error("gameStateCompact: bad magic");
}

/**
 * Lossless map key for a compact state buffer (one char per byte; not base64).
 * @param {Buffer} buf
 * @returns {string}
 */
function compactStateBufferToLookupKey(buf) {
    return Buffer.from(buf).toString("latin1");
}

/**
 * @param {string} savedGameStateStr
 * @returns {string} {@link compactStateBufferToLookupKey} of the encoded buffer
 */
function encodeSavedGameStateStringToLookupKey(savedGameStateStr) {
    return compactStateBufferToLookupKey(encodeSavedGameStateStringToBuffer(savedGameStateStr));
}

/**
 * @param {string} key from {@link compactStateBufferToLookupKey}
 * @returns {Buffer}
 */
function lookupKeyToCompactStateBuffer(key) {
    return Buffer.from(String(key), "latin1");
}

/**
 * @param {string} key from {@link compactStateBufferToLookupKey}
 * @returns {string} SavedGameState-compatible JSON text
 */
function decodeLookupKeyToSavedGameStateString(key) {
    return decodeBufferToSavedGameStateString(lookupKeyToCompactStateBuffer(key));
}

module.exports = {
    encodeBoardCell,
    decodeBoardCell,
    encodeSavedGameStateStringToBuffer,
    compactStateBufferToLookupKey,
    encodeSavedGameStateStringToLookupKey,
    decodeLookupKeyToSavedGameStateString,
    decodeBufferToSavedGameStateString,
};
