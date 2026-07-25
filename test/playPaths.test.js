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
