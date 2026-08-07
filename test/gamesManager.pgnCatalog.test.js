/**
 * PGN search catalog stays headers-only; review loads moves on demand.
 */
"use strict";

const assert = require("assert");
const path = require("path");
const gamesManagerService = require("../src/modules/gamesManager/service");

describe("gamesManager PGN catalog (search memory)", function () {
    beforeEach(function () {
        gamesManagerService.clearPGNCatalog();
    });

    after(function () {
        gamesManagerService.clearPGNCatalog();
    });

    it("getPGNGames returns headers without move lists", async function () {
        this.timeout(120_000);
        const catalog = await gamesManagerService.getPGNGames();
        assert.ok(Array.isArray(catalog));
        assert.ok(catalog.length > 0, "expected at least one catalog entry");
        const first = catalog[0];
        assert.ok(first.Id, "stable Id");
        assert.ok(first.sourceFile);
        assert.strictEqual(typeof first.gameIndex, "number");
        assert.ok(Array.isArray(first.moves));
        assert.strictEqual(first.moves.length, 0, "catalog must not retain moves");
        const withMoves = catalog.filter((g) => g.moves && g.moves.length > 0);
        assert.strictEqual(withMoves.length, 0);
    });

    it("findReviewGame loads moves for a catalog Id", async function () {
        this.timeout(120_000);
        const catalog = await gamesManagerService.getPGNGames();
        const sample = catalog.find((g) => g.white || g.black) || catalog[0];
        const review = await gamesManagerService.findReviewGame(sample.Id, "tester");
        assert.ok(review);
        assert.strictEqual(review.reviewType, "pgn");
        assert.ok(Array.isArray(review.moves));
        assert.ok(review.moves.length > 0, "review must include moves");
        assert.ok(path.basename(sample.sourceFile));
    });
});
