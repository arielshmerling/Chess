/**
 * Convert ChessGame board state ↔ FEN / UCI without modifying ChessGame.js.
 *
 * Orientation:
 * - whitePlayerView true:  row 0 = rank 8, col 0 = a-file
 * - whitePlayerView false: board is 180° flipped (row 0 = rank 1, col 0 = h-file)
 */

"use strict";

const PIECE_TYPE = {
    PAWN: 0,
    KING: 1,
    KNIGHT: 2,
    BISHOP: 3,
    ROOK: 4,
    QUEEN: 5,
};

const FEN_LETTER_BY_TYPE = {
    [PIECE_TYPE.PAWN]: "p",
    [PIECE_TYPE.KNIGHT]: "n",
    [PIECE_TYPE.BISHOP]: "b",
    [PIECE_TYPE.ROOK]: "r",
    [PIECE_TYPE.QUEEN]: "q",
    [PIECE_TYPE.KING]: "k",
};

const TYPE_BY_FEN_LETTER = {
    p: PIECE_TYPE.PAWN,
    n: PIECE_TYPE.KNIGHT,
    b: PIECE_TYPE.BISHOP,
    r: PIECE_TYPE.ROOK,
    q: PIECE_TYPE.QUEEN,
    k: PIECE_TYPE.KING,
};

const PROMOTION_LETTER_BY_TYPE = {
    [PIECE_TYPE.QUEEN]: "q",
    [PIECE_TYPE.ROOK]: "r",
    [PIECE_TYPE.BISHOP]: "b",
    [PIECE_TYPE.KNIGHT]: "n",
};

const TYPE_BY_PROMOTION_LETTER = {
    q: PIECE_TYPE.QUEEN,
    r: PIECE_TYPE.ROOK,
    b: PIECE_TYPE.BISHOP,
    n: PIECE_TYPE.KNIGHT,
};

function isWhitePlayerView(state) {
    return !(state && state.whitePlayerView === false);
}

/**
 * @param {object} state - ChessGameState-like
 * @param {{ row: number, col: number }} square
 * @returns {string} e.g. "e2"
 */
function squareToAlgebraic(state, square) {
    if (!square || !Number.isFinite(square.row) || !Number.isFinite(square.col)) {
        throw new Error("Invalid square");
    }
    let fileIndex;
    let rank;
    if (isWhitePlayerView(state)) {
        fileIndex = square.col;
        rank = 8 - square.row;
    } else {
        fileIndex = 7 - square.col;
        rank = square.row + 1;
    }
    if (fileIndex < 0 || fileIndex > 7 || rank < 1 || rank > 8) {
        throw new Error("Square out of range");
    }
    return String.fromCharCode("a".charCodeAt(0) + fileIndex) + String(rank);
}

/**
 * @param {object} state
 * @param {string} algebraic - e.g. "e2"
 * @returns {{ row: number, col: number }}
 */
function algebraicToSquare(state, algebraic) {
    const m = /^([a-h])([1-8])$/i.exec(String(algebraic || "").trim());
    if (!m) {
        throw new Error(`Invalid algebraic square: ${algebraic}`);
    }
    const fileIndex = m[1].toLowerCase().charCodeAt(0) - "a".charCodeAt(0);
    const rank = Number(m[2]);
    if (isWhitePlayerView(state)) {
        return { row: 8 - rank, col: fileIndex };
    }
    return { row: rank - 1, col: 7 - fileIndex };
}

function pieceToFenChar(piece) {
    if (!piece) {
        return null;
    }
    const letter = FEN_LETTER_BY_TYPE[piece.pieceType];
    if (!letter) {
        return null;
    }
    return piece.color === "white" ? letter.toUpperCase() : letter;
}

function castlingFen(state) {
    let rights = "";
    if (!state.whiteKingMoved && !state.kingsideWhiteRookMoved) {
        rights += "K";
    }
    if (!state.whiteKingMoved && !state.queensideWhiteRookMoved) {
        rights += "Q";
    }
    if (!state.blackKingMoved && !state.kingsideBlackRookMoved) {
        rights += "k";
    }
    if (!state.blackKingMoved && !state.queensideBlackRookMoved) {
        rights += "q";
    }
    return rights || "-";
}

function enPassantFen(state) {
    const last = state && state.lastMove;
    if (
        !last
        || !last.piece
        || last.piece.pieceType !== PIECE_TYPE.PAWN
        || !last.source
        || !last.target
        || Math.abs(last.source.row - last.target.row) !== 2
    ) {
        return "-";
    }
    const mid = {
        row: (last.source.row + last.target.row) / 2,
        col: last.target.col,
    };
    return squareToAlgebraic(state, mid);
}

/**
 * @param {object} state - ChessGame.GameState
 * @param {{ fullmoveNumber?: number }} [options]
 * @returns {string}
 */
function gameStateToFen(state, options) {
    if (!state || !Array.isArray(state.board)) {
        throw new Error("Missing board state");
    }
    const ranks = [];
    for (let fenRank = 8; fenRank >= 1; fenRank -= 1) {
        let empty = 0;
        let rowStr = "";
        for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
            const square = isWhitePlayerView(state)
                ? { row: 8 - fenRank, col: fileIndex }
                : { row: fenRank - 1, col: 7 - fileIndex };
            const piece = state.board[square.row] && state.board[square.row][square.col];
            const ch = pieceToFenChar(piece);
            if (!ch) {
                empty += 1;
            } else {
                if (empty > 0) {
                    rowStr += String(empty);
                    empty = 0;
                }
                rowStr += ch;
            }
        }
        if (empty > 0) {
            rowStr += String(empty);
        }
        ranks.push(rowStr);
    }

    const turn = state.turn === "black" ? "b" : "w";
    const halfmove =
        Number.isFinite(state.fiftyMovesCounter) && state.fiftyMovesCounter >= 0
            ? Math.floor(state.fiftyMovesCounter)
            : 0;
    const fullmove =
        options && Number.isFinite(options.fullmoveNumber) && options.fullmoveNumber >= 1
            ? Math.floor(options.fullmoveNumber)
            : 1;

    return [
        ranks.join("/"),
        turn,
        castlingFen(state),
        enPassantFen(state),
        String(halfmove),
        String(fullmove),
    ].join(" ");
}

/**
 * @param {object} state
 * @param {{ source: object, target: object, selectedPiece?: number|null }} move
 * @returns {string} UCI like "e2e4" or "e7e8q"
 */
function moveToUci(state, move) {
    if (!move || !move.source || !move.target) {
        throw new Error("Invalid move");
    }
    let uci =
        squareToAlgebraic(state, move.source) + squareToAlgebraic(state, move.target);
    if (move.selectedPiece != null && PROMOTION_LETTER_BY_TYPE[move.selectedPiece]) {
        uci += PROMOTION_LETTER_BY_TYPE[move.selectedPiece];
    }
    return uci;
}

/**
 * @param {object} state
 * @param {string} uciMove - "e2e4" or "a7a8q"
 * @returns {{ source: object, target: object, selectedPiece: number|null }}
 */
function uciToMove(state, uciMove) {
    const raw = String(uciMove || "").trim().toLowerCase();
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(raw);
    if (!m) {
        throw new Error(`Invalid UCI move: ${uciMove}`);
    }
    const source = algebraicToSquare(state, m[1]);
    const target = algebraicToSquare(state, m[2]);
    const selectedPiece = m[3] ? TYPE_BY_PROMOTION_LETTER[m[3]] : null;
    return { source, target, selectedPiece };
}

module.exports = {
    PIECE_TYPE,
    TYPE_BY_FEN_LETTER,
    gameStateToFen,
    squareToAlgebraic,
    algebraicToSquare,
    moveToUci,
    uciToMove,
    isWhitePlayerView,
};
