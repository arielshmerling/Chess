/**
 * Position setup validation (same rules as web research mode bookmark validation).
 * Copied from chessboard.js getResearchBookmarkPositionValidationMessage — do not change web version.
 */
(function (global) {
    "use strict";

    /**
     * @param {object} chessGame - ChessGame instance
     * @param {"save"|"play"|"add"} [purpose]
     * @returns {string|null} Error message (header + detail) or null if valid
     */
    function getPositionValidationMessage(chessGame, purpose) {
        const header =
            purpose === "save"
                ? "Cannot save this position:\n\n"
                : purpose === "play"
                  ? "Cannot play from this position:\n\n"
                  : "Cannot use this position:\n\n";

        const g = chessGame;
        if (!g || !g.GameState) {
            return header + "Could not read the board. Try again after the board has loaded.";
        }

        let board;
        try {
            const snap = JSON.parse(JSON.stringify(g.GameState));
            board = snap && snap.board;
        } catch {
            board = g.GameState.board;
        }
        if (!board || !Array.isArray(board)) {
            return header + "Could not read the board. Try again after the board has loaded.";
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
                const t = cellPieceType(cell);
                if (!Number.isFinite(t)) {
                    continue;
                }
                const bucket = byColor[col];
                if (t === PT_PAWN) {
                    bucket.pawn++;
                } else if (t === PT_ROOK) {
                    bucket.rook++;
                } else if (t === PT_KNIGHT) {
                    bucket.knight++;
                } else if (t === PT_BISHOP) {
                    bucket.bishop++;
                    if (col === "white") {
                        whiteBishopSquare = { row: r, col: c };
                    } else {
                        blackBishopSquare = { row: r, col: c };
                    }
                } else if (t === PT_QUEEN) {
                    bucket.queen++;
                } else if (t === PT_KING) {
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
                return header + "There must be exactly one white king on the board. None was found.";
            }
            return (
                header +
                "There must be exactly one white king on the board. Found " +
                wk +
                " white kings."
            );
        }
        const bk = byColor.black.king;
        if (bk !== 1) {
            if (bk === 0) {
                return header + "There must be exactly one black king on the board. None was found.";
            }
            return (
                header +
                "There must be exactly one black king on the board. Found " +
                bk +
                " black kings."
            );
        }

        if (whiteKingPos && blackKingPos) {
            const dr = Math.abs(whiteKingPos.row - blackKingPos.row);
            const dc = Math.abs(whiteKingPos.col - blackKingPos.col);
            if (dr <= 1 && dc <= 1) {
                return header + "The two kings cannot be on adjacent squares (including diagonally).";
            }
        }

        const W = byColor.white;
        const B = byColor.black;
        const nonKingWhite = W.pawn + W.rook + W.knight + W.bishop + W.queen;
        const nonKingBlack = B.pawn + B.rook + B.knight + B.bishop + B.queen;
        const totalPieces = 2 + nonKingWhite + nonKingBlack;
        const minorsTotal = W.bishop + W.knight + B.bishop + B.knight;
        const heavyOrPawnTotal = W.pawn + W.rook + W.queen + B.pawn + B.rook + B.queen;

        if (nonKingWhite === 0 && nonKingBlack === 0) {
            return (
                header +
                "This position is a draw by insufficient material (king versus king). Add pieces so checkmate remains possible."
            );
        }
        if (totalPieces === 3 && heavyOrPawnTotal === 0 && minorsTotal === 1) {
            return (
                header +
                "This position is a draw by insufficient material (king and bishop or knight versus lone king). Add pieces so checkmate remains possible."
            );
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
                    return (
                        header +
                        "This position is a draw by insufficient material (bishop versus bishop on the same square color). Add pieces so checkmate remains possible."
                    );
                }
            }
        }

        if (byColor.white.queen > 9) {
            return header + "White has " + byColor.white.queen + " queens; the maximum is 9 per color.";
        }
        if (byColor.black.queen > 9) {
            return header + "Black has " + byColor.black.queen + " queens; the maximum is 9 per color.";
        }
        if (byColor.white.rook > 10) {
            return header + "White has " + byColor.white.rook + " rooks; the maximum is 10 per color.";
        }
        if (byColor.black.rook > 10) {
            return header + "Black has " + byColor.black.rook + " rooks; the maximum is 10 per color.";
        }
        if (byColor.white.bishop > 10) {
            return header + "White has " + byColor.white.bishop + " bishops; the maximum is 10 per color.";
        }
        if (byColor.black.bishop > 10) {
            return header + "Black has " + byColor.black.bishop + " bishops; the maximum is 10 per color.";
        }
        if (byColor.white.knight > 10) {
            return header + "White has " + byColor.white.knight + " knights; the maximum is 10 per color.";
        }
        if (byColor.black.knight > 10) {
            return header + "Black has " + byColor.black.knight + " knights; the maximum is 10 per color.";
        }
        if (byColor.white.pawn > 8) {
            return header + "White has " + byColor.white.pawn + " pawns; the maximum is 8 per color.";
        }
        if (byColor.black.pawn > 8) {
            return header + "Black has " + byColor.black.pawn + " pawns; the maximum is 8 per color.";
        }

        return null;
    }

    global.DesktopPositionValidation = {
        getMessage: getPositionValidationMessage,
    };
})(window);
