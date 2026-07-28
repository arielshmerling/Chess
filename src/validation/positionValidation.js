/**
 * Shared position validation messages (research / position setup / bookmarks).
 * Used by desktop-position-validation.js and chessboard.js.
 */
(function (global) {
    "use strict";

    const t =
        typeof module === "object" && module && module.exports
            ? require("../strings/t-bridge").t
            : typeof global.ShmerlingT === "function"
              ? global.ShmerlingT
              : function (key) {
                    return key;
                };

    function headerForPurpose(purpose) {
        if (purpose === "save") {
            return t("validation.position.headerSave");
        }
        if (purpose === "play") {
            return t("validation.position.headerPlay");
        }
        if (purpose === "saveBookmark") {
            return t("validation.position.headerSaveBookmark");
        }
        if (purpose === "addBookmark") {
            return t("validation.position.headerAddBookmark");
        }
        return t("validation.position.headerUse");
    }

    function colorLabel(color) {
        return color === "white" ? t("common.white") : t("common.black");
    }

    /**
     * @param {object} chessGame
     * @param {"save"|"play"|"add"|"saveBookmark"|"addBookmark"|string} [purpose]
     * @returns {string|null}
     */
    function getMessage(chessGame, purpose) {
        const header = headerForPurpose(purpose);
        const g = chessGame;
        if (!g || !g.GameState) {
            return header + t("validation.position.boardUnreadable");
        }

        let board;
        try {
            const snap = JSON.parse(JSON.stringify(g.GameState));
            board = snap && snap.board;
        } catch {
            board = g.GameState.board;
        }
        if (!board || !Array.isArray(board)) {
            return header + t("validation.position.boardUnreadable");
        }

        const rows = typeof g.BOARD_ROWS === "number" ? g.BOARD_ROWS : 8;
        const cols = typeof g.BOARD_COLUMNS === "number" ? g.BOARD_COLUMNS : 8;

        const PT_PAWN = 0;
        const PT_KING = 1;
        const PT_KNIGHT = 2;
        const PT_BISHOP = 3;
        const PT_ROOK = 4;
        const PT_QUEEN = 5;

        function normalizeBookmarkPieceColor(raw) {
            if (raw == null) {
                return null;
            }
            const s = String(raw).trim().toLowerCase();
            if (s === "white") {
                return "white";
            }
            if (s === "black") {
                return "black";
            }
            return null;
        }

        function cellPieceType(cell) {
            let pt = cell.pieceType;
            if (pt === undefined || pt === null) {
                pt = cell.PieceType;
            }
            const n = Number(pt);
            return Number.isFinite(n) ? n : NaN;
        }

        const fresh = function () {
            return { pawn: 0, rook: 0, knight: 0, bishop: 0, queen: 0, king: 0 };
        };
        const byColor = { white: fresh(), black: fresh() };
        let whiteKingPos = null;
        let blackKingPos = null;
        let whiteBishopSquare = null;
        let blackBishopSquare = null;

        for (let r = 0; r < rows; r++) {
            const row = board[r];
            if (!row || !Array.isArray(row)) {
                continue;
            }
            const rowLen = Math.min(cols, row.length);
            for (let c = 0; c < rowLen; c++) {
                const cell = row[c];
                if (!cell || typeof cell !== "object") {
                    continue;
                }
                const col = normalizeBookmarkPieceColor(cell.color);
                if (!col) {
                    continue;
                }
                const pieceType = cellPieceType(cell);
                if (!Number.isFinite(pieceType)) {
                    continue;
                }
                const bucket = byColor[col];
                if (pieceType === PT_PAWN) {
                    bucket.pawn++;
                } else if (pieceType === PT_ROOK) {
                    bucket.rook++;
                } else if (pieceType === PT_KNIGHT) {
                    bucket.knight++;
                } else if (pieceType === PT_BISHOP) {
                    bucket.bishop++;
                    if (col === "white") {
                        whiteBishopSquare = { row: r, col: c };
                    } else {
                        blackBishopSquare = { row: r, col: c };
                    }
                } else if (pieceType === PT_QUEEN) {
                    bucket.queen++;
                } else if (pieceType === PT_KING) {
                    bucket.king++;
                    if (col === "white") {
                        whiteKingPos = { row: r, col: c };
                    } else {
                        blackKingPos = { row: r, col: c };
                    }
                }
            }
        }

        const wk = byColor.white.king;
        if (wk !== 1) {
            if (wk === 0) {
                return header + t("validation.position.whiteKingNone");
            }
            return header + t("validation.position.whiteKingCount", { count: wk });
        }
        const bk = byColor.black.king;
        if (bk !== 1) {
            if (bk === 0) {
                return header + t("validation.position.blackKingNone");
            }
            return header + t("validation.position.blackKingCount", { count: bk });
        }

        if (whiteKingPos && blackKingPos) {
            const dr = Math.abs(whiteKingPos.row - blackKingPos.row);
            const dc = Math.abs(whiteKingPos.col - blackKingPos.col);
            if (dr <= 1 && dc <= 1) {
                return header + t("validation.position.kingsAdjacent");
            }
        }

        const sideToMove =
            normalizeBookmarkPieceColor((g.GameState && g.GameState.turn) || g.Turn || "white") ||
            "white";
        const whitePlayerView =
            typeof g.WhitePlayerView === "boolean"
                ? g.WhitePlayerView
                : !!(g.GameState && g.GameState.whitePlayerView);
        const opponent = sideToMove === "white" ? "black" : "white";
        const opponentKingPos = opponent === "white" ? whiteKingPos : blackKingPos;
        if (
            opponentKingPos &&
            isSquareUnderAttack(board, opponentKingPos, sideToMove, whitePlayerView, rows, cols)
        ) {
            return (
                header +
                t("validation.position.sideInCheck", {
                    mover: colorLabel(sideToMove),
                    king: colorLabel(opponent),
                })
            );
        }

        const W = byColor.white;
        const B = byColor.black;
        const nonKingWhite = W.pawn + W.rook + W.knight + W.bishop + W.queen;
        const nonKingBlack = B.pawn + B.rook + B.knight + B.bishop + B.queen;
        const totalPieces = 2 + nonKingWhite + nonKingBlack;
        const minorsTotal = W.bishop + W.knight + B.bishop + B.knight;
        const heavyOrPawnTotal = W.pawn + W.rook + W.queen + B.pawn + B.rook + B.queen;

        if (nonKingWhite === 0 && nonKingBlack === 0) {
            return header + t("validation.position.drawInsufficientKings");
        }
        if (totalPieces === 3 && heavyOrPawnTotal === 0 && minorsTotal === 1) {
            return header + t("validation.position.drawInsufficientMinor");
        }
        if (
            totalPieces === 4 &&
            W.bishop === 1 &&
            B.bishop === 1 &&
            W.knight + W.queen + W.rook + W.pawn === 0 &&
            B.knight + B.queen + B.rook + B.pawn === 0
        ) {
            if (whiteBishopSquare && blackBishopSquare) {
                const wSum = whiteBishopSquare.row + whiteBishopSquare.col;
                const bSum = blackBishopSquare.row + blackBishopSquare.col;
                if (wSum % 2 === bSum % 2) {
                    return header + t("validation.position.drawBishopsSameColor");
                }
            }
        }

        const pieceLimits = [
            ["queen", 9, "tooManyQueens"],
            ["rook", 10, "tooManyRooks"],
            ["bishop", 10, "tooManyBishops"],
            ["knight", 10, "tooManyKnights"],
            ["pawn", 8, "tooManyPawns"],
        ];
        for (let i = 0; i < pieceLimits.length; i++) {
            const piece = pieceLimits[i][0];
            const max = pieceLimits[i][1];
            const key = pieceLimits[i][2];
            if (byColor.white[piece] > max) {
                return header +
                    t("validation.position." + key, {
                        color: colorLabel("white"),
                        count: byColor.white[piece],
                    });
            }
            if (byColor.black[piece] > max) {
                return header +
                    t("validation.position." + key, {
                        color: colorLabel("black"),
                        count: byColor.black[piece],
                    });
            }
        }

        return null;
    }

    function inBounds(row, col, rows, cols) {
        return row >= 0 && row < rows && col >= 0 && col < cols;
    }

    function cellAt(board, row, col) {
        const rowData = board[row];
        if (!rowData || !Array.isArray(rowData)) {
            return null;
        }
        const cell = rowData[col];
        return cell && typeof cell === "object" ? cell : null;
    }

    function cellPieceTypeForAttack(cell) {
        let pt = cell.pieceType;
        if (pt === undefined || pt === null) {
            pt = cell.PieceType;
        }
        const n = Number(pt);
        return Number.isFinite(n) ? n : NaN;
    }

    function isSquareUnderAttack(board, position, threateningColor, whitePlayerView, rows, cols) {
        const PT_PAWN = 0;
        const PT_KNIGHT = 2;
        const PT_BISHOP = 3;
        const PT_ROOK = 4;
        const PT_QUEEN = 5;

        const row = position.row;
        const col = position.col;
        if (!inBounds(row, col, rows, cols)) {
            return false;
        }

        for (let i = col + 1; i < cols; i++) {
            const piece = cellAt(board, row, i);
            if (!piece) {
                continue;
            }
            if (piece.color !== threateningColor) {
                break;
            }
            const pieceType = cellPieceTypeForAttack(piece);
            if (pieceType === PT_QUEEN || pieceType === PT_ROOK) {
                return true;
            }
            break;
        }

        for (let i = col - 1; i >= 0; i--) {
            const piece = cellAt(board, row, i);
            if (!piece) {
                continue;
            }
            if (piece.color !== threateningColor) {
                break;
            }
            const pieceType = cellPieceTypeForAttack(piece);
            if (pieceType === PT_QUEEN || pieceType === PT_ROOK) {
                return true;
            }
            break;
        }

        for (let i = row + 1; i < rows; i++) {
            const piece = cellAt(board, i, col);
            if (!piece) {
                continue;
            }
            if (piece.color !== threateningColor) {
                break;
            }
            const pieceType = cellPieceTypeForAttack(piece);
            if (pieceType === PT_QUEEN || pieceType === PT_ROOK) {
                return true;
            }
            break;
        }

        for (let i = row - 1; i >= 0; i--) {
            const piece = cellAt(board, i, col);
            if (!piece) {
                continue;
            }
            if (piece.color !== threateningColor) {
                break;
            }
            const pieceType = cellPieceTypeForAttack(piece);
            if (pieceType === PT_QUEEN || pieceType === PT_ROOK) {
                return true;
            }
            break;
        }

        for (let i = row + 1, j = col + 1; i < rows && j < cols; i++, j++) {
            const piece = cellAt(board, i, j);
            if (!piece) {
                continue;
            }
            if (piece.color !== threateningColor) {
                break;
            }
            const pieceType = cellPieceTypeForAttack(piece);
            if (pieceType === PT_QUEEN || pieceType === PT_BISHOP) {
                return true;
            }
            break;
        }

        for (let i = row + 1, j = col - 1; i < rows && j >= 0; i++, j--) {
            const piece = cellAt(board, i, j);
            if (!piece) {
                continue;
            }
            if (piece.color !== threateningColor) {
                break;
            }
            const pieceType = cellPieceTypeForAttack(piece);
            if (pieceType === PT_QUEEN || pieceType === PT_BISHOP) {
                return true;
            }
            break;
        }

        for (let i = row - 1, j = col - 1; i >= 0 && j >= 0; i--, j--) {
            const piece = cellAt(board, i, j);
            if (!piece) {
                continue;
            }
            if (piece.color !== threateningColor) {
                break;
            }
            const pieceType = cellPieceTypeForAttack(piece);
            if (pieceType === PT_QUEEN || pieceType === PT_BISHOP) {
                return true;
            }
            break;
        }

        for (let i = row - 1, j = col + 1; i >= 0 && j < cols; i--, j++) {
            const piece = cellAt(board, i, j);
            if (!piece) {
                continue;
            }
            if (piece.color !== threateningColor) {
                break;
            }
            const pieceType = cellPieceTypeForAttack(piece);
            if (pieceType === PT_QUEEN || pieceType === PT_BISHOP) {
                return true;
            }
            break;
        }

        const knightOffsets = [
            [1, 2],
            [-1, 2],
            [1, -2],
            [-1, -2],
            [2, 1],
            [-2, 1],
            [2, -1],
            [-2, -1],
        ];
        for (let k = 0; k < knightOffsets.length; k++) {
            const x = row + knightOffsets[k][0];
            const y = col + knightOffsets[k][1];
            if (!inBounds(x, y, rows, cols)) {
                continue;
            }
            const piece = cellAt(board, x, y);
            if (
                piece &&
                piece.color === threateningColor &&
                cellPieceTypeForAttack(piece) === PT_KNIGHT
            ) {
                return true;
            }
        }

        let pawnSquares;
        if ((threateningColor === "black") ^ !whitePlayerView) {
            pawnSquares = [
                [row - 1, col - 1],
                [row - 1, col + 1],
            ];
        } else {
            pawnSquares = [
                [row + 1, col - 1],
                [row + 1, col + 1],
            ];
        }
        for (let p = 0; p < pawnSquares.length; p++) {
            const x = pawnSquares[p][0];
            const y = pawnSquares[p][1];
            if (!inBounds(x, y, rows, cols)) {
                continue;
            }
            const piece = cellAt(board, x, y);
            if (
                piece &&
                piece.color === threateningColor &&
                cellPieceTypeForAttack(piece) === PT_PAWN
            ) {
                return true;
            }
        }

        return false;
    }

    const PositionValidation = {
        getMessage: getMessage,
    };

    global.ShmerlingPositionValidation = PositionValidation;

    if (typeof module === "object" && module && module.exports) {
        module.exports = PositionValidation;
    }
})(typeof window !== "undefined" ? window : globalThis);
