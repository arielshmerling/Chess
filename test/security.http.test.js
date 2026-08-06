/**
 * HTTP coverage for Aug 2026 security remediations (Helmet, static allowlist,
 * IDOR, privacy, CSRF, rate limits).
 *
 * Run: mocha --exit --require ./test/_teardownWorkers.js ./test/security.http.test.js
 * Or via: npm run test:web:api / npm run test:all
 */
/* eslint-disable */

const assert = require("assert");
const request = require("supertest");
const { ensureWebE2EUsers } = require("./helpers/webE2EUser");
const { loadWebApp, resetWebRateLimits } = require("./helpers/webApp");
const { Game } = require("../src/modules/game/model");
const { resolveOnlineWatchHref } = require("../src/play/playPaths");

describe("security HTTP remediations", function () {
    this.timeout(30000);

    let app;
    let primary;
    let other;

    before(async function () {
        const users = await ensureWebE2EUsers();
        primary = users.primary;
        other = users.other;
        app = loadWebApp();
        resetWebRateLimits(app);
    });

    afterEach(function () {
        resetWebRateLimits(app);
    });

    async function loginAgent(creds) {
        resetWebRateLimits(app);
        const agent = request.agent(app);
        const loginRes = await agent
            .post("/login")
            .type("form")
            .send({ username: creds.username, password: creds.password })
            .redirects(0);
        assert.ok(
            loginRes.status === 302 || loginRes.status === 200,
            `login HTTP ${loginRes.status} for ${creds.username}`,
        );
        if (loginRes.status === 302) {
            assert.match(
                String(loginRes.headers.location || ""),
                /home|play|friends|return/i,
                `login did not establish a session (location=${loginRes.headers.location})`,
            );
        }
        return agent;
    }

    it("Helmet CSP allows unsafe-inline and skips upgrade-insecure-requests outside production", async function () {
        const res = await request(app).get("/login").expect(200);
        const csp = String(res.headers["content-security-policy"] || "");
        assert.match(csp, /script-src[^;]*'unsafe-inline'/);
        assert.doesNotMatch(csp, /upgrade-insecure-requests/i);
        assert.ok(!res.headers["strict-transport-security"], "HSTS must not be set outside production");
        assert.match(
            String(res.headers["referrer-policy"] || ""),
            /strict-origin-when-cross-origin/i,
        );
    });

    it("does not expose server modules via static paths", async function () {
        /* Prefer paths that are not under express.static(assets) to avoid send() ENOENT noise. */
        const paths = [
            "/modules/game/controller.js",
            "/db/database.js",
            "/security/csrfOrigin.js",
            "/app.js",
        ];
        for (const path of paths) {
            const res = await request(app).get(path).redirects(0);
            assert.notStrictEqual(res.status, 200, `${path} must not be served as a static file`);
        }
        const board = await request(app).get("/ChessGame.js").expect(200);
        assert.match(String(board.headers["content-type"] || ""), /javascript|ecmascript|text\/plain/i);
    });

    it("rejects cross-user bookmark delete (IDOR)", async function () {
        const owner = await loginAgent(primary);
        const created = await owner
            .post("/bookmark")
            .send({
                gameState: JSON.stringify({ board: "idor-bookmark" }),
                name: "IDOR Bookmark",
                gameType: "SinglePlayerGame",
                moves: [],
                engine: "brain43",
                depth: 3,
            })
            .expect(200);
        const bookmarkId = created.body._id || created.body.id;
        assert.ok(bookmarkId);

        const stranger = await loginAgent(other);
        const denied = await stranger.post("/deleteBookmark").send({ id: bookmarkId });
        assert.strictEqual(denied.status, 403);

        const stillThere = await owner.get("/bookmark").expect(200);
        assert.ok(
            stillThere.body.some((b) => String(b._id || b.id) === String(bookmarkId)),
            "owner bookmark must remain after stranger delete attempt",
        );

        await owner.post("/deleteBookmark").send({ id: bookmarkId }).expect(200);
    });

    it("rejects stranger delete of another user's finished game (IDOR)", async function () {
        const doc = await Game.create({
            createBy: primary.username,
            createByUserId: primary.id,
            whitePlayer: primary.username,
            blackPlayer: "Brain",
            gameType: "SinglePlayerGame",
            state: "finished",
            result: "1-0",
            reason: "Checkmate",
            isPrivate: false,
            moves: [],
        });

        try {
            const stranger = await loginAgent(other);
            const denied = await stranger.delete("/list/" + doc._id).redirects(0);
            assert.strictEqual(denied.status, 403);

            const still = await Game.findById(doc._id).lean();
            assert.ok(still, "game must still exist after forbidden delete");
        } finally {
            await Game.deleteOne({ _id: doc._id });
        }
    });

    it("forbids strangers from reading private persisted game moves", async function () {
        const doc = await Game.create({
            createBy: primary.username,
            createByUserId: primary.id,
            whitePlayer: primary.username,
            blackPlayer: "SecretOpp",
            gameType: "OnlineGame",
            state: "finished",
            result: "1-0",
            reason: "Resignation",
            isPrivate: true,
            moves: [JSON.stringify({ from: "e2", to: "e4" })],
        });

        try {
            const stranger = await loginAgent(other);
            const denied = await stranger.get("/gameMoves").query({ id: String(doc._id) });
            assert.strictEqual(denied.status, 403);

            const owner = await loginAgent(primary);
            const allowed = await owner.get("/gameMoves").query({ id: String(doc._id) });
            assert.strictEqual(allowed.status, 200);
            assert.ok(allowed.body && Array.isArray(allowed.body.moves));
        } finally {
            await Game.deleteOne({ _id: doc._id });
        }
    });

    it("allows logged-in strangers to read public finished game moves", async function () {
        const doc = await Game.create({
            createBy: primary.username,
            createByUserId: primary.id,
            whitePlayer: primary.username,
            blackPlayer: "PublicOpp",
            gameType: "OnlineGame",
            state: "finished",
            result: "1-0",
            reason: "Checkmate",
            isPrivate: false,
            moves: [JSON.stringify({ from: "e2", to: "e4" })],
        });

        try {
            const stranger = await loginAgent(other);
            const res = await stranger.get("/gameMoves").query({ id: String(doc._id) });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.body.moves));
        } finally {
            await Game.deleteOne({ _id: doc._id });
        }
    });

    it("rejects cross-origin mutating requests when NODE_ENV=production", async function () {
        const prev = Object.prototype.hasOwnProperty.call(process.env, "NODE_ENV")
            ? process.env.NODE_ENV
            : null;
        process.env.NODE_ENV = "production";
        try {
            const res = await request(app)
                .post("/api/login")
                .set("Origin", "https://evil.example")
                .send({ username: primary.username, password: primary.password });
            assert.strictEqual(res.status, 403);
            assert.strictEqual(res.body.ok, false);
        } finally {
            if (prev === null) {
                delete process.env.NODE_ENV;
            } else {
                process.env.NODE_ENV = prev;
            }
        }
    });

    it("rate-limits repeated login posts for the same username", async function () {
        resetWebRateLimits(app);
        const limiters = app.get("rateLimiters");
        assert.ok(limiters && limiters.login, "login rate limiter should be attached");
        const prevMax = limiters.login.max;
        limiters.login.max = 3;
        try {
            let lastStatus = 0;
            for (let i = 0; i < 6; i++) {
                const res = await request(app)
                    .post("/api/login")
                    .send({ username: primary.username, password: "definitely-wrong-password" });
                lastStatus = res.status;
                if (res.status === 429) {
                    break;
                }
            }
            assert.strictEqual(lastStatus, 429);
        } finally {
            limiters.login.max = prevMax;
            resetWebRateLimits(app);
        }
    });

    it("requires login for GET /bookmark", async function () {
        const res = await request(app).get("/bookmark").redirects(0);
        assert.ok(res.status === 302 || res.status === 401);
        if (res.status === 302) {
            assert.match(String(res.headers.location || ""), /login/i);
        }
    });

    it("redirects strangers away from private live /watch without binding session", async function () {
        const gamesManagerService = require("../src/modules/gamesManager/service");
        const privateId = "sec02-private-live";
        const orig = gamesManagerService.getGameById;
        gamesManagerService.getGameById = function (id) {
            if (String(id) === privateId) {
                return {
                    gameId: privateId,
                    isPrivate: true,
                    whitePlayer: { userId: String(primary.id), userName: primary.username },
                    blackPlayer: { userId: "other-seat", userName: "Opp" },
                    createdBy: { userId: String(primary.id) },
                };
            }
            return orig.call(this, id);
        };
        try {
            const stranger = await loginAgent(other);
            const res = await stranger.get("/watch").query({ id: privateId }).redirects(0);
            assert.strictEqual(res.status, 302);
            assert.match(String(res.headers.location || ""), /home/i);
            assert.notStrictEqual(res.headers.location, resolveOnlineWatchHref(privateId));
        } finally {
            gamesManagerService.getGameById = orig;
        }
    });
});
