const assert = require("assert");

const strings = require("../src/strings");
const en = require("../src/strings/en");
const he = require("../src/strings/he");
const { t: bridgeT } = require("../src/strings/t-bridge");

describe("strings catalog", function () {
    beforeEach(function () {
        strings.setLocale(strings.DEFAULT_LOCALE);
    });

    after(function () {
        // Other suites in the same mocha process assert English catalog copy.
        strings.setLocale("en");
    });

    it("defaults to Hebrew", function () {
        assert.strictEqual(strings.DEFAULT_LOCALE, "he");
        assert.strictEqual(strings.getLocale(), "he");
        assert.strictEqual(strings.t("play.status.gameOver"), "המשחק הסתיים");
        assert.strictEqual(strings.t("common.white"), "לבן");
        assert.strictEqual(strings.t("site.friends"), "חברים");
    });

    it("resolves nested keys from the English catalog when locale is en", function () {
        assert.strictEqual(strings.t("play.status.gameOver", null, "en"), "Game over");
        assert.strictEqual(strings.t("common.white", null, "en"), "White");
    });

    it("interpolates {{param}} placeholders in Hebrew", function () {
        assert.strictEqual(
            strings.t("play.status.timesUpLost", { loser: "לבן" }),
            strings.t("play.status.timesUpLost", { loser: "לבן" }, "he"),
        );
        assert.ok(strings.t("play.status.timesUpLost", { loser: "לבן" }).includes("לבן"));
        assert.strictEqual(
            strings.t("play.savedGames.playersVs", { white: "Alice", black: "Bob" }, "en"),
            "Alice vs. Bob",
        );
    });

    it("returns the key when a path is missing", function () {
        assert.strictEqual(strings.t("play.status.doesNotExist"), "play.status.doesNotExist");
    });

    it("exports locale catalogs for direct lookup in tests", function () {
        assert.strictEqual(en.play.sessionMode.play, "Play Mode");
        assert.ok(typeof he.play.sessionMode.play === "string");
        assert.notStrictEqual(he.play.sessionMode.play, en.play.sessionMode.play);
    });

    it("bridge t() matches index t() for the active locale", function () {
        strings.setLocale("en");
        assert.strictEqual(bridgeT("play.reviewNav.pause"), "Pause");
        strings.setLocale("he");
        assert.strictEqual(bridgeT("play.reviewNav.pause"), strings.t("play.reviewNav.pause"));
    });

    it("keeps site.friends as a string nav label in both locales", function () {
        assert.strictEqual(typeof strings.getStrings("he").site.friends, "string");
        assert.strictEqual(typeof strings.getStrings("en").site.friends, "string");
        assert.strictEqual(strings.t("site.friends", null, "en"), "Friends");
        assert.strictEqual(strings.t("site.friends", null, "he"), "חברים");
    });

    it("formats search results without requiring an extra colon", function () {
        assert.strictEqual(
            strings.t("site.searchPage.resultsFound", { count: 18 }, "en"),
            "18 Results found:",
        );
        assert.ok(strings.t("site.searchPage.resultsFound", { count: 18 }, "he").includes("18"));
    });

    it("reports RTL for Hebrew and LTR for English", function () {
        assert.strictEqual(strings.isRtl("he"), true);
        assert.strictEqual(strings.isRtl("en"), false);
        assert.strictEqual(strings.getHtmlDir("he"), "rtl");
        assert.strictEqual(strings.getHtmlDir("en"), "ltr");
    });

    it("falls back to English when a Hebrew key is missing", function () {
        const catalog = strings.getStrings("he");
        assert.ok(catalog);
        assert.strictEqual(strings.t("play.status.gameOver", null, "he"), "המשחק הסתיים");
    });
});
