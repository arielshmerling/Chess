"use strict";

const assert = require("assert");
const {
    assignRematchPlayers,
    normalizeOffererWantsColor,
    normalizeRematchTimeMinutes,
    timeMinutesFromGame,
    resolveRematchTimeMinutes,
} = require("../src/modules/game/rematchColors");

describe("rematchColors", function () {
    const white = { userId: "w", userName: "White" };
    const black = { userId: "b", userName: "Black" };

    it("keeps seats when no preferred color", function () {
        assert.deepStrictEqual(
            assignRematchPlayers({
                whitePlayer: white,
                blackPlayer: black,
                acceptorIsWhite: true,
            }),
            { whitePlayer: white, blackPlayer: black },
        );
    });

    it("gives offerer white when acceptor was white", function () {
        /* Acceptor white → offerer was black; offerer wants white → swap. */
        assert.deepStrictEqual(
            assignRematchPlayers({
                whitePlayer: white,
                blackPlayer: black,
                acceptorIsWhite: true,
                offererWantsColor: "white",
            }),
            { whitePlayer: black, blackPlayer: white },
        );
    });

    it("gives offerer black when acceptor was white", function () {
        assert.deepStrictEqual(
            assignRematchPlayers({
                whitePlayer: white,
                blackPlayer: black,
                acceptorIsWhite: true,
                offererWantsColor: "black",
            }),
            { whitePlayer: white, blackPlayer: black },
        );
    });

    it("gives offerer white when acceptor was black", function () {
        /* Acceptor black → offerer was white; offerer wants white → same. */
        assert.deepStrictEqual(
            assignRematchPlayers({
                whitePlayer: white,
                blackPlayer: black,
                acceptorIsWhite: false,
                offererWantsColor: "white",
            }),
            { whitePlayer: white, blackPlayer: black },
        );
    });

    it("gives offerer black when acceptor was black", function () {
        assert.deepStrictEqual(
            assignRematchPlayers({
                whitePlayer: white,
                blackPlayer: black,
                acceptorIsWhite: false,
                offererWantsColor: "black",
            }),
            { whitePlayer: black, blackPlayer: white },
        );
    });

    it("normalizeOffererWantsColor accepts only white/black", function () {
        assert.strictEqual(normalizeOffererWantsColor("white"), "white");
        assert.strictEqual(normalizeOffererWantsColor("black"), "black");
        assert.strictEqual(normalizeOffererWantsColor("random"), null);
        assert.strictEqual(normalizeOffererWantsColor(undefined), null);
    });

    it("normalizeRematchTimeMinutes clamps to 1–180", function () {
        assert.strictEqual(normalizeRematchTimeMinutes(45), 45);
        assert.strictEqual(normalizeRematchTimeMinutes("30"), 30);
        assert.strictEqual(normalizeRematchTimeMinutes(0), null);
        assert.strictEqual(normalizeRematchTimeMinutes(200), 180);
        assert.strictEqual(normalizeRematchTimeMinutes("x"), null);
    });

    it("resolveRematchTimeMinutes prefers offer, then old game, then 90", function () {
        assert.strictEqual(resolveRematchTimeMinutes(25, null), 25);
        assert.strictEqual(
            resolveRematchTimeMinutes(null, { chessGame: { GameTimeLength: 60 * 60 } }),
            60,
        );
        assert.strictEqual(resolveRematchTimeMinutes(null, null), 90);
        assert.strictEqual(timeMinutesFromGame({ chessGame: { GameTimeLength: 45 * 60 } }), 45);
    });
});
