/**
 * Shared timed-search helpers (iterative deepening regression guard).
 * Run: npx mocha ./test/brainSearchTime.test.js
 */
/* eslint-disable */

const assert = require("assert");
const brainSearchTime = require("../src/brainSearchTime");

const {
    shouldAcceptDeeperSearchResult,
    DEPTH_SCORE_REGRESSION_MARGIN,
} = brainSearchTime;

describe("brainSearchTime shouldAcceptDeeperSearchResult", function () {
    before(function () {
        if (typeof shouldAcceptDeeperSearchResult !== "function") {
            this.skip();
        }
    });

    it("accepts first depth (no previous score)", () => {
        assert.strictEqual(shouldAcceptDeeperSearchResult(undefined, -3.5), true);
    });

    it("accepts when deeper score improves", () => {
        assert.strictEqual(shouldAcceptDeeperSearchResult(-1.9, 2.2), true);
    });

    it("accepts when deeper score ties within margin", () => {
        assert.strictEqual(
            shouldAcceptDeeperSearchResult(2.2, 2.2 - DEPTH_SCORE_REGRESSION_MARGIN / 2),
            true,
        );
    });

    it("rejects when deeper score regresses vs previous depth", () => {
        assert.strictEqual(shouldAcceptDeeperSearchResult(2.2, -3.55), false);
    });

    it("always accepts winning mate scores from deeper depth", () => {
        assert.strictEqual(
            shouldAcceptDeeperSearchResult(5, -99999, { newIsWinningMate: true }),
            true,
        );
    });

    it("always accepts losing mate scores from deeper depth", () => {
        assert.strictEqual(
            shouldAcceptDeeperSearchResult(5, -99990, { newIsLosingMate: true }),
            true,
        );
    });

    it("rejects non-finite deeper scores", () => {
        assert.strictEqual(shouldAcceptDeeperSearchResult(2.2, NaN), false);
    });
});
