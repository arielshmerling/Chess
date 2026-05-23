/**
 * Compact JSON opening book: state = 64 board ints + 10 flag ints; move = source + target only.
 *
 * Board cell encoding (same as {@link gameStateCompact}):
 * 0 empty, 1–6 white pawn..king, 9–14 black pawn..king.
 *
 * Flags (0 or 1): isWhiteTurn, check, checkmate, draw, whiteKingMoved, blackKingMoved,
 * queensideWhiteRookMoved, queensideBlackRookMoved, kingsideWhiteRookMoved, kingsideBlackRookMoved.
 */

const { encodeBoardCell } = require("./gameStateCompact");

const COMPACT_STATE_LENGTH = 74;
const BOARD_CELLS = 64;
const FLAG_COUNT = 10;

/**
 * @param {string} savedGameStateStr - {@link ChessGame#SavedGameState} JSON text
 * @returns {number[]}
 */
function savedGameStateToCompactArray(savedGameStateStr) {
    let obj;
    try {
        obj = JSON.parse(savedGameStateStr);
    } catch (e) {
        throw new Error(`openingBookJson: invalid SavedGameState JSON: ${e.message}`);
    }
    if (!obj || typeof obj !== "object" || !Array.isArray(obj.board) || obj.board.length !== 8) {
        throw new Error("openingBookJson: missing 8×8 board");
    }
    const out = [];
    for (let r = 0; r < 8; r++) {
        const row = obj.board[r];
        if (!Array.isArray(row) || row.length !== 8) {
            throw new Error(`openingBookJson: invalid board row ${r}`);
        }
        for (let c = 0; c < 8; c++) {
            out.push(encodeBoardCell(row[c]));
        }
    }
    out.push(
        obj.turn === "white" ? 1 : 0,
        obj.check ? 1 : 0,
        obj.checkmate ? 1 : 0,
        obj.draw ? 1 : 0,
        obj.whiteKingMoved ? 1 : 0,
        obj.blackKingMoved ? 1 : 0,
        obj.queensideWhiteRookMoved ? 1 : 0,
        obj.queensideBlackRookMoved ? 1 : 0,
        obj.kingsideWhiteRookMoved ? 1 : 0,
        obj.kingsideBlackRookMoved ? 1 : 0,
    );
    if (out.length !== COMPACT_STATE_LENGTH) {
        throw new Error("openingBookJson: compact state wrong length");
    }
    return out;
}

/**
 * @param {number[]} compactState
 * @returns {string} stable map lookup key
 */
function compactArrayToLookupKey(compactState) {
    return JSON.stringify(compactState);
}

/**
 * @param {string} savedGameStateStr
 * @returns {string}
 */
function savedGameStateToLookupKey(savedGameStateStr) {
    return compactArrayToLookupKey(savedGameStateToCompactArray(savedGameStateStr));
}

/**
 * @param {object} move - completed move from ChessGame
 * @returns {{ source: { row: number, col: number }, target: { row: number, col: number }, pgn?: string }}
 */
function moveToBookMove(move) {
    if (!move || !move.source || !move.target) {
        throw new Error("openingBookJson: move missing source or target");
    }
    const out = {
        source: { row: move.source.row, col: move.source.col },
        target: { row: move.target.row, col: move.target.col },
    };
    if (typeof move.moveStr === "string" && move.moveStr) {
        out.pgn = move.moveStr;
    }
    return out;
}

/**
 * @param {unknown} moveField
 * @returns {{ source: { row: number, col: number }, target: { row: number, col: number }, pgn?: string }|null}
 */
function parseBookMove(moveField) {
    let move = moveField;
    if (typeof moveField === "string") {
        try {
            move = JSON.parse(moveField);
        } catch {
            return null;
        }
    }
    if (!move || typeof move !== "object" || !move.source || !move.target) {
        return null;
    }
    if (
        typeof move.source.row !== "number"
        || typeof move.source.col !== "number"
        || typeof move.target.row !== "number"
        || typeof move.target.col !== "number"
    ) {
        return null;
    }
    const out = {
        source: { row: move.source.row, col: move.source.col },
        target: { row: move.target.row, col: move.target.col },
    };
    if (typeof move.pgn === "string" && move.pgn) {
        out.pgn = move.pgn;
    }
    return out;
}

/**
 * @param {unknown} stateField - compact int array or legacy SavedGameState string/object
 * @returns {string|null} lookup key
 */
function openingBookStateToLookupKey(stateField) {
    if (Array.isArray(stateField) && stateField.length === COMPACT_STATE_LENGTH) {
        return compactArrayToLookupKey(stateField);
    }
    if (typeof stateField === "string" && stateField) {
        try {
            const parsed = JSON.parse(stateField);
            if (Array.isArray(parsed) && parsed.length === COMPACT_STATE_LENGTH) {
                return compactArrayToLookupKey(parsed);
            }
            if (parsed && Array.isArray(parsed.board)) {
                return savedGameStateToLookupKey(stateField);
            }
        } catch {
            // not JSON
        }
        return stateField;
    }
    if (stateField && typeof stateField === "object" && Array.isArray(stateField.board)) {
        return savedGameStateToLookupKey(JSON.stringify(stateField));
    }
    return null;
}

module.exports = {
    COMPACT_STATE_LENGTH,
    BOARD_CELLS,
    FLAG_COUNT,
    savedGameStateToCompactArray,
    compactArrayToLookupKey,
    savedGameStateToLookupKey,
    moveToBookMove,
    parseBookMove,
    openingBookStateToLookupKey,
};
