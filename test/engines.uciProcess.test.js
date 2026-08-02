/**
 * UCI process + fake engine tests.
 */
"use strict";

const assert = require("assert");
const path = require("path");
const {
    createUciProcess,
    SearchAbortedError,
    normalizeSkillLevel,
} = require("../src/engines/uci/uciProcess");

const FAKE = path.join(__dirname, "fixtures", "fake-uci-engine.js");

describe("engines uciProcess", function () {
    this.timeout(10000);

    let proc;

    afterEach(function () {
        if (proc) {
            try {
                proc.dispose();
            } catch {
                /* ignore */
            }
            proc = null;
        }
        delete process.env.FAKE_UCI_ASSERT_SKILL;
    });

    it("normalizeSkillLevel clamps 0–20", function () {
        assert.strictEqual(normalizeSkillLevel(0), 0);
        assert.strictEqual(normalizeSkillLevel(20), 20);
        assert.strictEqual(normalizeSkillLevel(7), 7);
        assert.strictEqual(normalizeSkillLevel(null), null);
        assert.strictEqual(normalizeSkillLevel(21), null);
        assert.strictEqual(normalizeSkillLevel(-1), null);
        assert.strictEqual(normalizeSkillLevel(3.5), null);
    });

    it("handshakes with a fake UCI engine", async function () {
        proc = createUciProcess(process.execPath, [FAKE]);
        await proc.uciHandshake(5000);
    });

    it("returns bestmove for go movetime", async function () {
        proc = createUciProcess(process.execPath, [FAKE]);
        await proc.uciHandshake(5000);
        const best = await proc.goMovetime(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
            50,
        );
        assert.strictEqual(best, "e7e5");
    });

    it("sends Skill Level before go when skillLevel is set", async function () {
        process.env.FAKE_UCI_ASSERT_SKILL = "5";
        proc = createUciProcess(process.execPath, [FAKE]);
        await proc.uciHandshake(5000);
        const best = await proc.goMovetime(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            50,
            { skillLevel: 5 },
        );
        assert.strictEqual(best, "e7e5");
    });

    it("aborts an in-flight search", async function () {
        proc = createUciProcess(process.execPath, [FAKE]);
        await proc.uciHandshake(5000);
        const signal = { aborted: false };
        const pending = proc.goMovetime(
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            5000,
            { abortSignal: signal },
        );
        setTimeout(() => {
            signal.aborted = true;
            proc.stop();
        }, 30);
        await assert.rejects(pending, (err) => err instanceof SearchAbortedError);
    });
});
