/**
 * Compact binary encoding of a completed move object for the opening book.
 *
 * v2 (encode): `SM` + 0x02, squares + piece + flags + optional capture/EP/promotion + moveStr only.
 * v1 (decode only): legacy layout with whitePlayerView, post-move flags, and extension JSON.
 */

const { encodeBoardCell, decodeBoardCell } = require("./gameStateCompact");

/** ASCII `SM` + version 2 — current move-compact format. */
const MOVE_COMPACT_MAGIC_V2 = Buffer.from([0x53, 0x4d, 0x02]);
const MOVE_COMPACT_HEADER_V2_LENGTH = 13;

function writeUtf8Payload(str) {
    const u = Buffer.from(str, "utf8");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(u.length >>> 0);
    return Buffer.concat([len, u]);
}

function readUtf8Payload(buf, readOffset, label) {
    if (readOffset + 4 > buf.length) {
        throw new Error(`gameMoveCompact: truncated (${label} len)`);
    }
    const payloadByteLength = buf.readUInt32BE(readOffset);
    readOffset += 4;
    if (readOffset + payloadByteLength > buf.length) {
        throw new Error(`gameMoveCompact: truncated (${label} bytes)`);
    }
    const text = buf.toString("utf8", readOffset, readOffset + payloadByteLength);
    return { text, nextOffset: readOffset + payloadByteLength };
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

    const pieceByte = encodePieceByte(move.piece);
    if (pieceByte === 0) {
        throw new Error("gameMoveCompact: moving piece cannot be empty");
    }

    const flags1 = (move.promotion ? 1 : 0)
        | (move.ennPassant ? 2 : 0)
        | (move.castling ? 4 : 0)
        | (move.kingsideCastling ? 8 : 0)
        | (move.turn === "black" ? 16 : 0);

    const flags2 = move.valid !== false ? 1 : 0;

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

    const header = Buffer.from([
        ...MOVE_COMPACT_MAGIC_V2,
        move.source.row & 0xff,
        move.source.col & 0xff,
        move.target.row & 0xff,
        move.target.col & 0xff,
        pieceByte,
        flags1 & 0xff,
        flags2 & 0xff,
        capByte & 0xff,
        hsR,
        hsC,
        sel & 0xff,
    ]);

    return Buffer.concat([header, writeUtf8Payload(String(move.moveStr ?? ""))]);
}

function buildMoveFromParts(source, target, pieceByte, flags1, flags2, capByte, hitSquareRow, hitSquareCol, promotionPieceRaw, moveStr, extras) {
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
    const turn = flags1 & 16 ? "black" : "white";
    const valid = !!(flags2 & 1);

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
        moveStr,
    };
    if (castling) {
        core.kingsideCastling = kingsideCastling;
    }
    if (promotion && promotionPieceRaw !== 0xff) {
        core.selectedPiece = promotionPieceRaw;
    }
    return Object.assign(core, extras || {});
}

function decodeV2Buffer(buf) {
    let readOffset = MOVE_COMPACT_MAGIC_V2.length;
    if (buf.length < readOffset + MOVE_COMPACT_HEADER_V2_LENGTH) {
        throw new Error("gameMoveCompact: truncated v2 header");
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

    const moveStrPart = readUtf8Payload(buf, readOffset, "moveStr");
    readOffset = moveStrPart.nextOffset;

    if (readOffset !== buf.length) {
        throw new Error("gameMoveCompact: trailing bytes");
    }

    return buildMoveFromParts(
        source,
        target,
        pieceByte,
        flags1,
        flags2,
        capByte,
        hitSquareRow,
        hitSquareCol,
        promotionPieceRaw,
        moveStrPart.text,
        null,
    );
}

function decodeV1Buffer(buf) {
    let readOffset = 3;
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

    const moveStrPart = readUtf8Payload(buf, readOffset, "moveStr");
    readOffset = moveStrPart.nextOffset;

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

    const piece = decodeBoardCell(pieceByte);
    const capturedPiece = capByte === 0 ? null : decodeBoardCell(capByte);
    let hitSquare = null;
    if (hitSquareRow !== 0xff || hitSquareCol !== 0xff) {
        hitSquare = { row: hitSquareRow, col: hitSquareCol };
    }

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
        moveStr: moveStrPart.text,
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

/**
 * @param {Buffer} buf
 * @returns {object} move object suitable for {@link ChessGame#validateMove} / book play
 */
function decodeBufferToMoveObject(buf) {
    if (!buf || buf.length < 3) {
        throw new Error("gameMoveCompact: buffer too small");
    }
    if (buf[0] === 0x53 && buf[1] === 0x4d && buf[2] === 0x02) {
        return decodeV2Buffer(buf);
    }
    if (buf[0] === 0x53 && buf[1] === 0x4d && buf[2] === 0x01) {
        return decodeV1Buffer(buf);
    }
    throw new Error("gameMoveCompact: bad magic");
}

module.exports = {
    encodeMoveObjectToBuffer,
    decodeBufferToMoveObject,
};
