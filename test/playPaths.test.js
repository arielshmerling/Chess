const assert = require("assert");
const { canAccessPlayPage } = require("../src/play/playPaths");
const {
    resolveSessionUserType,
    isAdminSession,
    canUsePlayAdvancedTools,
    canAccessDebug,
    canCustomizeThemes,
} = require("../src/modules/user/roles");

describe("playPaths", function () {
    describe("resolveOnlineWatchHref", function () {
        const { resolveOnlineWatchHref } = require("../src/play/playPaths");

        it("uses /play?id=&mode=watch on desktop", function () {
            assert.strictEqual(
                resolveOnlineWatchHref("abc123"),
                "/play?id=abc123&mode=watch",
            );
        });

        it("keeps mobile on /watch?id=", function () {
            assert.strictEqual(
                resolveOnlineWatchHref("abc123", { isMobile: true }),
                "/watch?id=abc123",
            );
        });
    });

    describe("resolveReviewHref", function () {
        const { resolveReviewHref } = require("../src/play/playPaths");

        it("uses /play?mode=review", function () {
            assert.strictEqual(
                resolveReviewHref("abc123", { type: "history" }),
                "/play?mode=review&id=abc123&type=history",
            );
            assert.strictEqual(
                resolveReviewHref("abc123", { type: "pgn" }),
                "/play?mode=review&id=abc123&type=pgn",
            );
        });
    });

    describe("canAccessPlayPage", function () {
        it("allows any logged-in user (Admin, Partner, Member)", function () {
            assert.strictEqual(
                canAccessPlayPage({ session: { user_id: "1", admin: true, userType: "Admin" } }),
                true,
            );
            assert.strictEqual(
                canAccessPlayPage({ session: { user_id: "1", admin: false, userType: "Partner" } }),
                true,
            );
            assert.strictEqual(
                canAccessPlayPage({ session: { user_id: "1", admin: false, userType: "Member" } }),
                true,
            );
            assert.strictEqual(canAccessPlayPage({ session: { admin: false } }), false);
            assert.strictEqual(canAccessPlayPage({}), false);
        });
    });

    describe("resolveGameToPlayHref", function () {
        const { resolveGameToPlayHref } = require("../src/play/playPaths");

        it("maps bare /game to /play", function () {
            assert.strictEqual(resolveGameToPlayHref({}), "/play");
        });

        it("maps practice gameType 3 to /play?mode=practice", function () {
            assert.strictEqual(
                resolveGameToPlayHref({ gameType: "3" }),
                "/play?mode=practice",
            );
        });

        it("maps newGame SP query to /play?newGame=1…", function () {
            const href = resolveGameToPlayHref({
                gameType: "1",
                newGame: "1",
                color: "black",
                engine: "brain43",
                difficulty: "3",
            });
            assert.ok(href.indexOf("/play?") === 0);
            assert.ok(href.indexOf("newGame=1") >= 0);
            assert.ok(href.indexOf("color=black") >= 0);
            assert.ok(href.indexOf("engine=brain43") >= 0);
        });

        it("maps id reopen and watch to /play", function () {
            assert.strictEqual(
                resolveGameToPlayHref({ id: "abc123" }),
                "/play?id=abc123",
            );
            assert.strictEqual(
                resolveGameToPlayHref({
                    id: "abc123",
                    mode: "watch",
                }),
                "/play?id=abc123&mode=watch",
            );
        });

        it("maps joinGame to /play?id=", function () {
            assert.strictEqual(
                resolveGameToPlayHref({
                    gameType: "2",
                    joinGame: "abc123",
                }),
                "/play?id=abc123",
            );
        });
    });
});

describe("user roles", function () {
    it("resolves session userType with admin precedence", function () {
        assert.strictEqual(resolveSessionUserType({ admin: true, userType: "Member" }), "Admin");
        assert.strictEqual(resolveSessionUserType({ admin: false, userType: "Partner" }), "Partner");
        assert.strictEqual(resolveSessionUserType({ admin: false }), "Member");
        assert.strictEqual(isAdminSession({ admin: true }), true);
        assert.strictEqual(isAdminSession({ admin: false, userType: "Partner" }), false);
    });

    it("canUsePlayAdvancedTools allows Admin and Partner only", function () {
        assert.strictEqual(
            canUsePlayAdvancedTools({ admin: true, userType: "Admin" }),
            true,
        );
        assert.strictEqual(
            canUsePlayAdvancedTools({ admin: false, userType: "Partner" }),
            true,
        );
        assert.strictEqual(
            canUsePlayAdvancedTools({ admin: false, userType: "Member" }),
            false,
        );
    });

    it("canCustomizeThemes allows Admin only", function () {
        assert.strictEqual(
            canCustomizeThemes({ admin: true, userType: "Admin" }),
            true,
        );
        assert.strictEqual(
            canCustomizeThemes({ admin: false, userType: "Partner" }),
            false,
        );
        assert.strictEqual(
            canCustomizeThemes({ admin: false, userType: "Member" }),
            false,
        );
    });

    it("canAccessDebug allows Admin and Partner only", function () {
        assert.strictEqual(
            canAccessDebug({ admin: true, userType: "Admin" }),
            true,
        );
        assert.strictEqual(
            canAccessDebug({ admin: false, userType: "Partner" }),
            true,
        );
        assert.strictEqual(
            canAccessDebug({ admin: false, userType: "Member" }),
            false,
        );
    });
});
