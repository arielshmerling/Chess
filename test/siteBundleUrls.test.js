"use strict";

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { getSiteBundleUrls } = require("../src/site/siteBundleUrls");

describe("siteBundleUrls", function () {
    it("points at built site shell bundles with cache-bust query", function () {
        const urls = getSiteBundleUrls();
        assert.match(urls.shell, /^\/bundles\/site-shell\.js\?v=\d+$/);
        assert.match(urls.chrome, /^\/bundles\/site-chrome\.js\?v=\d+$/);
        assert.match(urls.social, /^\/bundles\/site-social\.js\?v=\d+$/);
        const shellPath = path.join(__dirname, "../src/assets/bundles/site-shell.js");
        assert.ok(fs.existsSync(shellPath), "site-shell.js must exist (run npm run build:site)");
    });
});
