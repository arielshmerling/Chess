/**
 * Phase 8 mobile session review adapter characterization.
 */
/* eslint-disable */

const assert = require("assert");
const MobileSessionReview = require("../src/mobile/mobile-session-review");

describe("mobile session review adapter", function () {
    it("filters playable moves and keeps result markers", function () {
        const game = {
            isResultMove: function (m) {
                return !!(m && (m.moveStr === "1-0" || m.moveStr === "0-1" || m.moveStr === "1/2-1/2"));
            },
        };
        const moves = [
            { moveStr: "e4" },
            { moveStr: "e5" },
            { moveStr: "1-0" },
        ];
        const out = MobileSessionReview.playableMoves(moves, game);
        assert.strictEqual(out.length, 3);
        assert.strictEqual(out[2].moveStr, "1-0");
        assert.notStrictEqual(out[0], moves[0]);
    });

    it("exposes attach helpers without DOM", function () {
        assert.strictEqual(typeof MobileSessionReview.attach, "function");
        assert.strictEqual(typeof MobileSessionReview.bindClassicNav, "function");
        assert.strictEqual(typeof MobileSessionReview.syncClassicBoardToPly, "function");
        assert.strictEqual(typeof MobileSessionReview.sessionApisReady, "function");
        assert.strictEqual(typeof MobileSessionReview.isMobileReviewPage, "function");
    });
});
