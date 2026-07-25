const assert = require("assert");
const {
    resolvePlayGamePath,
    canAccessPlayPage,
    effectivePreferPlayPage,
} = require("../src/play/playPaths");

describe("playPaths", function () {
    describe("resolvePlayGamePath", function () {
        it("defaults to /game for non-admin desktop web", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: false, isAdmin: false }),
                "/game",
            );
        });

        it("uses /mobile-game for mobile user agents", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: true, isAdmin: true }),
                "/mobile-game",
            );
        });

        it("honors desktop=1 query for mobile admins → /play", function () {
            assert.strictEqual(
                resolvePlayGamePath({
                    isMobile: true,
                    desktopQuery: true,
                    isAdmin: true,
                }),
                "/play",
            );
        });

        it("routes admins to /play", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: false, isAdmin: true }),
                "/play",
            );
        });

        it("keeps non-admin users on /game", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: false, isAdmin: false }),
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
                effectivePreferPlayPage({ session: { admin: false } }),
                false,
            );
        });

        it("returns true for admins", function () {
            assert.strictEqual(
                effectivePreferPlayPage({ session: { admin: true } }),
                true,
            );
        });
    });
});
