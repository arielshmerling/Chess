/**
 * PositionSetupMode + ConfigurationMode (Phase 7).
 */
/* eslint-disable */

const assert = require("assert");
const {
    MODE_IDS,
    getModeCapabilities,
    PositionSetupMode,
    ConfigurationMode,
} = require("../src/session");

describe("PositionSetupMode", function () {
    it("exposes positionSetup id and capabilities", function () {
        const mode = PositionSetupMode.create();
        assert.strictEqual(mode.id, MODE_IDS.POSITION_SETUP);
        const caps = mode.capabilities();
        assert.strictEqual(caps.positionSetup, true);
        assert.strictEqual(caps.engine, false);
        assert.strictEqual(caps.network, false);
        assert.deepStrictEqual(caps, getModeCapabilities(MODE_IDS.POSITION_SETUP));
    });
});

describe("ConfigurationMode", function () {
    it("exposes configuration id and brainConfig capability", function () {
        const mode = ConfigurationMode.create();
        assert.strictEqual(mode.id, MODE_IDS.CONFIGURATION);
        const caps = mode.capabilities();
        assert.strictEqual(caps.brainConfig, true);
        assert.strictEqual(caps.positionSetup, false);
        assert.strictEqual(caps.engine, false);
        assert.deepStrictEqual(caps, getModeCapabilities(MODE_IDS.CONFIGURATION));
    });
});
