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
const { normalizeReturnTo } = require("../src/utils");

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

    it("unknown HTML routes render the minimal 404 page", async function () {
        const res = await request(app).get("/definitely-not-a-real-page").expect(404);
        const css = await request(app).get("/error.css").expect(200);

        assert.match(res.text, /class="error-page"/);
        assert.match(res.text, /Page not found/);
        assert.match(res.text, /Error 404/);
        assert.match(res.text, /href="\/home"/);
        assert.match(res.text, /href="\/error\.css"/);
        assert.doesNotMatch(res.text, /Page not found: \/definitely-not-a-real-page/);
        assert.match(String(css.headers["content-type"] || ""), /text\/css/);
        assert.match(css.text, /\.error-page/);
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

    it("POST /api/login returns the redirect target and starts a session", async function () {
        const agent = request.agent(app);

        const res = await agent
            .post("/api/login")
            .send({ username: primary.username, password: primary.password })
            .expect(200);

        assert.strictEqual(res.body.ok, true);
        assert.match(String(res.body.redirectUrl || ""), /^\/[^/]/);

        const home = await agent.get("/home").expect(200);
        assert.match(home.text, /startAIGame/);
    });

    it("unauthenticated API requests return 401 and do not replace the login destination", async function () {
        const agent = request.agent(app);

        const apiRes = await agent.get("/api/friends/data").redirects(0).expect(401);
        assert.strictEqual(apiRes.body.ok, false);
        assert.strictEqual(apiRes.headers.location, undefined);

        const loginRes = await agent
            .post("/api/login")
            .send({ username: primary.username, password: primary.password })
            .expect(200);

        assert.strictEqual(loginRes.body.redirectUrl, "/Home");
    });

    it("unauthenticated /active-games poll returns 401 and does not become the login destination", async function () {
        const agent = request.agent(app);

        await agent.get("/home").redirects(0).expect(302);

        const poll = await agent
            .get("/active-games?limit=3&includeBoard=1")
            .set("Sec-Fetch-Dest", "empty")
            .redirects(0)
            .expect(401);
        assert.strictEqual(poll.body.ok, false);
        assert.strictEqual(poll.headers.location, undefined);

        const loginRes = await agent
            .post("/api/login")
            .send({ username: primary.username, password: primary.password })
            .expect(200);

        assert.strictEqual(loginRes.body.redirectUrl, "/home");
    });

    it("rejects stale API and cross-origin login destinations", function () {
        assert.strictEqual(normalizeReturnTo("/api/friends/data"), "/Home");
        assert.strictEqual(normalizeReturnTo("/app/api/custom-themes?x=1"), "/Home");
        assert.strictEqual(normalizeReturnTo("/active-games?limit=3&includeBoard=1"), "/Home");
        assert.strictEqual(normalizeReturnTo("//example.com/path"), "/Home");
        assert.strictEqual(normalizeReturnTo("/friends?tab=pending"), "/friends?tab=pending");
    });

    it("POST /api/login with wrong password returns 401 without a session", async function () {
        const agent = request.agent(app);

        const res = await agent
            .post("/api/login")
            .send({ username: primary.username, password: "not-the-password" })
            .expect(401);
        assert.strictEqual(res.body.ok, false);

        const home = await agent.get("/home").redirects(0);
        assert.strictEqual(home.status, 302);
        assert.ok(String(home.headers.location || "").includes("/login"));
    });

    it("POST /api/login rejects non-string credentials", async function () {
        const res = await request(app)
            .post("/api/login")
            .send({ username: { $ne: null }, password: { $ne: null } })
            .expect(401);
        assert.strictEqual(res.body.ok, false);
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
        assert.match(homeRes.text, /startPlayFromHome/);
        assert.doesNotMatch(homeRes.text, /id="playNowForm"/);
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
        assert.match(res.text, /onlineMode\.js/);
        assert.match(res.text, /wsTransport\.js/);
        assert.match(res.text, /onlineProtocol\.js/);
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

    it("POST /api/play/sp-game creates a public SP game visible in /active-games", async function () {
        const agent = await loginAgent();
        const created = await agent
            .post("/api/play/sp-game")
            .send({
                color: "white",
                engine: "brain43",
                difficulty: 2,
                timeMinutes: 15,
                isPrivate: false,
            })
            .expect(200);
        assert.strictEqual(created.body.ok, true);
        assert.ok(created.body.gameId);
        assert.strictEqual(created.body.isPrivate, false);

        const list = await agent.get("/active-games?limit=50").expect(200);
        const rows = Array.isArray(list.body) ? list.body : [];
        const found = rows.some(function (g) {
            return String(g.Id || g.gameId || "") === String(created.body.gameId);
        });
        assert.ok(found, "public Prefer-Play SP game should appear in active-games");

        const privateGame = await agent
            .post("/api/play/sp-game")
            .send({
                color: "white",
                engine: "brain43",
                isPrivate: true,
            })
            .expect(200);
        assert.strictEqual(privateGame.body.ok, true);
        assert.strictEqual(privateGame.body.isPrivate, true);
        const list2 = await agent.get("/active-games?limit=50").expect(200);
        const rows2 = Array.isArray(list2.body) ? list2.body : [];
        const privateFound = rows2.some(function (g) {
            return String(g.Id || g.gameId || "") === String(privateGame.body.gameId);
        });
        assert.ok(!privateFound, "private Prefer-Play SP game must not appear in active-games");
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

    it("friend invite can be withdrawn by sender", async function () {
        const { User } = require("../src/modules/user/model");
        await User.updateOne(
            { _id: primary.id },
            { $set: { friends: [], friendInvitesSent: [], friendInvitesReceived: [] } }
        );
        await User.updateOne(
            { _id: other.id },
            { $set: { friends: [], friendInvitesSent: [], friendInvitesReceived: [] } }
        );

        const a = await loginAgent(primary);
        await a.post("/api/friends/invite").send({ targetUserId: other.id }).expect(200);

        const pending = await a.get("/api/friends/data").expect(200);
        assert.ok(
            (pending.body.friends || []).some(
                (f) => f && f.id === other.id && f.rowType === "pendingOut"
            ),
            "expected pending outgoing invite"
        );

        await a.post("/api/friends/withdraw").send({ targetUserId: other.id }).expect(200);
        const after = await a.get("/api/friends/data").expect(200);
        assert.ok(
            !(after.body.friends || []).some((f) => f && f.id === other.id),
            "expected pending invite withdrawn"
        );
    });

    it("protected JSON/API endpoints without session return 401 JSON", async function () {
        const paths = [
            "/api/friends/data",
            "/api/friends/playing-usernames",
            "/api/play/launch-context",
            "/app/api/ui-settings",
            "/app/api/custom-themes",
            "/active-games?limit=3&includeBoard=1",
            "/gameInfo",
            "/gameMoves",
        ];
        for (const path of paths) {
            const res = await request(app).get(path).redirects(0);
            assert.strictEqual(res.status, 401, path);
            assert.strictEqual(res.body.ok, false, path);
            assert.strictEqual(res.headers.location, undefined, path);
        }
    });

    it("bookmark lifecycle: create, list, update, delete", async function () {
        const agent = await loginAgent();

        const created = await agent
            .post("/bookmark")
            .send({
                gameState: JSON.stringify({ board: "test-state" }),
                name: "E2E Bookmark",
                gameType: "SinglePlayerGame",
                moves: [],
                engine: "brain43",
                depth: 3,
            })
            .expect(200);
        assert.ok(created.body && (created.body._id || created.body.id), "expected bookmark id");
        assert.strictEqual(created.body.name, "E2E Bookmark");
        const bookmarkId = created.body._id || created.body.id;

        const list = await agent.get("/bookmark").expect(200);
        assert.ok(
            list.body.some((b) => String(b._id || b.id) === String(bookmarkId)),
            "expected created bookmark in list"
        );

        const updated = await agent
            .post("/updateBookmark")
            .send({ id: bookmarkId, name: "E2E Bookmark Renamed" })
            .expect(200);
        assert.match(updated.text, /OK/);

        const afterUpdate = await agent.get("/bookmark").expect(200);
        const found = afterUpdate.body.find((b) => String(b._id || b.id) === String(bookmarkId));
        assert.ok(found, "expected bookmark still present after update");
        assert.strictEqual(found.name, "E2E Bookmark Renamed");

        const deleted = await agent
            .post("/deleteBookmark")
            .send({ id: bookmarkId })
            .expect(200);
        assert.match(deleted.text, /OK/);

        const afterDelete = await agent.get("/bookmark").expect(200);
        assert.ok(
            !afterDelete.body.some((b) => String(b._id || b.id) === String(bookmarkId)),
            "expected bookmark removed from list"
        );
    });

    it("bookmark create normalizes unknown engine to brain43", async function () {
        const agent = await loginAgent();
        const created = await agent
            .post("/bookmark")
            .send({
                gameState: JSON.stringify({ board: "x" }),
                name: "Engine Norm",
                gameType: "SinglePlayerGame",
                engine: "totally-bogus",
                depth: 99,
            })
            .expect(200);
        assert.strictEqual(created.body.engine, "brain43");
        assert.strictEqual(created.body.depth, 3);
        // cleanup
        await agent.post("/deleteBookmark").send({ id: created.body._id || created.body.id });
    });

    it("UI settings round-trip (/app/api/ui-settings)", async function () {
        const agent = await loginAgent();

        const initial = await agent.get("/app/api/ui-settings").expect(200);
        assert.ok(initial.body && typeof initial.body === "object");
        assert.ok(initial.body.gamePreferences && typeof initial.body.gamePreferences === "object");

        const saved = await agent
            .post("/app/api/ui-settings")
            .send({
                pieceSet: "ember-regalia",
                dockPanels: { leftCollapsed: false },
                gamePreferences: { showAvailableMoves: false },
            })
            .expect(200);
        assert.strictEqual(saved.body.pieceSet, "ember-regalia");
        assert.strictEqual(saved.body.dockPanels.leftCollapsed, false);
        assert.strictEqual(saved.body.gamePreferences.showAvailableMoves, false);

        const reread = await agent.get("/app/api/ui-settings").expect(200);
        assert.strictEqual(reread.body.pieceSet, "ember-regalia");
        assert.strictEqual(reread.body.gamePreferences.showAvailableMoves, false);
    });

    it("UI settings normalizes an invalid piece set", async function () {
        const agent = await loginAgent();
        const saved = await agent
            .post("/app/api/ui-settings")
            .send({ pieceSet: "not-a-real-set" })
            .expect(200);
        assert.notStrictEqual(saved.body.pieceSet, "not-a-real-set");
        assert.ok(typeof saved.body.pieceSet === "string" && saved.body.pieceSet.length > 0);
    });

    it("custom themes GET returns a store with active theme", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/app/api/custom-themes").expect(200);
        assert.ok(res.body && typeof res.body === "object");
        assert.ok(typeof res.body.activeTheme === "string");
        assert.ok(Array.isArray(res.body.themes));
    });

    it("custom themes save persists the active theme", async function () {
        const agent = await loginAgent();
        const saved = await agent
            .post("/app/api/custom-themes")
            .send({ activeTheme: "green", themes: [] })
            .expect(200);
        assert.ok(saved.body && typeof saved.body === "object");
        assert.ok(Array.isArray(saved.body.themes));
    });

    it("member is forbidden from brain-config (advanced tool)", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/brain-config").query({ engine: "brain43" }).redirects(0);
        assert.strictEqual(res.status, 403);
    });

    it("GET /gameMoves without an active game redirects home", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/gameMoves").redirects(0);
        assert.strictEqual(res.status, 302);
        assert.match(String(res.headers.location || ""), /\/home/i);
    });

    it("GET /gameInfo without id returns 400", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/gameInfo").redirects(0);
        assert.strictEqual(res.status, 400);
    });

    it("last-game-options normalizes an invalid engine to brain43", async function () {
        const agent = await loginAgent();
        const res = await agent
            .post("/api/play/last-game-options")
            .send({ color: "white", engine: "not-real", difficulty: 999, timeMinutes: 9999 })
            .expect(200);
        assert.strictEqual(res.body.ok, true);
        assert.strictEqual(res.body.lastGameOptions.engine, "brain43");
        assert.strictEqual(res.body.lastGameOptions.difficulty, 3);
        assert.strictEqual(res.body.lastGameOptions.timeMinutes, 90);
    });

    it("friend invite to self is rejected", async function () {
        const agent = await loginAgent();
        const res = await agent
            .post("/api/friends/invite")
            .send({ targetUserId: primary.id })
            .redirects(0);
        assert.ok(res.status >= 400, `expected error status, got ${res.status}`);
        assert.ok(res.body.ok === false || /yourself/i.test(res.body.message || ""));
    });

    it("friend accept with no pending invite is rejected", async function () {
        const { User } = require("../src/modules/user/model");
        await User.updateOne(
            { _id: primary.id },
            { $set: { friends: [], friendInvitesSent: [], friendInvitesReceived: [] } }
        );
        const agent = await loginAgent();
        const res = await agent
            .post("/api/friends/accept")
            .send({ fromUserId: other.id })
            .redirects(0);
        assert.ok(res.status >= 400, `expected error status, got ${res.status}`);
    });

    it("game-invite without targetUserId returns 400", async function () {
        const agent = await loginAgent();
        const res = await agent.post("/api/friends/game-invite").send({}).expect(400);
        assert.ok(res.body.ok === false || /targetUserId/i.test(res.body.message || ""));
    });

    it("GET /mobile-home with a mobile UA returns the mobile welcome page", async function () {
        const agent = await loginAgent();
        const res = await agent
            .get("/mobile-home")
            .set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")
            .expect(200);
        assert.ok(res.text.length > 0);
    });

    it("login is case-insensitive for the username", async function () {
        const agent = request.agent(app);
        const res = await agent
            .post("/login")
            .type("form")
            .send({ username: primary.username.toUpperCase(), password: primary.password })
            .redirects(0);
        assert.strictEqual(res.status, 302);
        assert.match(String(res.headers.location || ""), /\/[Hh]ome/);
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

    it("authenticated GET /game?newGame vs computer redirects to /play (Phase 10)", async function () {
        const agent = await loginAgent();

        const gameUrl =
            "/game?gameType=1&newGame=1&color=white&engine=brain43&difficulty=1&mouse=drag&showMoves=1&timeMinutes=90";
        const res = await agent.get(gameUrl).redirects(0);
        assert.strictEqual(res.status, 302);
        assert.match(String(res.headers.location || ""), /\/play\?/);
        assert.match(String(res.headers.location || ""), /newGame=1/);
    });

    it("authenticated GET /game?classic=1 without gameType starts classic SP", async function () {
        const agent = await loginAgent();
        const res = await agent.get("/game?classic=1").redirects(0);
        assert.strictEqual(res.status, 302);
        assert.match(
            String(res.headers.location || ""),
            /\/game\?classic=1&gameType=1&newGame=1/,
        );
    });

    it("authenticated GET /game?classic=1&newGame still uses classic create path", async function () {
        const agent = await loginAgent();

        const gameUrl =
            "/game?classic=1&gameType=1&newGame=1&color=white&engine=brain43&difficulty=1&mouse=drag&showMoves=1&timeMinutes=90";
        const res = await agent.get(gameUrl).redirects(0);
        assert.strictEqual(res.status, 302);
        assert.match(String(res.headers.location || ""), /\/game\?id=/);
        assert.match(String(res.headers.location || ""), /classic=1/);
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
