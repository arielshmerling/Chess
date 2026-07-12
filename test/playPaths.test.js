const assert = require("assert");
const {
    resolvePlayGamePath,
    canAccessPlayPage,
    effectivePreferPlayPage,
} = require("../src/play/playPaths");

describe("playPaths", function () {
    describe("resolvePlayGamePath", function () {
        it("defaults to /game on desktop web", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: false, isAdmin: false, preferPlayPage: false }),
                "/game",
            );
        });

        it("uses /mobile-game for mobile user agents", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: true, isAdmin: true, preferPlayPage: true }),
                "/mobile-game",
            );
        });

        it("honors desktop=1 query for mobile", function () {
            assert.strictEqual(
                resolvePlayGamePath({
                    isMobile: true,
                    desktopQuery: true,
                    isAdmin: true,
                    preferPlayPage: true,
                }),
                "/play",
            );
        });

        it("routes admins with preferPlayPage to /play", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: false, isAdmin: true, preferPlayPage: true }),
                "/play",
            );
        });

        it("keeps non-admin users on /game even if preferPlayPage is set", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: false, isAdmin: false, preferPlayPage: true }),
                "/game",
            );
        });
    });

    describe("canAccessPlayPage", function () {
        it("allows admins only", function () {
            assert.strictEqual(canAccessPlayPage({ session: { admin: true } }), true);
            assert.strictEqual(canAccessPlayPage({ session: { admin: false } }), false);
            assert.strictEqual(canAccessPlayPage({}), false);
        });
    });

    describe("effectivePreferPlayPage", function () {
        it("returns false for non-admins", function () {
            assert.strictEqual(
                effectivePreferPlayPage({ session: { admin: false, preferPlayPage: true } }),
                false,
            );
        });

        it("returns session flag for admins", function () {
            assert.strictEqual(
                effectivePreferPlayPage({ session: { admin: true, preferPlayPage: true } }),
                true,
            );
        });
    });
});
