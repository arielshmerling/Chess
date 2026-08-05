/**
 * Unit coverage for the engine concurrency gate (SEC-01 / ON-35).
 */

const assert = require("assert");
const {
    createConcurrencyGate,
    BUSY_KEY,
    BUSY_GLOBAL,
    TIMEOUT,
} = require("../src/security/concurrencyGate");

/** @returns {{ promise: Promise<any>, resolve: Function, reject: Function }} */
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise(function (res, rej) {
        resolve = res;
        reject = rej;
    });
    return { promise: promise, resolve: resolve, reject: reject };
}

describe("concurrency gate", function () {
    it("runs work and frees the slot afterwards", async function () {
        const gate = createConcurrencyGate({ perKeyMax: 1, globalMax: 2 });
        assert.strictEqual(await gate.run("u1", () => "first"), "first");
        assert.strictEqual(await gate.run("u1", () => "second"), "second");
        assert.strictEqual(gate.stats().activeTotal, 0);
    });

    it("rejects a second simultaneous job for the same key", async function () {
        const gate = createConcurrencyGate({ perKeyMax: 1, globalMax: 4 });
        const slow = deferred();
        const running = gate.run("u1", () => slow.promise);

        await assert.rejects(
            () => gate.run("u1", () => "queued"),
            (err) => err.code === BUSY_KEY,
        );

        slow.resolve("done");
        assert.strictEqual(await running, "done");
        assert.strictEqual(gate.stats().activeTotal, 0);
    });

    it("allows a different key up to the global cap, then reports global saturation", async function () {
        const gate = createConcurrencyGate({ perKeyMax: 1, globalMax: 2 });
        const a = deferred();
        const b = deferred();
        const first = gate.run("u1", () => a.promise);
        const second = gate.run("u2", () => b.promise);
        assert.strictEqual(gate.stats().activeTotal, 2);

        await assert.rejects(
            () => gate.run("u3", () => "third"),
            (err) => err.code === BUSY_GLOBAL,
        );

        a.resolve(1);
        b.resolve(2);
        assert.deepStrictEqual(await Promise.all([first, second]), [1, 2]);
        assert.strictEqual(gate.stats().activeTotal, 0);
    });

    it("frees the slot when work throws", async function () {
        const gate = createConcurrencyGate({ perKeyMax: 1, globalMax: 2 });
        await assert.rejects(
            () =>
                gate.run("u1", () => {
                    throw new Error("engine exploded");
                }),
            /engine exploded/,
        );
        assert.strictEqual(gate.stats().activeTotal, 0);
        assert.strictEqual(await gate.run("u1", () => "recovered"), "recovered");
    });

    it("times out the caller but keeps the slot until the work settles", async function () {
        const gate = createConcurrencyGate({ perKeyMax: 1, globalMax: 2, timeoutMs: 10 });
        const stuck = deferred();
        const abandoned = gate.run("u1", () => stuck.promise);

        await assert.rejects(
            () => abandoned,
            (err) => err.code === TIMEOUT,
        );

        // The abandoned search is still burning CPU, so its slot must stay taken.
        assert.strictEqual(gate.stats().activeTotal, 1);
        await assert.rejects(
            () => gate.run("u1", () => "too soon"),
            (err) => err.code === BUSY_KEY,
        );

        stuck.resolve("late");
        await new Promise((resolve) => setImmediate(resolve));
        assert.strictEqual(gate.stats().activeTotal, 0);
        assert.strictEqual(await gate.run("u1", () => "ok now"), "ok now");
    });

    it("never admits more than the caps allow and treats globalMax below perKeyMax as perKeyMax", function () {
        const gate = createConcurrencyGate({ perKeyMax: 3, globalMax: 1 });
        assert.strictEqual(gate.stats().perKeyMax, 3);
        assert.strictEqual(gate.stats().globalMax, 3);
    });

    it("reset clears counters", async function () {
        const gate = createConcurrencyGate({ perKeyMax: 1, globalMax: 1 });
        const held = deferred();
        const running = gate.run("u1", () => held.promise);
        assert.strictEqual(gate.stats().activeTotal, 1);
        gate.reset();
        assert.strictEqual(gate.stats().activeTotal, 0);
        held.resolve("x");
        await running;
    });
});
