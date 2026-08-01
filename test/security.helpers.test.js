"use strict";

const assert = require("assert");
const {
    canReadLiveGame,
    canReadPersistedGame,
    canDeletePersistedGame,
    isLiveGameParticipant,
} = require("../src/security/gameAccess");
const { isSameOriginMutatingRequest } = require("../src/security/csrfOrigin");
const { ROOT_CLIENT_FILES } = require("../src/clientStatic");
const { buildHelmetOptions } = require("../src/security/helmetOptions");

describe("security helpers", function () {
    describe("helmetOptions", function () {
        it("allows inline scripts and skips HSTS/upgrade on non-prod", function () {
            const opts = buildHelmetOptions({ isProd: false, scriptSrcUrl: ["https://cdn.jsdelivr.net"] });
            assert.strictEqual(opts.hsts, false);
            assert.ok(opts.contentSecurityPolicy.directives.scriptSrc.includes("'unsafe-inline'"));
            assert.strictEqual(
                opts.contentSecurityPolicy.directives.upgradeInsecureRequests,
                undefined,
            );
            assert.strictEqual(opts.referrerPolicy.policy, "strict-origin-when-cross-origin");
        });

        it("enables HSTS and upgrade-insecure-requests in production", function () {
            const opts = buildHelmetOptions({ isProd: true });
            assert.strictEqual(opts.hsts, true);
            assert.deepStrictEqual(opts.contentSecurityPolicy.directives.upgradeInsecureRequests, []);
        });
    });

    describe("gameAccess", function () {
        const session = { user_id: "u1", user_name: "alice" };

        it("allows participants on private live games", function () {
            const game = {
                isPrivate: true,
                whitePlayer: { userId: "u1", userName: "alice" },
                blackPlayer: { userId: "u2", userName: "bob" },
                createdBy: { userId: "u1" },
            };
            assert.strictEqual(canReadLiveGame(game, session), true);
            assert.strictEqual(isLiveGameParticipant(game, session), true);
        });

        it("denies strangers on private live games", function () {
            const game = {
                isPrivate: true,
                whitePlayer: { userId: "u9", userName: "x" },
                blackPlayer: { userId: "u8", userName: "y" },
                createdBy: { userId: "u9" },
            };
            assert.strictEqual(canReadLiveGame(game, session), false);
        });

        it("allows logged-in strangers on public live games", function () {
            const game = {
                isPrivate: false,
                whitePlayer: { userId: "u9", userName: "x" },
                blackPlayer: { userId: "u8", userName: "y" },
                createdBy: { userId: "u9" },
            };
            assert.strictEqual(canReadLiveGame(game, session), true);
        });

        it("restricts private persisted deletes and reads", function () {
            const doc = {
                isPrivate: true,
                whitePlayer: "bob",
                blackPlayer: "carol",
                createBy: "bob",
                createByUserId: "u9",
            };
            assert.strictEqual(canReadPersistedGame(doc, session), false);
            assert.strictEqual(canDeletePersistedGame(doc, session, false), false);
            assert.strictEqual(canDeletePersistedGame(doc, session, true), true);
            assert.strictEqual(
                canDeletePersistedGame(
                    { ...doc, whitePlayer: "alice", createByUserId: "u1" },
                    session,
                    false,
                ),
                true,
            );
        });
    });

    describe("csrfSameOrigin", function () {
        it("allows GET without Origin", function () {
            const req = { method: "GET", get: () => null };
            assert.strictEqual(isSameOriginMutatingRequest(req), true);
        });

        it("allows same-origin POST", function () {
            const req = {
                method: "POST",
                get: (h) => {
                    if (h === "host") return "localhost:5000";
                    if (h === "origin") return "http://localhost:5000";
                    return null;
                },
            };
            assert.strictEqual(isSameOriginMutatingRequest(req), true);
        });

        it("rejects cross-origin POST in production", function () {
            const prev = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";
            try {
                const req = {
                    method: "POST",
                    get: (h) => {
                        if (h === "host") return "example.com";
                        if (h === "origin") return "http://evil.test";
                        return null;
                    },
                };
                assert.strictEqual(isSameOriginMutatingRequest(req), false);
            } finally {
                process.env.NODE_ENV = prev;
            }
        });
    });

    describe("clientStatic allowlist", function () {
        it("includes classic board scripts and excludes app.js", function () {
            assert.ok(ROOT_CLIENT_FILES.includes("ChessGame.js"));
            assert.ok(ROOT_CLIENT_FILES.includes("chessboard.js"));
            assert.ok(!ROOT_CLIENT_FILES.includes("app.js"));
            assert.ok(!ROOT_CLIENT_FILES.includes("brain43.js"));
        });
    });
});
