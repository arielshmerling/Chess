/**
 * Phase 9 — brain IPC adapter.
 */
/* eslint-disable */

const assert = require("assert");
const BrainIpc = require("../src/adapters/brainIpc");

describe("adapters brainIpc", function () {
    it("invokes brain:computeMove and unsubscribes progress", async function () {
        const invokes = [];
        let unsubCalls = 0;
        const port = BrainIpc.create({
            ipc: {
                invoke: async function (channel, payload) {
                    invokes.push({ channel: channel, payload: payload });
                    return { moveStr: "e4" };
                },
                on: function () {
                    return function () {
                        unsubCalls += 1;
                    };
                },
            },
        });
        const move = await port.computeMove({ engine: "brain43" });
        assert.strictEqual(invokes[0].channel, "brain:computeMove");
        assert.strictEqual(move.moveStr, "e4");
        assert.strictEqual(unsubCalls, 1);
    });

    it("invokes brain:evaluatePosition", async function () {
        const port = BrainIpc.create({
            ipc: {
                invoke: async function (channel) {
                    assert.strictEqual(channel, "brain:evaluatePosition");
                    return { score: 3 };
                },
            },
        });
        const result = await port.evaluatePosition({});
        assert.deepStrictEqual(result, { score: 3 });
    });

    it("throws when IPC is missing on computeMove", async function () {
        const port = BrainIpc.create({ ipc: null });
        await assert.rejects(
            function () {
                return port.computeMove({});
            },
            /Desktop engine is not available/,
        );
    });

    it("invokes brain:abortSearch", async function () {
        let channel = null;
        const port = BrainIpc.create({
            ipc: {
                invoke: async function (ch) {
                    channel = ch;
                },
            },
        });
        await port.abortSearch();
        assert.strictEqual(channel, "brain:abortSearch");
    });
});
