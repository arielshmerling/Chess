/**
 * Web custom-theme store round-trip (supertest).
 * Run: mocha --exit --require ./test/_teardownWorkers.js ./test/webCustomThemes.api.test.js
 *
 * Requires DATABASE_URL + SESSION_SECRET (from .env).
 */
/* eslint-disable */

const assert = require("assert");
const request = require("supertest");
const { ensureWebE2EUsers, ensureWebE2EPartner } = require("./helpers/webE2EUser");
const { loadWebApp } = require("./helpers/webApp");

const THEMES_URL = "/app/api/custom-themes";

describe("web custom themes API", function () {
    this.timeout(30000);

    let app;
    let primary;
    let partner;

    before(async function () {
        const users = await ensureWebE2EUsers();
        primary = users.primary;
        partner = await ensureWebE2EPartner();
        app = loadWebApp();
    });

    async function loginAgent(creds) {
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
        const nextActive = before.activeTheme === "dark" ? "blue" : "dark";
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

    it("partner persists a newly created theme", async function () {
        const agent = await loginAgent(partner);
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
        } finally {
            await agent.post(THEMES_URL).send(before);
        }
    });

    it("partner keeps a deleted bundled theme deleted", async function () {
        const agent = await loginAgent(partner);
        const before = (await agent.get(THEMES_URL).expect(200)).body;
        const bundled = (before.themes || [])[0];
        if (!bundled) {
            this.skip();
        }

        try {
            await agent
                .post(THEMES_URL)
                .send({
                    activeTheme: before.activeTheme,
                    themes: before.themes.filter(function (t) {
                        return t.id !== bundled.id;
                    }),
                })
                .expect(200);

            const after = (await agent.get(THEMES_URL).expect(200)).body;
            assert.ok(!findTheme(after, bundled.id), "deleted theme should stay deleted");
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
        assert.ok(findTheme(restored, bundled.id), "restoring the full list brings it back");
    });

    it("partner persists edits to a bundled theme", async function () {
        const agent = await loginAgent(partner);
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
