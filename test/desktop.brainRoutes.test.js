/**
 * Desktop Express routes — brain HTTP fallback + static client assets.
 */
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const request = require("supertest");
const {
    createDesktopTestRuntime,
    destroyDesktopTestRuntime,
} = require("./helpers/desktopRuntime");

const APP_DESKTOP_PATH = path.resolve(__dirname, "../src/app-desktop.js");
const ROUTES_PATH = path.resolve(__dirname, "../src/desktop/routes.js");
const CONFIGURE_PATH = path.resolve(__dirname, "../src/desktop/configureApp.js");

function clearAppCache() {
    delete require.cache[APP_DESKTOP_PATH];
    delete require.cache[ROUTES_PATH];
    delete require.cache[CONFIGURE_PATH];
}

describe("desktop brain HTTP routes", function () {
    let tempDir;
    let app;

    before(function () {
        const runtime = createDesktopTestRuntime();
        tempDir = runtime.tempDir;
        process.env.SESSION_SECRET = process.env.SESSION_SECRET || "desktop-brain-route-test";
        clearAppCache();
        app = require("../src/app-desktop");
    });

    after(function () {
        clearAppCache();
        destroyDesktopTestRuntime(tempDir);
    });

    it("serves a11y client modules used by play.html", async function () {
        const res = await request(app).get("/a11y/bindUiActions.js").expect(200);
        assert.ok(String(res.text).includes("ShmerlingBindUiActions"));
        await request(app).get("/a11y/focusTrap.js").expect(200);
        await request(app).get("/a11y/enhanceClickables.js").expect(200);
        await request(app).get("/a11y.css").expect(200);
    });

    it("mounts POST /api/brain/compute-move (not 404)", async function () {
        const agent = request.agent(app);
        /* Establish guest session cookie via a page that runs ensureGuestSession. */
        await agent.get("/app/play").expect(200);
        const res = await agent
            .post("/api/brain/compute-move")
            .set("Content-Type", "application/json")
            .send({});
        assert.notStrictEqual(
            res.status,
            404,
            "desktop must mount /api/brain/compute-move for BrainHttp fallback",
        );
        assert.strictEqual(res.status, 400);
        assert.ok(res.body && res.body.ok === false);
    });

    it("mounts POST /api/brain/abort-search", async function () {
        const agent = request.agent(app);
        await agent.get("/app/play").expect(200);
        const res = await agent
            .post("/api/brain/abort-search")
            .set("Content-Type", "application/json")
            .send({});
        assert.notStrictEqual(res.status, 404);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body && res.body.ok, true);
    });

    it("lists Play engines including stockfish when available", async function () {
        const agent = request.agent(app);
        await agent.get("/app/play").expect(200);
        const res = await agent.get("/app/api/play-engines").expect(200);
        assert.strictEqual(res.body && res.body.ok, true);
        assert.ok(Array.isArray(res.body.engines));
        const ids = res.body.engines.map(function (e) {
            return e.id;
        });
        assert.ok(ids.indexOf("brain43") !== -1);
        assert.ok(ids.indexOf("stockfish") !== -1);
    });
});

describe("stage-app-bundle play.html asset mapping", function () {
    it("maps a11y URLs into the staged src/a11y tree", function () {
        const verifyPath = path.join(__dirname, "../scripts/verify-desktop-bundle.js");
        const src = fs.readFileSync(verifyPath, "utf8");
        assert.ok(src.includes('clean.startsWith("/a11y/")'));
        assert.ok(src.includes("assertPlayHtmlClientAssets"));
        assert.ok(
            fs.existsSync(path.join(__dirname, "../src/a11y/bindUiActions.js")),
            "source a11y module must exist for staging",
        );
    });
});
