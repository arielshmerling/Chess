/**
 * Compact binary encoding of {@link ChessGame}'s stripped snapshot (same information as {@link ChessGame#SavedGameState}:
 * JSON text after removing capturedPiecesList, lastMove, fiftyMovesCounter).
 *
 * On disk in the opening book, the buffer is stored raw (length-prefixed). In-memory maps use
 * {@link compactStateBufferToLookupKey} (latin1 string, same byte length as the buffer).
 *
 * v1 layout: magic bytes `SC` + 0x01 (State Compact v1), 64 board bytes, 2 flag bytes,
 * 3 length-prefixed UTF-8 strings,
 * UInt32 extension length + optional UTF-8 JSON object (sorted keys) for any other enumerable fields.
 */

/** ASCII `SC` + version 1 — identifies a state-compact buffer (not the opening-book `OBBK` wrapper). */
const STATE_COMPACT_MAGIC = Buffer.from([0x53, 0x43, 0x01]);

/** Keys written in the fixed binary section (not placed in the extension JSON). */
const ENCODED_CORE_KEYS = new Set([
    "board",
    "turn",
    "check",
    "checkmate",
    "draw",
    "drawReason",
    "resigned",
    "outOfTime",
    "whiteKingMoved",
    "blackKingMoved",
    "whitePlayerView",
    "promoting",
    "kingsideWhiteRookMoved",
    "queensideWhiteRookMoved",
    "kingsideBlackRookMoved",
    "queensideBlackRookMoved",
    "farWhiteRookMoved",
    "nearWhiteRookMoved",
    "farBlackRookMoved",
    "nearBlackRookMoved",
]);

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

function writeU32(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n >>> 0);
    return b;
}

function writeUtf8Payload(str) {
    const u = Buffer.from(str, "utf8");
    return Buffer.concat([writeU32(u.length), u]);
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

    const turnBlack = obj.turn === "black";
    const flags1 = (turnBlack ? 1 : 0)
        | (obj.whitePlayerView ? 2 : 0)
        | (obj.check ? 4 : 0)
        | (obj.checkmate ? 8 : 0)
        | (obj.draw ? 16 : 0)
        | (obj.whiteKingMoved ? 32 : 0)
        | (obj.blackKingMoved ? 64 : 0)
        | (obj.promoting ? 128 : 0);

    const flags2 = (obj.kingsideWhiteRookMoved ? 1 : 0)
        | (obj.queensideWhiteRookMoved ? 2 : 0)
        | (obj.kingsideBlackRookMoved ? 4 : 0)
        | (obj.queensideBlackRookMoved ? 8 : 0)
        | (obj.farWhiteRookMoved ? 16 : 0)
        | (obj.nearWhiteRookMoved ? 32 : 0)
        | (obj.farBlackRookMoved ? 64 : 0)
        | (obj.nearBlackRookMoved ? 128 : 0);

    const drawReason = String(obj.drawReason ?? "");
    const resigned = String(obj.resigned ?? "");
    const outOfTime = String(obj.outOfTime ?? "");

    const extras = {};
    for (const k of Object.keys(obj)) {
        if (!ENCODED_CORE_KEYS.has(k)) {
            extras[k] = obj[k];
        }
    }
    let extBuf = Buffer.alloc(0);
    const extraKeys = Object.keys(extras).sort();
    if (extraKeys.length > 0) {
        const sortedExtras = {};
        for (const k of extraKeys) {
            sortedExtras[k] = extras[k];
        }
        extBuf = Buffer.from(JSON.stringify(sortedExtras), "utf8");
    }

    const flagsBuf = Buffer.from([flags1 & 0xff, flags2 & 0xff]);

    return Buffer.concat([
        STATE_COMPACT_MAGIC,
        boardBuf,
        flagsBuf,
        writeUtf8Payload(drawReason),
        writeUtf8Payload(resigned),
        writeUtf8Payload(outOfTime),
        writeU32(extBuf.length),
        extBuf,
    ]);
}

/**
 * @param {Buffer} buf
 * @returns {string} JSON text suitable for {@link ChessGame#loadGame}
 */
function decodeBufferToSavedGameStateString(buf) {
    let readOffset = 0;
    if (!buf || buf.length < 3) {
        throw new Error("gameStateCompact: buffer too small");
    }
    if (buf[readOffset] !== 0x53 || buf[readOffset + 1] !== 0x43 || buf[readOffset + 2] !== 0x01) {
        throw new Error("gameStateCompact: bad magic");
    }
    readOffset += 3;
    if (buf.length < readOffset + 64 + 2) {
        throw new Error("gameStateCompact: truncated header");
    }
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

    function readUtf8Payload(label) {
        if (readOffset + 4 > buf.length) {
            throw new Error(`gameStateCompact: truncated (${label} len)`);
        }
        const payloadByteLength = buf.readUInt32BE(readOffset);
        readOffset += 4;
        if (readOffset + payloadByteLength > buf.length) {
            throw new Error(`gameStateCompact: truncated (${label} bytes)`);
        }
        const text = buf.toString("utf8", readOffset, readOffset + payloadByteLength);
        readOffset += payloadByteLength;
        return text;
    }

    const drawReason = readUtf8Payload("drawReason");
    const resigned = readUtf8Payload("resigned");
    const outOfTime = readUtf8Payload("outOfTime");

    if (readOffset + 4 > buf.length) {
        throw new Error("gameStateCompact: truncated extension length");
    }
    const extensionByteLength = buf.readUInt32BE(readOffset);
    readOffset += 4;
    if (readOffset + extensionByteLength > buf.length) {
        throw new Error("gameStateCompact: truncated extension body");
    }
    let extrasParsed = {};
    if (extensionByteLength > 0) {
        const extensionJson = buf.toString("utf8", readOffset, readOffset + extensionByteLength);
        readOffset += extensionByteLength;
        try {
            extrasParsed = JSON.parse(extensionJson);
        } catch (e) {
            throw new Error(`gameStateCompact: extension JSON invalid: ${e.message}`);
        }
        if (!extrasParsed || typeof extrasParsed !== "object") {
            throw new Error("gameStateCompact: extension must be a JSON object");
        }
    }

    if (readOffset !== buf.length) {
        throw new Error("gameStateCompact: trailing bytes");
    }

    const core = {
        board,
        turn: flags1 & 1 ? "black" : "white",
        check: !!(flags1 & 4),
        checkmate: !!(flags1 & 8),
        draw: !!(flags1 & 16),
        drawReason,
        resigned,
        outOfTime,
        whiteKingMoved: !!(flags1 & 32),
        blackKingMoved: !!(flags1 & 64),
        whitePlayerView: !!(flags1 & 2),
        promoting: !!(flags1 & 128),
        kingsideWhiteRookMoved: !!(flags2 & 1),
        queensideWhiteRookMoved: !!(flags2 & 2),
        kingsideBlackRookMoved: !!(flags2 & 4),
        queensideBlackRookMoved: !!(flags2 & 8),
        farWhiteRookMoved: !!(flags2 & 16),
        nearWhiteRookMoved: !!(flags2 & 32),
        farBlackRookMoved: !!(flags2 & 64),
        nearBlackRookMoved: !!(flags2 & 128),
    };

    return JSON.stringify(Object.assign(core, extrasParsed));
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
    ENCODED_CORE_KEYS,
    encodeBoardCell,
    decodeBoardCell,
    encodeSavedGameStateStringToBuffer,
    compactStateBufferToLookupKey,
    encodeSavedGameStateStringToLookupKey,
    decodeLookupKeyToSavedGameStateString,
    decodeBufferToSavedGameStateString,
};
