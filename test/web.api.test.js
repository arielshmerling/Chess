/**
 * Web HTTP / auth smoke tests (supertest).
 * Run: npm run test:web:api
 *
 * Requires DATABASE_URL + SESSION_SECRET (from .env).
 * Uses an isolated local *_e2e database when possible.
 */
/* eslint-disable */

const assert = require("assert");
const request = require("supertest");
const { ensureWebE2EUsers } = require("./helpers/webE2EUser");
const { loadWebApp } = require("./helpers/webApp");

describe("web HTTP / auth", function () {
    this.timeout(30000);

    let app;
    let primary;
    let other;

    before(async function () {
        const users = await ensureWebE2EUsers();
        primary = users.primary;
        other = users.other;
        app = loadWebApp();
    });

    async function loginAgent(creds = primary) {
        const agent = request.agent(app);
        await agent
            .post("/login")
            .type("form")
            .send({ username: creds.username, password: creds.password });
        return agent;
    }

    it("GET / and /login return the login form", async function () {
        for (const path of ["/", "/login"]) {
            const res = await request(app).get(path).expect(200);
            assert.match(res.text, /id="username"/);
            assert.match(res.text, /id="password"/);
            assert.match(res.text, /action="\/login"/);
        }
    });

    it("GET /home without session redirects to login", async function () {
        const res = await request(app).get("/home").redirects(0);
        assert.strictEqual(res.status, 302);
        assert.ok(
            String(res.headers.location || "").includes("/login"),
            `expected redirect to login, got ${res.headers.location}`
        );
    });

    it("protected pages without session redirect to login", async function () {
        // Prefer /play/ — bare /play is redirected 301 by static middleware (src/play/ directory).
        for (const path of ["/friends", "/game", "/play/", "/list", "/active-games-list"]) {
            const res = await request(app).get(path).redirects(0);
            assert.strictEqual(res.status, 302, path);
            assert.ok(
                String(res.headers.location || "").includes("/login"),
                `${path} expected redirect to login, got ${res.headers.location}`
            );
        }
    });

    it("POST /login with wrong password redirects back to login", async function () {
        const res = await request(app)
            .post("/login")
            .type("form")
            .send({ username: primary.username, password: "not-the-password" })
            .redirects(0);

        assert.strictEqual(res.status, 302);
        assert.ok(
            String(res.headers.location || "").includes("/login"),
            `expected redirect to login, got ${res.headers.location}`
        );
    });

    it("POST /login then GET /home reaches welcome (Play Now)", async function () {
        const agent = request.agent(app);

        const loginRes = await agent
            .post("/login")
            .type("form")
            .send({ username: primary.username, password: primary.password })
            .redirects(0);

        assert.strictEqual(loginRes.status, 302);
        const location = String(loginRes.headers.location || "");
        assert.ok(
            /\/[Hh]ome/.test(location),
            `expected redirect to home, got ${location}`
        );

        const homeRes = await agent.get("/home").expect(200);
        assert.match(homeRes.text, /id="startAIGame"/);
        assert.match(homeRes.text, /id="playNowForm"/);
        assert.match(homeRes.text, /id="online-games-container"/);
    });

    it("login returnTo restores /friends", async function () {
        const agent = request.agent(app);

        const gate = await agent.get("/friends").redirects(0);
        assert.strictEqual(gate.status, 302);
        assert.ok(String(gate.headers.location || "").includes("/login"));

        const loginRes = await agent
            .post("/login")
            .type("form")
            .send({ username: primary.username, password: primary.password })
            .redirects(0);

        assert.strictEqual(loginRes.status, 302);
        assert.match(String(loginRes.headers.location || ""), /\/friends/);
    });

    it("GET /validateUsername reports FOUND and NOT FOUND", async function () {
        const found = await request(app)
            .get("/validateUsername")
            .query({ username: primary.username })
            .expect(200);
        assert.strictEqual(found.text, "FOUND USER");

        const missing = await request(app)
            .get("/validateUsername")
            .query({ username: "no_such_user_zzzz" })
            .expect(200);
        assert.strictEqual(missing.text, "NOT FOUND");
    });

    it("authenticated GET /friends returns page", async function () {
        const agent = await loginAgent();

        const friends = await agent.get("/friends").expect(200);
        assert.match(friends.text, /id="friendSearchInput"/);
        assert.match(friends.text, /id="friendsList"/);
    });

    it("authenticated GET /active-games-list and /list return pages", async function () {
        const agent = await loginAgent();

        const active = await agent.get("/active-games-list").expect(200);
        assert.match(active.text, /Active games|Live games/i);

        const list = await agent.get("/list").expect(200);
        assert.match(list.text, /All Games|PlayerGameList/i);
    });

    it("authenticated GET /play returns the Play shell", async function () {
        const agent = await loginAgent();
        // Follow the static 301 /play → /play/ (directory), then the Play route.
        const res = await agent.get("/play/").expect(200);
        assert.match(res.text, /desktopPlayWhiteName|desktop-play|id="chessboard"/i);
    });

    it("authenticated GET /api/play/launch-context returns prefs payload", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/api/play/launch-context").expect(200);
        assert.strictEqual(res.body.ok, true);
        assert.strictEqual(res.body.username, primary.username);
        assert.ok(typeof res.body.userType === "string");
    });

    it("authenticated POST /api/play/last-game-options persists options", async function () {
        const agent = await loginAgent();
        const res = await agent
            .post("/api/play/last-game-options")
            .send({
                color: "black",
                engine: "brain42",
                difficulty: 2,
                mouse: "drag",
                showAvailableMoves: true,
                timeMinutes: 30,
                isPrivate: true,
            })
            .expect(200);
        assert.strictEqual(res.body.ok, true);
        assert.strictEqual(res.body.lastGameOptions.color, "black");
        assert.strictEqual(res.body.lastGameOptions.engine, "brain42");
        assert.strictEqual(res.body.lastGameOptions.difficulty, 2);
        assert.strictEqual(res.body.lastGameOptions.timeMinutes, 30);
        assert.strictEqual(res.body.lastGameOptions.isPrivate, true);
    });

    it("authenticated GET /active-games returns JSON", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/active-games").expect(200);
        assert.ok(Array.isArray(res.body) || typeof res.body === "object");
    });

    it("authenticated GET /bookmark returns a list", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/bookmark").expect(200);
        assert.ok(Array.isArray(res.body));
    });

    it("authenticated POST /api/presence/ping succeeds", async function () {
        const agent = await loginAgent();
        const res = await agent.post("/api/presence/ping").expect(200);
        assert.strictEqual(res.body.ok, true);
    });

    it("authenticated GET /api/friends/data returns payload", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/api/friends/data").expect(200);
        assert.strictEqual(res.body.ok, true);
        assert.ok(Array.isArray(res.body.friends) || res.body.friends == null || typeof res.body === "object");
    });

    it("authenticated GET /api/friends/playing-usernames returns list", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/api/friends/playing-usernames").expect(200);
        assert.strictEqual(res.body.ok, true);
        assert.ok(Array.isArray(res.body.usernames));
    });

    it("authenticated GET /api/friends/search finds the other e2e user", async function () {
        const agent = await loginAgent();
        const res = await agent
            .get("/api/friends/search")
            .query({ q: "e2e" })
            .expect(200);
        assert.strictEqual(res.body.ok, true);
        assert.ok(Array.isArray(res.body.results));
        assert.ok(
            res.body.results.some((u) => u && u.username === other.username),
            `expected to find ${other.username} in ${JSON.stringify(res.body.results)}`
        );
    });

    it("friend invite without targetUserId returns 400", async function () {
        const agent = await loginAgent();
        const res = await agent.post("/api/friends/invite").send({}).expect(400);
        assert.ok(res.body.ok === false || /targetUserId/i.test(res.body.message || ""));
    });

    it("friend invite + accept + remove between e2e users", async function () {
        const { User } = require("../src/modules/user/model");
        // Reset relationship without hitting erroring HTTP cleanup endpoints.
        await User.updateOne(
            { _id: primary.id },
            { $set: { friends: [], friendInvitesSent: [], friendInvitesReceived: [] } }
        );
        await User.updateOne(
            { _id: other.id },
            { $set: { friends: [], friendInvitesSent: [], friendInvitesReceived: [] } }
        );

        const a = await loginAgent(primary);
        const b = await loginAgent(other);

        await a.post("/api/friends/invite").send({ targetUserId: other.id }).expect(200);
        await b.post("/api/friends/accept").send({ fromUserId: primary.id }).expect(200);

        const data = await a.get("/api/friends/data").expect(200);
        assert.ok(
            (data.body.friends || []).some((f) => f && f.id === other.id),
            "expected other user in friends list after accept"
        );

        await a.post("/api/friends/remove").send({ friendUserId: other.id }).expect(200);
        const after = await a.get("/api/friends/data").expect(200);
        assert.ok(
            !(after.body.friends || []).some((f) => f && f.id === other.id),
            "expected friend removed"
        );
    });

    it("member is blocked from /admin and /register", async function () {
        const agent = await loginAgent();
        for (const path of ["/admin", "/register"]) {
            const res = await agent.get(path).redirects(0);
            assert.strictEqual(res.status, 302, path);
            assert.ok(
                String(res.headers.location || "").includes("/login"),
                `${path} expected redirect to login, got ${res.headers.location}`
            );
        }
    });

    it("authenticated GET /game?newGame vs computer redirects to /game?id=", async function () {
        const agent = await loginAgent();

        // Classic /game create path (do not follow; rendering loads the engine).
        const gameUrl =
            "/game?gameType=1&newGame=1&color=white&engine=brain43&difficulty=1&mouse=drag&showMoves=1&timeMinutes=90";
        const res = await agent.get(gameUrl).redirects(0);
        assert.strictEqual(res.status, 302);
        assert.match(String(res.headers.location || ""), /\/game\?id=/);
    });

    it("GET /logout then /home redirects to login again", async function () {
        const agent = await loginAgent();

        await agent.get("/logout").redirects(0).expect(302);

        const homeRes = await agent.get("/home").redirects(0);
        assert.strictEqual(homeRes.status, 302);
        assert.ok(
            String(homeRes.headers.location || "").includes("/login"),
            `expected redirect to login, got ${homeRes.headers.location}`
        );
    });
});
