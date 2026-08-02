/**
 * Play engine enablement store + client filtering.
 */
"use strict";

const assert = require("assert");
const fs = require("fs").promises;
const path = require("path");
const enablementStore = require("../src/engines/engineEnablementStore");
const engineService = require("../src/engines/engineService");
const uciBackend = require("../src/engines/uci/uciBackend");

describe("engines enablement", function () {
    this.timeout(10000);

    const testStorePath = enablementStore.STORE_PATH;
    let backup = null;

    beforeEach(async function () {
        enablementStore.clearCache();
        uciBackend.clearAvailabilityCache();
        try {
            backup = await fs.readFile(testStorePath, "utf8");
        } catch (err) {
            backup = null;
            if (!err || err.code !== "ENOENT") {
                throw err;
            }
        }
        await enablementStore.replaceStoreForTests({ disabledIds: [] });
    });

    afterEach(async function () {
        enablementStore.clearCache();
        uciBackend.clearAvailabilityCache();
        if (backup == null) {
            try {
                await fs.unlink(testStorePath);
            } catch (err) {
                if (!err || err.code !== "ENOENT") {
                    throw err;
                }
            }
        } else {
            await fs.mkdir(path.dirname(testStorePath), { recursive: true });
            await fs.writeFile(testStorePath, backup, "utf8");
        }
    });

    it("lists all Play engines for admin with enabled flags", async function () {
        const list = await engineService.listPlayEnginesForAdmin();
        assert.ok(list.length >= 4);
        const brain = list.find((e) => e.id === "brain43");
        assert.ok(brain);
        assert.strictEqual(brain.backend, "brain");
        assert.strictEqual(brain.enabled, true);
        assert.strictEqual(brain.available, true);
        const sf = list.find((e) => e.id === "stockfish");
        assert.ok(sf);
        assert.strictEqual(sf.backend, "uci");
        assert.ok("command" in sf);
        assert.ok("commandEnv" in sf);
    });

    it("omits disabled engines from client launch list", async function () {
        await engineService.setPlayEngineEnabled("stockfish", false);
        const client = await engineService.listPlayEnginesForClient();
        assert.ok(!client.some((e) => e.id === "stockfish"));
        assert.ok(client.some((e) => e.id === "brain43"));

        const admin = await engineService.listPlayEnginesForAdmin();
        const sf = admin.find((e) => e.id === "stockfish");
        assert.ok(sf);
        assert.strictEqual(sf.enabled, false);
    });

    it("resolveEnabledPlayEngine skips disabled ids", async function () {
        await engineService.setPlayEngineEnabled("stockfish", false);
        assert.strictEqual(
            await engineService.resolveEnabledPlayEngine("stockfish"),
            "brain43",
        );
        assert.strictEqual(
            await engineService.resolveEnabledPlayEngine("brain43"),
            "brain43",
        );
    });

    it("computeMove rejects disabled engines", async function () {
        await engineService.setPlayEngineEnabled("brain42", false);
        await assert.rejects(
            () => engineService.computeMove({ gameState: {}, engine: "brain42" }),
            (err) => err && err.code === "ENGINE_DISABLED",
        );
    });
});
