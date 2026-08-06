/**
 * SEC-03: desktop IPC channel allowlist.
 */
"use strict";

const assert = require("assert");
const {
    isInvokeAllowed,
    isOnAllowed,
    INVOKE_ALLOWLIST,
} = require("../desktop/ipcChannels");

describe("desktop ipcChannels (SEC-03)", function () {
    it("allows only the known renderer invoke channels", function () {
        assert.strictEqual(isInvokeAllowed("brain:computeMove"), true);
        assert.strictEqual(isInvokeAllowed("app:quit"), true);
        assert.strictEqual(isInvokeAllowed("log:getHistory"), false);
        assert.strictEqual(isInvokeAllowed("evil:channel"), false);
        assert.ok(INVOKE_ALLOWLIST.includes("engines:listPlay"));
    });

    it("allows only brain:searchProgress for on()", function () {
        assert.strictEqual(isOnAllowed("brain:searchProgress"), true);
        assert.strictEqual(isOnAllowed("brain:computeMove"), false);
    });
});
