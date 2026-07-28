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

    it("shouldAttach for OnlineGame participants and watchers", function () {
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
            true,
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

    it("isWatcherSession detects watcher flag", function () {
        assert.strictEqual(
            MobileSessionOnline.isWatcherSession({ watcher: true }),
            true,
        );
        assert.strictEqual(
            MobileSessionOnline.isWatcherSession({ gameType: "OnlineGame" }),
            false,
        );
    });

    it("readClassicClocks returns numeric white/black", function () {
        const clocks = MobileSessionOnline.readClassicClocks();
        assert.strictEqual(typeof clocks.white, "number");
        assert.strictEqual(typeof clocks.black, "number");
    });

    it("applyClassicRemoteMove animates with skipFinalSync", async function () {
        const animateOpts = [];
        const prevAnimate = global.animateMove;
        const prevAdjust = global.adjustIncomingNetworkMoveForBoardView;
        global.animateMove = async function (_move, opts) {
            animateOpts.push(opts || null);
        };
        global.adjustIncomingNetworkMoveForBoardView = function (m) {
            return m;
        };
        try {
            const move = {
                source: { row: 6, col: 4 },
                target: { row: 4, col: 4 },
            };
            const game = {
                GameOver: false,
                makeMove: function () {
                    return move;
                },
            };
            const ok = await MobileSessionOnline.applyClassicRemoteMove(move, {
                game: game,
                gameInfo: { id: "g1" },
                humanIsWhite: true,
            });
            assert.strictEqual(ok, true);
            assert.strictEqual(animateOpts.length, 1);
            assert.deepStrictEqual(animateOpts[0], { skipFinalSync: true });
        } finally {
            global.animateMove = prevAnimate;
            global.adjustIncomingNetworkMoveForBoardView = prevAdjust;
        }
    });
});
