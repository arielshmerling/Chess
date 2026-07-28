const assert = require("assert");
const {
    resolvePlayGamePath,
    canAccessPlayPage,
    canUsePlayAdvancedTools,
    canAccessDebug,
    effectivePreferPlayPage,
} = require("../src/play/playPaths");
const {
    resolveSessionUserType,
    isAdminSession,
} = require("../src/modules/user/roles");

describe("playPaths", function () {
    describe("resolvePlayGamePath", function () {
        it("defaults to /game when usePlayPage is false", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: false, usePlayPage: false }),
                "/game",
            );
        });

        it("uses /mobile-game for mobile user agents", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: true, usePlayPage: true }),
                "/mobile-game",
            );
        });

        it("honors desktop=1 query for mobile → /play when usePlayPage", function () {
            assert.strictEqual(
                resolvePlayGamePath({
                    isMobile: true,
                    desktopQuery: true,
                    usePlayPage: true,
                }),
                "/play",
            );
        });

        it("routes usePlayPage users to /play", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: false, usePlayPage: true }),
                "/play",
            );
        });

        it("keeps isAdmin compat → /play", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: false, isAdmin: true }),
                "/play",
            );
        });

        it("keeps non-preferring users on /game", function () {
            assert.strictEqual(
                resolvePlayGamePath({ isMobile: false, isAdmin: false }),
                "/game",
            );
        });
    });

    describe("resolveOnlineParticipantHref", function () {
        const { resolveOnlineParticipantHref } = require("../src/play/playPaths");

        it("uses /play?id= when usePlayPage", function () {
            assert.strictEqual(
                resolveOnlineParticipantHref("abc123", { usePlayPage: true }),
                "/play?id=abc123",
            );
        });

        it("uses /game?id= when classic UI", function () {
            assert.strictEqual(
                resolveOnlineParticipantHref("abc123", { usePlayPage: false }),
                "/game?id=abc123",
            );
        });
    });

    describe("resolveOnlineWatchHref", function () {
        const { resolveOnlineWatchHref } = require("../src/play/playPaths");

        it("uses /play?id=&mode=watch when usePlayPage", function () {
            assert.strictEqual(
                resolveOnlineWatchHref("abc123", { usePlayPage: true }),
                "/play?id=abc123&mode=watch",
            );
        });

        it("uses classic /watch?id= otherwise", function () {
            assert.strictEqual(
                resolveOnlineWatchHref("abc123", { usePlayPage: false }),
                "/watch?id=abc123",
            );
        });

        it("keeps mobile on /watch?id= even when usePlayPage (mobile shell)", function () {
            assert.strictEqual(
                resolveOnlineWatchHref("abc123", { usePlayPage: true, isMobile: true }),
                "/watch?id=abc123",
            );
        });
    });

    describe("resolveReviewHref", function () {
        const { resolveReviewHref } = require("../src/play/playPaths");

        it("uses /play?mode=review when usePlayPage", function () {
            assert.strictEqual(
                resolveReviewHref("abc123", { usePlayPage: true, type: "history" }),
                "/play?mode=review&id=abc123&type=history",
            );
            assert.strictEqual(
                resolveReviewHref("abc123", { usePlayPage: true, type: "pgn" }),
                "/play?mode=review&id=abc123&type=pgn",
            );
        });

        it("uses classic /review otherwise", function () {
            assert.strictEqual(
                resolveReviewHref("abc123", { usePlayPage: false, type: "history" }),
                "/review?id=abc123&type=history",
            );
        });
    });

    describe("resolvePracticeHref", function () {
        const { resolvePracticeHref } = require("../src/play/playPaths");

        it("uses /play?mode=practice when usePlayPage", function () {
            assert.strictEqual(
                resolvePracticeHref({ usePlayPage: true }),
                "/play?mode=practice",
            );
        });

        it("uses classic /game?gameType=3 otherwise", function () {
            assert.strictEqual(
                resolvePracticeHref({ usePlayPage: false }),
                "/game?gameType=3",
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

    describe("canUsePlayAdvancedTools", function () {
        it("allows Admin and Partner only", function () {
            assert.strictEqual(
                canUsePlayAdvancedTools({ session: { admin: true, userType: "Admin" } }),
                true,
            );
            assert.strictEqual(
                canUsePlayAdvancedTools({ session: { admin: false, userType: "Partner" } }),
                true,
            );
            assert.strictEqual(
                canUsePlayAdvancedTools({ session: { admin: false, userType: "Member" } }),
                false,
            );
        });

        it("canCustomizeThemes matches advanced tools (Admin/Partner)", function () {
            const { canCustomizeThemes } = require("../src/modules/user/roles");
            assert.strictEqual(
                canCustomizeThemes({ admin: true, userType: "Admin" }),
                true,
            );
            assert.strictEqual(
                canCustomizeThemes({ admin: false, userType: "Partner" }),
                true,
            );
            assert.strictEqual(
                canCustomizeThemes({ admin: false, userType: "Member" }),
                false,
            );
        });
    });

    describe("canAccessDebug", function () {
        it("allows Admin and Partner only", function () {
            assert.strictEqual(
                canAccessDebug({ session: { admin: true, userType: "Admin" } }),
                true,
            );
            assert.strictEqual(
                canAccessDebug({ session: { admin: false, userType: "Partner" } }),
                true,
            );
            assert.strictEqual(
                canAccessDebug({ session: { admin: false, userType: "Member" } }),
                false,
            );
        });
    });

    describe("effectivePreferPlayPage", function () {
        it("returns true for any logged-in user", function () {
            assert.strictEqual(
                effectivePreferPlayPage({ session: { user_id: "1", admin: false, userType: "Member" } }),
                true,
            );
            assert.strictEqual(
                effectivePreferPlayPage({ session: { admin: false } }),
                false,
            );
        });

        it("returns true for admins", function () {
            assert.strictEqual(
                effectivePreferPlayPage({ session: { user_id: "1", admin: true } }),
                true,
            );
        });
    });

    describe("resolveDeprecatedGameToPlayHref", function () {
        const { resolveDeprecatedGameToPlayHref } = require("../src/play/playPaths");

        it("maps bare /game to /play", function () {
            assert.strictEqual(resolveDeprecatedGameToPlayHref({}), "/play");
        });

        it("maps practice gameType 3 to /play?mode=practice", function () {
            assert.strictEqual(
                resolveDeprecatedGameToPlayHref({ gameType: "3" }),
                "/play?mode=practice",
            );
        });

        it("maps newGame SP query to /play?newGame=1…", function () {
            const href = resolveDeprecatedGameToPlayHref({
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

        it("maps online id when onlineGameById is set", function () {
            assert.strictEqual(
                resolveDeprecatedGameToPlayHref(
                    { id: "abc123" },
                    { onlineGameById: true },
                ),
                "/play?id=abc123",
            );
        });

        it("keeps SP id and joinGame on classic (null)", function () {
            assert.strictEqual(
                resolveDeprecatedGameToPlayHref({ id: "abc123" }),
                null,
            );
            assert.strictEqual(
                resolveDeprecatedGameToPlayHref({
                    gameType: "2",
                    joinGame: "abc123",
                }),
                null,
            );
        });

        it("honors classic=1 escape", function () {
            assert.strictEqual(
                resolveDeprecatedGameToPlayHref({ newGame: "1", classic: "1" }),
                null,
            );
            assert.strictEqual(
                resolveDeprecatedGameToPlayHref(
                    { newGame: "1" },
                    { classicEscape: true },
                ),
                null,
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
});
