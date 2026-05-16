/**
 * Compact binary encoding of a completed move object (same shape as JSON passed to / from the opening book:
 * {@link ChessGame#makeMove} return value, optionally after {@link ChessGame#completePromotion}).
 *
 * On disk in the opening book: raw length-prefixed buffer. Magic bytes `SM` + 0x01 (move compact v1).
 */

const { encodeBoardCell, decodeBoardCell } = require("./gameStateCompact");

/** ASCII `SM` + version 1 — identifies a move-compact buffer. */
const MOVE_COMPACT_MAGIC = Buffer.from([0x53, 0x4d, 0x01]);

const MOVE_CORE_KEYS = new Set([
    "valid",
    "source",
    "target",
    "piece",
    "promotion",
    "ennPassant",
    "capturedPiece",
    "hitSquare",
    "turn",
    "castling",
    "whitePlayerView",
    "kingsideCastling",
    "moveStr",
    "check",
    "checkmate",
    "draw",
    "selectedPiece",
]);

function writeU32(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n >>> 0);
    return b;
}

function writeUtf8Payload(str) {
    const u = Buffer.from(str, "utf8");
    return Buffer.concat([writeU32(u.length), u]);
}

function encodePieceByte(p) {
    if (p == null) {
        return 0;
    }
    return encodeBoardCell(p);
}

/**
 * @param {object} move - plain move object (not a ChessGame internal class)
 * @returns {Buffer}
 */
function encodeMoveObjectToBuffer(move) {
    if (!move || typeof move !== "object") {
        throw new Error("gameMoveCompact: move must be an object");
    }
    if (!move.source || typeof move.source.row !== "number" || typeof move.source.col !== "number") {
        throw new Error("gameMoveCompact: invalid source");
    }
    if (!move.target || typeof move.target.row !== "number" || typeof move.target.col !== "number") {
        throw new Error("gameMoveCompact: invalid target");
    }
    if (!move.piece || typeof move.piece !== "object") {
        throw new Error("gameMoveCompact: missing piece");
    }

    const srcR = move.source.row & 0xff;
    const srcC = move.source.col & 0xff;
    const tgtR = move.target.row & 0xff;
    const tgtC = move.target.col & 0xff;
    const pieceByte = encodePieceByte(move.piece);
    if (pieceByte === 0) {
        throw new Error("gameMoveCompact: moving piece cannot be empty");
    }

    const flags1 = (move.promotion ? 1 : 0)
        | (move.ennPassant ? 2 : 0)
        | (move.castling ? 4 : 0)
        | (move.kingsideCastling ? 8 : 0)
        | (move.whitePlayerView ? 16 : 0)
        | (move.turn === "black" ? 32 : 0)
        | (move.check ? 64 : 0)
        | (move.checkmate ? 128 : 0);

    const flags2 = (move.draw ? 1 : 0)
        | (move.valid !== false ? 2 : 0);

    const capByte = encodePieceByte(move.capturedPiece);
    let hsR = 0xff;
    let hsC = 0xff;
    if (move.hitSquare && typeof move.hitSquare.row === "number" && typeof move.hitSquare.col === "number") {
        hsR = move.hitSquare.row & 0xff;
        hsC = move.hitSquare.col & 0xff;
    }

    let sel = 0xff;
    if (move.promotion && move.selectedPiece != null && typeof move.selectedPiece === "number") {
        sel = move.selectedPiece & 0xff;
    }

    const moveStr = String(move.moveStr ?? "");

    const extras = {};
    for (const k of Object.keys(move)) {
        if (!MOVE_CORE_KEYS.has(k)) {
            extras[k] = move[k];
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

    const header = Buffer.from([
        ...MOVE_COMPACT_MAGIC,
        srcR,
        srcC,
        tgtR,
        tgtC,
        pieceByte,
        flags1 & 0xff,
        flags2 & 0xff,
        capByte & 0xff,
        hsR,
        hsC,
        sel & 0xff,
    ]);

    return Buffer.concat([
        header,
        writeUtf8Payload(moveStr),
        writeU32(extBuf.length),
        extBuf,
    ]);
}

/**
 * @param {Buffer} buf
 * @returns {object} move object suitable for {@link ChessGame#validateMove} / book play
 */
function decodeBufferToMoveObject(buf) {
    let readOffset = 0;
    if (!buf || buf.length < 3) {
        throw new Error("gameMoveCompact: buffer too small");
    }
    if (buf[readOffset] !== 0x53 || buf[readOffset + 1] !== 0x4d || buf[readOffset + 2] !== 0x01) {
        throw new Error("gameMoveCompact: bad magic");
    }
    readOffset += 3;
    if (buf.length < readOffset + 13) {
        throw new Error("gameMoveCompact: truncated header");
    }
    const source = { row: buf[readOffset++], col: buf[readOffset++] };
    const target = { row: buf[readOffset++], col: buf[readOffset++] };
    const pieceByte = buf[readOffset++];
    const flags1 = buf[readOffset++];
    const flags2 = buf[readOffset++];
    const capByte = buf[readOffset++];
    const hitSquareRow = buf[readOffset++];
    const hitSquareCol = buf[readOffset++];
    const promotionPieceRaw = buf[readOffset++];

    function readUtf8Payload(label) {
        if (readOffset + 4 > buf.length) {
            throw new Error(`gameMoveCompact: truncated (${label} len)`);
        }
        const payloadByteLength = buf.readUInt32BE(readOffset);
        readOffset += 4;
        if (readOffset + payloadByteLength > buf.length) {
            throw new Error(`gameMoveCompact: truncated (${label} bytes)`);
        }
        const text = buf.toString("utf8", readOffset, readOffset + payloadByteLength);
        readOffset += payloadByteLength;
        return text;
    }

    const moveStr = readUtf8Payload("moveStr");

    if (readOffset + 4 > buf.length) {
        throw new Error("gameMoveCompact: truncated extension length");
    }
    const extensionByteLength = buf.readUInt32BE(readOffset);
    readOffset += 4;
    if (readOffset + extensionByteLength > buf.length) {
        throw new Error("gameMoveCompact: truncated extension body");
    }
    let extrasParsed = {};
    if (extensionByteLength > 0) {
        const extensionJson = buf.toString("utf8", readOffset, readOffset + extensionByteLength);
        readOffset += extensionByteLength;
        try {
            extrasParsed = JSON.parse(extensionJson);
        } catch (e) {
            throw new Error(`gameMoveCompact: extension JSON invalid: ${e.message}`);
        }
        if (!extrasParsed || typeof extrasParsed !== "object") {
            throw new Error("gameMoveCompact: extension must be a JSON object");
        }
    }

    if (readOffset !== buf.length) {
        throw new Error("gameMoveCompact: trailing bytes");
    }

    const piece = decodeBoardCell(pieceByte);
    const capturedPiece = capByte === 0 ? null : decodeBoardCell(capByte);
    let hitSquare = null;
    if (hitSquareRow !== 0xff || hitSquareCol !== 0xff) {
        hitSquare = { row: hitSquareRow, col: hitSquareCol };
    }

    const promotion = !!(flags1 & 1);
    const ennPassant = !!(flags1 & 2);
    const castling = !!(flags1 & 4);
    const kingsideCastling = !!(flags1 & 8);
    const whitePlayerView = !!(flags1 & 16);
    const turn = flags1 & 32 ? "black" : "white";
    const check = !!(flags1 & 64);
    const checkmate = !!(flags1 & 128);
    const draw = !!(flags2 & 1);
    const valid = !!(flags2 & 2);

    const core = {
        valid,
        source,
        target,
        piece,
        promotion,
        ennPassant,
        capturedPiece,
        hitSquare,
        turn,
        castling,
        whitePlayerView,
        moveStr,
        check,
        checkmate,
        draw,
    };
    if (castling) {
        core.kingsideCastling = kingsideCastling;
    }
    if (promotion && promotionPieceRaw !== 0xff) {
        core.selectedPiece = promotionPieceRaw;
    }

    return Object.assign(core, extrasParsed);
}

module.exports = {
    MOVE_CORE_KEYS,
    encodeMoveObjectToBuffer,
    decodeBufferToMoveObject,
};
