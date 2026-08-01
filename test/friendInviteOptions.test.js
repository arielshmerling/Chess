"use strict";

const assert = require("assert");
const {
    normalizeFriendInviteOptions,
    resolveInviterColor,
    buildInviteOfferSnapshot,
} = require("../src/modules/game/friendInviteOptions");

describe("friendInviteOptions (server)", function () {
    it("applies defaults", function () {
        const o = normalizeFriendInviteOptions({});
        assert.strictEqual(o.timeMinutes, 90);
        assert.strictEqual(o.color, "white");
        assert.strictEqual(o.allowUndo, false);
        assert.strictEqual(o.friendly, true);
        assert.strictEqual(o.isPrivate, false);
    });

    it("clamps time and normalizes flags", function () {
        const o = normalizeFriendInviteOptions({
            timeMinutes: 999,
            color: "BLACK",
            allowUndo: true,
            friendly: "0",
            isPrivate: "1",
        });
        assert.strictEqual(o.timeMinutes, 180);
        assert.strictEqual(o.color, "black");
        assert.strictEqual(o.allowUndo, false);
        assert.strictEqual(o.friendly, false);
        assert.strictEqual(o.isPrivate, true);
    });

    it("resolves random to white or black", function () {
        const a = resolveInviterColor({ color: "random" });
        assert.ok(a === "white" || a === "black");
        assert.strictEqual(resolveInviterColor({ color: "black" }), "black");
        assert.strictEqual(resolveInviterColor({ color: "white" }), "white");
    });

    it("builds offer snapshot for invitee", function () {
        const opts = normalizeFriendInviteOptions({ timeMinutes: 15, color: "black", friendly: true });
        const snap = buildInviteOfferSnapshot(opts, "black");
        assert.strictEqual(snap.youPlayAs, "white");
        assert.strictEqual(snap.inviterPlaysWhite, false);
        assert.strictEqual(snap.timeMinutes, 15);
        assert.strictEqual(snap.friendly, true);
    });
});
