const assert = require("assert");
const {
    THINKING_TIME_SECONDS_OPTIONS,
    DEFAULT_THINKING_TIME_SECONDS,
    normalizeThinkingTimeSeconds,
    thinkingTimeSecondsToMs,
} = require("../src/modules/game/brainConfigService");

describe("brainConfigService", function () {
    describe("normalizeThinkingTimeSeconds", function () {
        it("returns default for invalid input", function () {
            assert.strictEqual(normalizeThinkingTimeSeconds(null), DEFAULT_THINKING_TIME_SECONDS);
            assert.strictEqual(normalizeThinkingTimeSeconds("abc"), DEFAULT_THINKING_TIME_SECONDS);
        });

        it("keeps allowed thinking-time values", function () {
            for (const seconds of THINKING_TIME_SECONDS_OPTIONS) {
                assert.strictEqual(normalizeThinkingTimeSeconds(seconds), seconds);
                assert.strictEqual(normalizeThinkingTimeSeconds(String(seconds)), seconds);
            }
        });

        it("maps legacy difficulty 1–6 onto the option list", function () {
            assert.strictEqual(normalizeThinkingTimeSeconds(1), THINKING_TIME_SECONDS_OPTIONS[0]);
            assert.strictEqual(normalizeThinkingTimeSeconds(6), THINKING_TIME_SECONDS_OPTIONS[5]);
        });

        it("snaps other values to the nearest allowed option", function () {
            assert.strictEqual(normalizeThinkingTimeSeconds(9), 10);
            assert.strictEqual(normalizeThinkingTimeSeconds(25), 20);
            assert.strictEqual(normalizeThinkingTimeSeconds(100), 120);
        });
    });

    describe("thinkingTimeSecondsToMs", function () {
        it("converts normalized seconds to milliseconds", function () {
            assert.strictEqual(thinkingTimeSecondsToMs(10), 10000);
            assert.strictEqual(thinkingTimeSecondsToMs("5"), 5000);
        });
    });
});
