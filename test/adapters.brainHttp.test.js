/**
 * Phase 9 — brain HTTP adapter.
 */
/* eslint-disable */

const assert = require("assert");
const BrainHttp = require("../src/adapters/brainHttp");

describe("adapters brainHttp", function () {
    it("posts compute-move and unwraps move", async function () {
        const calls = [];
        const port = BrainHttp.create({
            postJson: async function (path, payload) {
                calls.push({ path: path, payload: payload });
                return { move: { moveStr: "e4" } };
            },
        });
        const move = await port.computeMove({ engine: "brain43" });
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].path, "/api/brain/compute-move");
        assert.strictEqual(move.moveStr, "e4");
    });

    it("posts evaluate-position and unwraps result", async function () {
        const port = BrainHttp.create({
            postJson: async function () {
                return { result: { score: 12 } };
            },
        });
        const result = await port.evaluatePosition({ engine: "brain43" });
        assert.deepStrictEqual(result, { score: 12 });
    });

    it("posts abort-search and swallows errors", async function () {
        let aborted = false;
        const port = BrainHttp.create({
            postJson: async function (path) {
                aborted = path === "/api/brain/abort-search";
                throw new Error("offline");
            },
        });
        await port.abortSearch();
        assert.strictEqual(aborted, true);
    });

    it("returns null when compute response has no move", async function () {
        const port = BrainHttp.create({
            postJson: async function () {
                return {};
            },
        });
        assert.strictEqual(await port.computeMove({}), null);
    });
});
