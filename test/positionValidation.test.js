const assert = require("assert");
const PositionValidation = require("../src/validation/positionValidation");
const strings = require("../src/strings");

describe("position validation messages", function () {
    it("requires exactly one white king", function () {
        const game = {
            BOARD_ROWS: 8,
            BOARD_COLUMNS: 8,
            GameState: {
                turn: "white",
                whitePlayerView: true,
                board: Array.from({ length: 8 }, () =>
                    Array.from({ length: 8 }, () => null),
                ),
            },
        };
        const msg = PositionValidation.getMessage(game, "save");
        assert.ok(msg);
        assert.ok(msg.includes(strings.t("validation.position.whiteKingNone")));
    });
});
