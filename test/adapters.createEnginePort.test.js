/**
 * Phase 9 — createEnginePort factory.
 */
/* eslint-disable */

const assert = require("assert");
const CreateEnginePort = require("../src/adapters/createEnginePort");

describe("adapters createEnginePort", function () {
    it("selects HTTP when not Electron", async function () {
        const calls = [];
        const port = CreateEnginePort.create({
            isElectron: false,
            http: {
                postJson: async function (path) {
                    calls.push(path);
                    return { move: { moveStr: "d4" } };
                },
            },
        });
        assert.strictEqual(typeof port.computeMove, "function");
        assert.strictEqual(typeof port.evaluatePosition, "function");
        assert.strictEqual(typeof port.abortSearch, "function");
        const move = await port.computeMove({});
        assert.strictEqual(move.moveStr, "d4");
        assert.strictEqual(calls[0], "/api/brain/compute-move");
    });

    it("selects IPC when Electron", async function () {
        const invokes = [];
        const port = CreateEnginePort.create({
            isElectron: true,
            ipc: {
                invoke: async function (channel) {
                    invokes.push(channel);
                    return { moveStr: "c4" };
                },
            },
        });
        const move = await port.computeMove({});
        assert.strictEqual(move.moveStr, "c4");
        assert.strictEqual(invokes[0], "brain:computeMove");
    });
});
