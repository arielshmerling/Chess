/**
 * Web custom-theme store round-trip (supertest).
 * Run: mocha --exit --require ./test/_teardownWorkers.js ./test/webCustomThemes.api.test.js
 *
 * Requires DATABASE_URL + SESSION_SECRET (from .env).
 */
/* eslint-disable */

const assert = require("assert");
const request = require("supertest");
const {
    ensureWebE2EUsers,
    ensureWebE2EPartner,
    ensureWebE2EAdmin,
} = require("./helpers/webE2EUser");
const { loadWebApp, resetWebRateLimits } = require("./helpers/webApp");
const { createSeedThemeEntries } = require("../src/desktop/themeSchema");

const THEMES_URL = "/app/api/custom-themes";

describe("web custom themes API", function () {
    this.timeout(30000);
    this.retries(2);

    let app;
    let primary;
    let partner;
    let admin;

    before(async function () {
        const users = await ensureWebE2EUsers();
        primary = users.primary;
        partner = await ensureWebE2EPartner();
        admin = await ensureWebE2EAdmin();
        app = loadWebApp();
        resetWebRateLimits(app);

        /*
         * Prior runs can leave Dark (and other seeds) in themeCatalog.hiddenThemeIds,
         * which yields a one-theme catalog and breaks activeTheme switch coverage.
         * Republish Blue + Dark so this suite is independent of leftover E2E DB state.
         */
        const adminAgent = await loginAgent(admin);
        const seeds = createSeedThemeEntries();
        await adminAgent
            .post(THEMES_URL)
            .send({ activeTheme: "custom:blue", themes: seeds })
            .expect(200);
    });

    async function loginAgent(creds) {
        resetWebRateLimits(app);
        const agent = request.agent(app);
        await agent
            .post("/login")
            .type("form")
            .send({ username: creds.username, password: creds.password });
        return agent;
    }

    function findTheme(store, id) {
        return (store.themes || []).find(function (t) {
            return t.id === id;
        });
    }

    it("member can change activeTheme but cannot create themes", async function () {
        const agent = await loginAgent(primary);
        const before = (await agent.get(THEMES_URL).expect(200)).body;
        const nextTheme = before.themes.find(function (theme) {
            return "custom:" + theme.id !== before.activeTheme;
        });
        assert.ok(nextTheme, "at least two themes should be available");
        const nextActive = "custom:" + nextTheme.id;
        const id = "custom-member-denied-" + Date.now().toString(36);

        const res = await agent
            .post(THEMES_URL)
            .send({
                activeTheme: nextActive,
                themes: before.themes.concat([
                    {
                        id: id,
                        name: "Should not persist",
                        vars: { "--body-background": "#111111" },
                        updatedAt: Date.now(),
                    },
                ]),
            })
            .expect(200);

        assert.strictEqual(res.body.activeTheme, nextActive);
        assert.ok(!findTheme(res.body, id), "member must not create themes");

        const after = (await agent.get(THEMES_URL).expect(200)).body;
        assert.strictEqual(after.activeTheme, nextActive);
        assert.ok(!findTheme(after, id));
    });

    it("partner can change activeTheme but cannot create themes", async function () {
        const agent = await loginAgent(partner);
        const before = (await agent.get(THEMES_URL).expect(200)).body;
        assert.ok(Array.isArray(before.themes) && before.themes.length > 0, "catalog should not be empty");
        const id = "custom-partner-denied-" + Date.now().toString(36);
        const nextActive = before.activeTheme || ("custom:" + before.themes[0].id);

        const res = await agent
            .post(THEMES_URL)
            .send({
                activeTheme: nextActive,
                themes: before.themes.concat([
                    {
                        id: id,
                        name: "Partner should not persist",
                        vars: { "--body-background": "#222222" },
                        updatedAt: Date.now(),
                    },
                ]),
            })
            .expect(200);

        assert.strictEqual(res.body.activeTheme, nextActive);
        assert.ok(!findTheme(res.body, id), "partner must not create themes");
    });

    it("admin persists a newly created theme", async function () {
        const agent = await loginAgent(admin);
        const before = (await agent.get(THEMES_URL).expect(200)).body;

        const id = "custom-test-" + Date.now().toString(36);
        const created = {
            id: id,
            name: "Round trip",
            vars: { "--body-background": "#123456" },
            updatedAt: Date.now(),
        };
        try {
            await agent
                .post(THEMES_URL)
                .send({ activeTheme: before.activeTheme, themes: before.themes.concat([created]) })
                .expect(200);

            const after = (await agent.get(THEMES_URL).expect(200)).body;
            const saved = findTheme(after, id);
            assert.ok(saved, "new theme should be returned by GET");
            assert.strictEqual(saved.vars["--body-background"], "#123456");

            const other = await loginAgent(primary);
            const otherView = (await other.get(THEMES_URL).expect(200)).body;
            const shared = findTheme(otherView, id);
            assert.ok(shared, "other users must see the admin-published theme");
            assert.strictEqual(shared.vars["--body-background"], "#123456");
        } finally {
            await agent.post(THEMES_URL).send(before);
        }
    });

    it("admin keeps a deleted seeded theme deleted", async function () {
        const agent = await loginAgent(admin);
        let before = (await agent.get(THEMES_URL).expect(200)).body;
        let seeded = findTheme(before, "blue");
        if (!seeded) {
            // Prior runs may have left Blue hidden; restore the seed before asserting delete.
            const seedBlue = createSeedThemeEntries().find(function (theme) {
                return theme.id === "blue";
            });
            assert.ok(seedBlue, "seed catalog must include Blue");
            await agent
                .post(THEMES_URL)
                .send({
                    activeTheme: before.activeTheme || "custom:blue",
                    themes: (before.themes || []).concat([seedBlue]),
                })
                .expect(200);
            before = (await agent.get(THEMES_URL).expect(200)).body;
            seeded = findTheme(before, "blue");
        }
        assert.ok(seeded, "Blue should be an ordinary seeded catalog theme");

        try {
            await agent
                .post(THEMES_URL)
                .send({
                    activeTheme: before.activeTheme,
                    themes: before.themes.filter(function (t) {
                        return t.id !== seeded.id;
                    }),
                })
                .expect(200);

            const after = (await agent.get(THEMES_URL).expect(200)).body;
            assert.ok(!findTheme(after, seeded.id), "deleted seeded theme should stay deleted");
            assert.strictEqual(
                after.themes.length,
                before.themes.length - 1,
                "other themes should survive the delete",
            );
        } finally {
            // Re-sending the full original list restores the theme for later runs.
            await agent.post(THEMES_URL).send(before);
        }

        const restored = (await agent.get(THEMES_URL).expect(200)).body;
        assert.ok(findTheme(restored, seeded.id), "restoring the full list brings it back");
    });

    it("admin can delete every theme and restore the catalog", async function () {
        const agent = await loginAgent(admin);
        const before = (await agent.get(THEMES_URL).expect(200)).body;

        try {
            const deleted = await agent
                .post(THEMES_URL)
                .send({ activeTheme: before.activeTheme, themes: [] })
                .expect(200);

            assert.deepStrictEqual(deleted.body.themes, []);
            const after = (await agent.get(THEMES_URL).expect(200)).body;
            assert.deepStrictEqual(after.themes, []);
        } finally {
            await agent.post(THEMES_URL).send(before);
        }
    });

    it("admin persists edits to a bundled theme", async function () {
        const agent = await loginAgent(admin);
        const before = (await agent.get(THEMES_URL).expect(200)).body;
        const bundled = (before.themes || [])[0];
        if (!bundled) {
            this.skip();
        }

        const edited = Object.assign({}, bundled, {
            name: bundled.name + " (edited)",
            vars: Object.assign({}, bundled.vars, { "--body-background": "#0a0b0c" }),
            updatedAt: Date.now(),
        });
        try {
            await agent
                .post(THEMES_URL)
                .send({
                    activeTheme: before.activeTheme,
                    themes: before.themes.map(function (t) {
                        return t.id === bundled.id ? edited : t;
                    }),
                })
                .expect(200);

            const after = (await agent.get(THEMES_URL).expect(200)).body;
            const saved = findTheme(after, bundled.id);
            assert.ok(saved, "bundled theme should still be listed");
            assert.strictEqual(saved.vars["--body-background"], "#0a0b0c");
            assert.strictEqual(saved.name, edited.name);
        } finally {
            await agent.post(THEMES_URL).send(before);
        }
    });
});
