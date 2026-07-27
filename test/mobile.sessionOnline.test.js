/**
 * Phase 8 mobile OnlineMode adapter characterization.
 */
/* eslint-disable */

const assert = require("assert");
const MobileSessionOnline = require("../src/mobile/mobile-session-online");

describe("mobile session online adapter", function () {
    it("exposes attach helpers without DOM", function () {
        assert.strictEqual(typeof MobileSessionOnline.attach, "function");
        assert.strictEqual(typeof MobileSessionOnline.shouldAttach, "function");
        assert.strictEqual(typeof MobileSessionOnline.sessionApisReady, "function");
        assert.strictEqual(typeof MobileSessionOnline.isMobileGamePage, "function");
        assert.strictEqual(typeof MobileSessionOnline.applyClassicRemoteMove, "function");
        assert.strictEqual(typeof MobileSessionOnline.readClassicClocks, "function");
    });

    it("shouldAttach only for OnlineGame participants", function () {
        assert.strictEqual(
            MobileSessionOnline.shouldAttach({
                gameType: "OnlineGame",
            }),
            true,
        );
        assert.strictEqual(
            MobileSessionOnline.shouldAttach({
                gameType: "OnlineGame",
                watcher: true,
            }),
            false,
        );
        assert.strictEqual(
            MobileSessionOnline.shouldAttach({
                gameType: "SinglePlayerGame",
                clientEngine: true,
            }),
            false,
        );
        assert.strictEqual(
            MobileSessionOnline.shouldAttach({
                gameType: "OnlineGame",
                mode: "review",
            }),
            false,
        );
    });

    it("readClassicClocks returns numeric white/black", function () {
        const clocks = MobileSessionOnline.readClassicClocks();
        assert.strictEqual(typeof clocks.white, "number");
        assert.strictEqual(typeof clocks.black, "number");
    });
});
