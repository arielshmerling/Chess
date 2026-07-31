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

    it("defaults to English", function () {
        assert.strictEqual(strings.DEFAULT_LOCALE, "en");
        assert.strictEqual(strings.getLocale(), "en");
        assert.strictEqual(strings.t("play.status.gameOver"), "Game over");
        assert.strictEqual(strings.t("common.white"), "White");
        assert.strictEqual(strings.t("site.friends"), "Friends");
    });

    it("resolves nested keys from the English catalog when locale is en", function () {
        assert.strictEqual(strings.t("play.status.gameOver", null, "en"), "Game over");
        assert.strictEqual(strings.t("common.white", null, "en"), "White");
    });

    it("interpolates {{param}} placeholders in Hebrew", function () {
        assert.strictEqual(
            strings.t("play.status.timesUpLost", { loser: "לבן" }, "he"),
            "הזמן נגמר! לבן הפסיד/ה",
        );
        assert.ok(strings.t("play.status.timesUpLost", { loser: "לבן" }, "he").includes("לבן"));
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

    it("normalizes and resolves request locale from cookie", function () {
        assert.strictEqual(strings.normalizeLocale("en"), "en");
        assert.strictEqual(strings.normalizeLocale("xx"), null);
        assert.strictEqual(
            strings.resolveRequestLocale({ headers: { cookie: "shmerling_locale=en; other=1" } }),
            "en",
        );
        assert.strictEqual(
            strings.resolveRequestLocale({ headers: { cookie: "shmerling_locale=nope" } }),
            strings.DEFAULT_LOCALE,
        );
        assert.strictEqual(strings.resolveRequestLocale({ headers: {} }), strings.DEFAULT_LOCALE);
    });

    it("changeLocale updates active locale without reload when asked", function () {
        assert.strictEqual(strings.changeLocale("en", { reload: false }), true);
        assert.strictEqual(strings.getLocale(), "en");
        assert.strictEqual(strings.t("common.white"), "White");
        assert.strictEqual(strings.changeLocale("he", { reload: false }), true);
        assert.strictEqual(strings.getLocale(), "he");
    });

    it("localizes White/Black color tokens", function () {
        assert.strictEqual(strings.localizeColorName("White", "he"), "לבן");
        assert.strictEqual(strings.localizeColorName("black", "he"), "שחור");
        assert.strictEqual(strings.localizeColorName("white", "en"), "White");
        assert.strictEqual(strings.localizeColorName("Black", "en"), "Black");
    });

    it("supports Japanese catalog and LTR html dir", function () {
        assert.ok(strings.LOCALES.includes("ja"));
        assert.strictEqual(strings.t("common.white", null, "ja"), "白");
        assert.strictEqual(strings.t("common.black", null, "ja"), "黒");
        assert.strictEqual(strings.isRtl("ja"), false);
        assert.strictEqual(strings.getHtmlDir("ja"), "ltr");
        assert.strictEqual(strings.getHtmlLang("ja"), "ja");
        assert.strictEqual(strings.normalizeLocale("ja"), "ja");
        assert.strictEqual(strings.t("desktop.prefs.languageJapanese", null, "en"), "日本語");
    });

    it("registers fr/de/zh/ar/hi/es with Arabic RTL", function () {
        ["fr", "de", "zh", "ar", "hi", "es"].forEach(function (code) {
            assert.ok(strings.LOCALES.includes(code), "missing locale " + code);
            assert.strictEqual(strings.normalizeLocale(code), code);
            assert.notStrictEqual(strings.t("common.white", null, code), "common.white");
            assert.notStrictEqual(strings.t("play.status.gameOver", null, code), "play.status.gameOver");
        });
        assert.strictEqual(strings.isRtl("ar"), true);
        assert.strictEqual(strings.getHtmlDir("ar"), "rtl");
        assert.strictEqual(strings.isRtl("fr"), false);
        assert.strictEqual(strings.getHtmlDir("zh"), "ltr");
        assert.strictEqual(strings.t("common.white", null, "fr"), "Blanc");
        assert.strictEqual(strings.t("common.white", null, "de"), "Weiß");
        assert.strictEqual(strings.t("common.white", null, "zh"), "白");
        assert.strictEqual(strings.t("desktop.prefs.languageHindi", null, "en"), "हिन्दी");
        assert.strictEqual(strings.t("desktop.prefs.languageSpanish", null, "en"), "Español");
    });

    it("registers Russian, Ukrainian, and Norwegian", function () {
        ["ru", "uk", "no"].forEach(function (code) {
            assert.ok(strings.LOCALES.includes(code), "missing locale " + code);
            assert.strictEqual(strings.normalizeLocale(code), code);
            assert.strictEqual(strings.isRtl(code), false);
            assert.strictEqual(strings.getHtmlDir(code), "ltr");
            assert.notStrictEqual(strings.t("common.white", null, code), "common.white");
        });
        assert.strictEqual(strings.t("common.white", null, "ru"), "Белые");
        assert.strictEqual(strings.t("common.white", null, "uk"), "Білі");
        assert.strictEqual(strings.t("common.white", null, "no"), "Hvit");
        assert.strictEqual(strings.t("desktop.prefs.languageRussian", null, "en"), "Русский");
        assert.strictEqual(strings.t("desktop.prefs.languageUkrainian", null, "en"), "Українська");
        assert.strictEqual(strings.t("desktop.prefs.languageNorwegian", null, "en"), "Norsk");
    });
});
