"use strict";

const assert = require("assert");
const {
    buildLocaleScriptTags,
    buildPlayHtml,
    minifyPlayHtml,
    normalizeLocale,
    STRINGS_MARKER,
} = require("../src/play/servePlayHtml");

describe("servePlayHtml", function () {
    it("normalizes locale codes", function () {
        assert.strictEqual(normalizeLocale("HE"), "he");
        assert.strictEqual(normalizeLocale("pt-BR"), "pt");
        assert.strictEqual(normalizeLocale("nope"), "en");
    });

    it("loads English only by default", function () {
        const tags = buildLocaleScriptTags("en");
        assert.ok(tags.includes("/app/strings/en.js?v="));
        assert.ok(tags.includes("/app/strings/en-extra.js?v="));
        assert.ok(!tags.includes("/app/strings/he.js"));
        assert.ok(tags.includes("defer"));
    });

    it("loads active locale plus English fallback", function () {
        const tags = buildLocaleScriptTags("he");
        assert.ok(tags.includes("/app/strings/en.js?v="));
        assert.ok(tags.includes("/app/strings/he.js?v="));
        assert.ok(tags.includes("/app/strings/he-extra.js?v="));
        assert.ok(!tags.includes("/app/strings/fr.js"));
    });

    it("injects locale scripts and minifies play.html", function () {
        const html = buildPlayHtml({ locale: "fr", minify: true });
        assert.ok(!html.includes(STRINGS_MARKER));
        assert.ok(html.includes("/app/strings/fr.js?v="));
        assert.ok(html.includes("/app/ui/bundles/play-shell.js?v="));
        assert.ok(html.includes("play-early-boot.js?v="));
        assert.ok(!html.includes("\n  <script src=\"/app/strings/en.js\""));
        assert.ok(html.length < 20000);
    });

    it("cache-busts Play shell assets with file mtimes", function () {
        const html = buildPlayHtml({ locale: "en", minify: false });
        assert.match(html, /\/app\/ui\/play-early-boot\.js\?v=\d+/);
        assert.match(html, /\/app\/ui\/bundles\/play-core\.js\?v=\d+/);
        assert.match(html, /\/app\/ui\/bundles\/play-session\.js\?v=\d+/);
        assert.match(html, /\/app\/ui\/bundles\/play-shell\.js\?v=\d+/);
        assert.match(html, /data-play-chrome="\/app\/ui\/bundles\/play-chrome\.js\?v=\d+"/);
    });

    it("minifyPlayHtml collapses whitespace outside scripts", function () {
        const raw = "<div>  a  </div>\n<script>  var x = 1;  </script>";
        const out = minifyPlayHtml(raw);
        assert.ok(out.includes("<div> a </div>"));
        assert.ok(out.includes("<script>  var x = 1;  </script>"));
    });
});
