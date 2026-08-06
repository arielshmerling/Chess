/**
 * Broader positionValidation coverage: kings, draws, piece limits, headers, attack.
 */
"use strict";

const assert = require("assert");
const PositionValidation = require("../src/validation/positionValidation");
const strings = require("../src/strings");

function emptyBoard() {
    return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
}

function gameWith(board, extras) {
    const g = {
        BOARD_ROWS: 8,
        BOARD_COLUMNS: 8,
        GameState: {
            turn: "white",
            whitePlayerView: true,
            board,
        },
    };
    if (extras) {
        Object.assign(g, extras);
        if (extras.turn) {
            g.GameState.turn = extras.turn;
        }
    }
    return g;
}

function place(board, row, col, color, pieceType) {
    board[row][col] = { color, pieceType };
}

describe("positionValidation coverage", function () {
    it("returns boardUnreadable for missing game / board", function () {
        const a = PositionValidation.getMessage(null, "save");
        assert.ok(a.includes(strings.t("validation.position.boardUnreadable")));
        const b = PositionValidation.getMessage({ GameState: {} }, "play");
        assert.ok(b.includes(strings.t("validation.position.boardUnreadable")));
    });

    it("uses purpose-specific headers", function () {
        const board = emptyBoard();
        place(board, 7, 4, "white", 1);
        place(board, 0, 4, "black", 1);
        place(board, 6, 0, "white", 0);
        for (const purpose of ["save", "play", "saveBookmark", "addBookmark", "use"]) {
            const msg = PositionValidation.getMessage(gameWith(board), purpose);
            assert.strictEqual(msg, null, purpose);
        }
        const none = PositionValidation.getMessage(gameWith(emptyBoard()), "weird");
        assert.ok(none.includes(strings.t("validation.position.headerUse")));
    });

    it("rejects missing and extra kings", function () {
        const noBlack = emptyBoard();
        place(noBlack, 7, 4, "white", 1);
        assert.ok(
            PositionValidation.getMessage(gameWith(noBlack), "save").includes(
                strings.t("validation.position.blackKingNone"),
            ),
        );

        const twoWhite = emptyBoard();
        place(twoWhite, 7, 4, "white", 1);
        place(twoWhite, 7, 0, "white", 1);
        place(twoWhite, 0, 4, "black", 1);
        assert.ok(
            PositionValidation.getMessage(gameWith(twoWhite), "save").includes(
                strings.t("validation.position.whiteKingCount", { count: 2 }),
            ),
        );

        const twoBlack = emptyBoard();
        place(twoBlack, 7, 4, "white", 1);
        place(twoBlack, 0, 4, "black", 1);
        place(twoBlack, 0, 0, "black", 1);
        assert.ok(
            PositionValidation.getMessage(gameWith(twoBlack), "save").includes(
                strings.t("validation.position.blackKingCount", { count: 2 }),
            ),
        );
    });

    it("rejects adjacent kings", function () {
        const board = emptyBoard();
        place(board, 4, 4, "white", 1);
        place(board, 4, 5, "black", 1);
        assert.ok(
            PositionValidation.getMessage(gameWith(board), "save").includes(
                strings.t("validation.position.kingsAdjacent"),
            ),
        );
    });

    it("rejects when the side to move already checks the opponent king", function () {
        const board = emptyBoard();
        place(board, 7, 4, "white", 1);
        place(board, 0, 4, "black", 1);
        place(board, 1, 4, "white", 5); /* queen attacking black king */
        const msg = PositionValidation.getMessage(gameWith(board, { turn: "white" }), "play");
        assert.ok(msg);
        assert.ok(msg.includes(strings.t("common.white")));
        assert.ok(msg.includes(strings.t("common.black")));
    });

    it("flags insufficient material draws", function () {
        const kingsOnly = emptyBoard();
        place(kingsOnly, 7, 4, "white", 1);
        place(kingsOnly, 0, 4, "black", 1);
        assert.ok(
            PositionValidation.getMessage(gameWith(kingsOnly), "save").includes(
                strings.t("validation.position.drawInsufficientKings"),
            ),
        );

        const kbn = emptyBoard();
        place(kbn, 7, 4, "white", 1);
        place(kbn, 0, 4, "black", 1);
        place(kbn, 5, 5, "white", 3);
        assert.ok(
            PositionValidation.getMessage(gameWith(kbn), "save").includes(
                strings.t("validation.position.drawInsufficientMinor"),
            ),
        );

        const sameColorBishops = emptyBoard();
        place(sameColorBishops, 7, 4, "white", 1);
        place(sameColorBishops, 0, 4, "black", 1);
        place(sameColorBishops, 5, 0, "white", 3); /* dark */
        place(sameColorBishops, 4, 1, "black", 3); /* dark */
        assert.ok(
            PositionValidation.getMessage(gameWith(sameColorBishops), "save").includes(
                strings.t("validation.position.drawBishopsSameColor"),
            ),
        );

        const oppositeBishops = emptyBoard();
        place(oppositeBishops, 7, 4, "white", 1);
        place(oppositeBishops, 0, 4, "black", 1);
        place(oppositeBishops, 5, 0, "white", 3);
        place(oppositeBishops, 4, 0, "black", 3);
        assert.strictEqual(PositionValidation.getMessage(gameWith(oppositeBishops), "save"), null);
    });

    it("enforces piece count limits", function () {
        const board = emptyBoard();
        place(board, 7, 4, "white", 1);
        place(board, 0, 4, "black", 1);
        for (let c = 0; c < 8; c++) {
            place(board, 6, c, "white", 0);
        }
        place(board, 5, 0, "white", 0); /* 9th pawn */
        assert.ok(
            PositionValidation.getMessage(gameWith(board), "save").includes(
                strings.t("validation.position.tooManyPawns", {
                    color: strings.t("common.white"),
                    count: 9,
                }),
            ),
        );
    });

    it("accepts PieceType casing and skips invalid colors/types", function () {
        const board = emptyBoard();
        place(board, 7, 4, "white", 1);
        place(board, 0, 4, "black", 1);
        board[6][0] = { color: "WHITE", PieceType: 0 };
        board[6][1] = { color: "green", pieceType: 0 };
        board[6][2] = { color: "white", pieceType: "x" };
        board[6][3] = "not-a-piece";
        assert.strictEqual(PositionValidation.getMessage(gameWith(board), "add"), null);
    });

    it("rejects when checked by knight, pawn, or bishop", function () {
        function msgFor(board, turn) {
            return PositionValidation.getMessage(gameWith(board, { turn }), "play");
        }

        const knight = emptyBoard();
        place(knight, 7, 4, "white", 1);
        place(knight, 0, 4, "black", 1);
        place(knight, 2, 5, "white", 2); /* knight attacks black king at 0,4 */
        assert.ok(msgFor(knight, "white"));

        const pawn = emptyBoard();
        place(pawn, 7, 4, "white", 1);
        place(pawn, 0, 4, "black", 1);
        place(pawn, 1, 3, "white", 0); /* white pawn attacks black king */
        assert.ok(msgFor(pawn, "white"));

        const bishop = emptyBoard();
        place(bishop, 7, 4, "white", 1);
        place(bishop, 0, 4, "black", 1);
        place(bishop, 2, 2, "white", 3);
        assert.ok(msgFor(bishop, "white"));

        const rook = emptyBoard();
        place(rook, 7, 4, "white", 1);
        place(rook, 0, 4, "black", 1);
        place(rook, 0, 0, "white", 4);
        assert.ok(msgFor(rook, "white"));
    });

    it("enforces too-many queens limit", function () {
        const q = emptyBoard();
        place(q, 7, 4, "white", 1);
        place(q, 0, 4, "black", 1);
        let n = 0;
        for (let r = 2; r < 6 && n < 10; r++) {
            for (let c = 0; c < 8 && n < 10; c++) {
                place(q, r, c, "black", 5);
                n++;
            }
        }
        const msg = PositionValidation.getMessage(gameWith(q, { turn: "white" }), "save");
        assert.ok(msg);
        assert.ok(msg.includes(strings.t("common.black")) || /queen/i.test(msg));
    });
});
