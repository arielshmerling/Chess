const assert = require("assert");
const brainApi = require("../src/play/brainApi");
const desktopBrainService = require("../src/desktop/desktopBrainService");

describe("brainApi handlers", function () {
    it("exports compute, evaluate, and abort handlers", function () {
        assert.strictEqual(typeof brainApi.computeMove, "function");
        assert.strictEqual(typeof brainApi.evaluatePosition, "function");
        assert.strictEqual(typeof brainApi.abortSearch, "function");
    });

    it("abortSearch handler delegates to desktopBrainService", async function () {
        let called = false;
        const original = desktopBrainService.abortSearch;
        desktopBrainService.abortSearch = function () {
            called = true;
        };
        try {
            const res = {
                json(payload) {
                    assert.deepStrictEqual(payload, { ok: true });
                },
            };
            await brainApi.abortSearch({}, res);
            assert.strictEqual(called, true);
        } finally {
            desktopBrainService.abortSearch = original;
        }
    });
});

describe("desktopBrainService evaluatePosition", function () {
    it("rejects when game state is missing", async function () {
        await assert.rejects(() => desktopBrainService.evaluatePosition({ engine: "brain43" }));
    });
});
