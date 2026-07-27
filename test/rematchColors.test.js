"use strict";

const assert = require("assert");
const {
    assignRematchPlayers,
    normalizeOffererWantsColor,
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
});
