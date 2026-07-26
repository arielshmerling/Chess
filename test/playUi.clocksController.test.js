const assert = require("assert");

const ClocksController = require("../src/play-ui/clocks-controller");

/** Minimal element + interval stubs so ticks are driven by the test, not the clock. */
function harness(overrides) {
    const elements = {
        white: { textContent: "" },
        black: { textContent: "" },
    };
    const scheduled = new Map();
    let nextHandle = 1;
    const flagged = [];
    let stopped = false;

    const timers = {
        setInterval: function (fn) {
            const handle = nextHandle;
            nextHandle += 1;
            scheduled.set(handle, fn);
            return handle;
        },
        clearInterval: function (handle) {
            scheduled.delete(handle);
        },
    };

    const clocks = ClocksController.create(
        Object.assign(
            {
                getElement: (color) => elements[color],
                isStopped: () => stopped,
                onFlag: (color) => flagged.push(color),
                timers,
            },
            overrides,
        ),
    );

    return {
        clocks,
        elements,
        flagged,
        setStopped: (value) => {
            stopped = value;
        },
        runningHandles: () => scheduled.size,
        tick: (times) => {
            for (let i = 0; i < (times || 1); i += 1) {
                Array.from(scheduled.values()).forEach((fn) => fn());
            }
        },
    };
}

describe("play-ui clocks controller", function () {
    describe("formatSeconds", function () {
        it("formats seconds as hh:mm:ss", function () {
            assert.strictEqual(ClocksController.formatSeconds(0), "00:00:00");
            assert.strictEqual(ClocksController.formatSeconds(59), "00:00:59");
            assert.strictEqual(ClocksController.formatSeconds(90 * 60), "01:30:00");
        });
    });

    describe("reset", function () {
        it("sets both clocks and writes them to the elements", function () {
            const h = harness();
            h.clocks.reset({ white: 300, black: 180 });

            assert.deepStrictEqual(h.clocks.get(), { white: 300, black: 180 });
            assert.strictEqual(h.elements.white.textContent, "00:05:00");
            assert.strictEqual(h.elements.black.textContent, "00:03:00");
        });

        it("stops a running clock", function () {
            const h = harness();
            h.clocks.reset({ white: 300, black: 300 });
            h.clocks.startFor("white");
            h.clocks.reset({ white: 60, black: 60 });

            assert.strictEqual(h.clocks.isRunning(), false);
            assert.strictEqual(h.runningHandles(), 0);
        });
    });

    describe("set", function () {
        it("applies only the sides given", function () {
            const h = harness();
            h.clocks.reset({ white: 300, black: 300 });
            h.clocks.set({ white: 120 });

            assert.deepStrictEqual(h.clocks.get(), { white: 120, black: 300 });
        });

        it("ignores non-numeric and negative values", function () {
            const h = harness();
            h.clocks.reset({ white: 300, black: 300 });
            h.clocks.set({ white: undefined, black: -5 });

            assert.deepStrictEqual(h.clocks.get(), { white: 300, black: 300 });
        });
    });

    describe("ticking", function () {
        it("counts down only the running side", function () {
            const h = harness();
            h.clocks.reset({ white: 300, black: 300 });
            h.clocks.startFor("white");
            h.tick(3);

            assert.deepStrictEqual(h.clocks.get(), { white: 297, black: 300 });
            assert.strictEqual(h.elements.white.textContent, "00:04:57");
        });

        it("switches sides without leaving the old interval running", function () {
            const h = harness();
            h.clocks.reset({ white: 300, black: 300 });
            h.clocks.startFor("white");
            h.clocks.startFor("black");
            h.tick(2);

            assert.deepStrictEqual(h.clocks.get(), { white: 300, black: 298 });
            assert.strictEqual(h.runningHandles(), 1);
        });

        it("does not run when there is no side to move", function () {
            const h = harness();
            h.clocks.reset({ white: 300, black: 300 });
            h.clocks.startFor(null);

            assert.strictEqual(h.clocks.isRunning(), false);
        });

        it("flags once when a clock reaches zero", function () {
            const h = harness();
            h.clocks.reset({ white: 2, black: 300 });
            h.clocks.startFor("white");
            h.tick(2);

            assert.deepStrictEqual(h.flagged, ["white"]);
            assert.strictEqual(h.clocks.isRunning(), false);

            h.tick(2);
            assert.deepStrictEqual(h.flagged, ["white"]);
        });

        it("stops without flagging once the game is over", function () {
            const h = harness();
            h.clocks.reset({ white: 300, black: 300 });
            h.clocks.startFor("white");
            h.setStopped(true);
            h.tick();

            assert.strictEqual(h.clocks.isRunning(), false);
            assert.deepStrictEqual(h.flagged, []);
            assert.strictEqual(h.clocks.get().white, 299);
        });
    });

    describe("stop", function () {
        it("keeps the remaining time", function () {
            const h = harness();
            h.clocks.reset({ white: 300, black: 300 });
            h.clocks.startFor("black");
            h.tick(5);
            h.clocks.stop();

            assert.strictEqual(h.clocks.isRunning(), false);
            assert.strictEqual(h.clocks.get().black, 295);
        });
    });

    it("survives missing clock elements", function () {
        const h = harness({ getElement: () => null });
        h.clocks.reset({ white: 300, black: 300 });
        h.clocks.startFor("white");
        h.tick();

        assert.strictEqual(h.clocks.get().white, 299);
    });
});
