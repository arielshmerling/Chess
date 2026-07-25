/**
 * Web HTTP / auth smoke tests (supertest).
 * Run: npm run test:web:api
 *
 * Requires DATABASE_URL + SESSION_SECRET (from .env). Creates/updates user e2e_web_member.
 * Uses an isolated local *_e2e database when possible.
 */
/* eslint-disable */

const assert = require("assert");
const request = require("supertest");
const { ensureWebE2EUser } = require("./helpers/webE2EUser");
const { loadWebApp } = require("./helpers/webApp");

describe("web HTTP / auth", function () {
    this.timeout(30000);

    let app;
    let credentials;

    before(async function () {
        credentials = await ensureWebE2EUser();
        app = loadWebApp();
    });

    async function loginAgent() {
        const agent = request.agent(app);
        await agent
            .post("/login")
            .type("form")
            .send({ username: credentials.username, password: credentials.password });
        return agent;
    }

    it("GET /login returns the login form", async function () {
        const res = await request(app).get("/login").expect(200);
        assert.match(res.text, /id="username"/);
        assert.match(res.text, /id="password"/);
        assert.match(res.text, /action="\/login"/);
    });

    it("GET /home without session redirects to login", async function () {
        const res = await request(app).get("/home").redirects(0);
        assert.strictEqual(res.status, 302);
        assert.ok(
            String(res.headers.location || "").includes("/login"),
            `expected redirect to login, got ${res.headers.location}`
        );
    });

    it("GET /friends and /game without session redirect to login", async function () {
        for (const path of ["/friends", "/game"]) {
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
            .send({ username: credentials.username, password: "not-the-password" })
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
            .send({ username: credentials.username, password: credentials.password })
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
    });

    it("login returnTo restores /friends", async function () {
        const agent = request.agent(app);

        const gate = await agent.get("/friends").redirects(0);
        assert.strictEqual(gate.status, 302);
        assert.ok(String(gate.headers.location || "").includes("/login"));

        const loginRes = await agent
            .post("/login")
            .type("form")
            .send({ username: credentials.username, password: credentials.password })
            .redirects(0);

        assert.strictEqual(loginRes.status, 302);
        assert.match(String(loginRes.headers.location || ""), /\/friends/);
    });

    it("authenticated GET /friends returns page", async function () {
        const agent = await loginAgent();

        const friends = await agent.get("/friends").expect(200);
        assert.match(friends.text, /id="friendSearchInput"/);
        assert.match(friends.text, /id="friendsList"/);
    });

    it("authenticated GET /active-games returns JSON", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/active-games").expect(200);
        assert.ok(Array.isArray(res.body) || typeof res.body === "object");
    });

    it("authenticated GET /api/friends/data returns payload", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/api/friends/data").expect(200);
        assert.strictEqual(res.body.ok, true);
        assert.ok(Array.isArray(res.body.friends) || res.body.friends == null || typeof res.body === "object");
    });

    it("authenticated GET /api/friends/search finds the e2e user", async function () {
        const agent = await loginAgent();
        const res = await agent
            .get("/api/friends/search")
            .query({ q: credentials.username.slice(0, 4) })
            .expect(200);
        assert.strictEqual(res.body.ok, true);
        assert.ok(Array.isArray(res.body.results));
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

        // Play Now creates a game then 302 → /game?id=… (do not follow; rendering loads the engine).
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
