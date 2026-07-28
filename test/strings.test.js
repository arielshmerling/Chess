const assert = require("assert");

const strings = require("../src/strings");
const en = require("../src/strings/en");
const { t: bridgeT } = require("../src/strings/t-bridge");

describe("strings catalog", function () {
    it("resolves nested keys from the English catalog", function () {
        assert.strictEqual(strings.t("play.status.gameOver"), "Game over");
        assert.strictEqual(strings.t("common.white"), "White");
    });

    it("interpolates {{param}} placeholders", function () {
        assert.strictEqual(
            strings.t("play.status.timesUpLost", { loser: "White" }),
            "Time's up! White lost",
        );
        assert.strictEqual(
            strings.t("play.savedGames.playersVs", { white: "Alice", black: "Bob" }),
            "Alice vs. Bob",
        );
    });

    it("returns the key when a path is missing", function () {
        assert.strictEqual(strings.t("play.status.doesNotExist"), "play.status.doesNotExist");
    });

    it("exports the English catalog for direct lookup in tests", function () {
        assert.strictEqual(en.play.sessionMode.play, "Play Mode");
    });

    it("bridge t() matches index t()", function () {
        assert.strictEqual(bridgeT("play.reviewNav.pause"), "Pause");
    });

    it("keeps site.friends as a string nav label", function () {
        assert.strictEqual(strings.t("site.friends"), "Friends");
        assert.strictEqual(typeof strings.getStrings().site.friends, "string");
    });

    it("formats search results without requiring an extra colon", function () {
        assert.strictEqual(
            strings.t("site.searchPage.resultsFound", { count: 18 }),
            "18 Results found:",
        );
    });
});
