/**
 * In-memory presence helpers.
 */
"use strict";

const assert = require("assert");
const presence = require("../src/utils/presence");

describe("presence", function () {
    afterEach(function () {
        presence.setFriendPresenceBroadcaster(null);
    });

    it("touch / isOnline use last-seen window", function () {
        assert.strictEqual(presence.isOnline(null), false);
        assert.strictEqual(presence.isOnline(""), false);
        presence.touch("u1");
        assert.strictEqual(presence.isOnline("u1"), true);
        presence.touch(null);
    });

    it("attach / detach broadcast online and debounced offline", async function () {
        this.timeout(8000);
        const events = [];
        presence.setFriendPresenceBroadcaster((p) => events.push(p));

        const ws = { readyState: 1, send() {} };
        presence.attachPresenceWebSocket(ws, "u2", "Alice");
        assert.strictEqual(presence.isOnline("u2"), true);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].online, true);
        assert.strictEqual(events[0].username, "Alice");

        presence.sendToUser("u2", { type: "ping" });
        presence.sendToUser("", { type: "x" });

        presence.detachPresenceWebSocket(ws);
        assert.strictEqual(presence.isOnline("u2"), false);

        await new Promise((r) => setTimeout(r, 4100));
        assert.ok(events.some((e) => e.online === false && e.userId === "u2"));
    });

    it("reconnect before debounce cancels offline broadcast", async function () {
        this.timeout(8000);
        const events = [];
        presence.setFriendPresenceBroadcaster((p) => events.push(p));

        const ws1 = { readyState: 1, send() {} };
        presence.attachPresenceWebSocket(ws1, "u3", "Bob");
        presence.detachPresenceWebSocket(ws1);
        const ws2 = { readyState: 1, send() {} };
        presence.attachPresenceWebSocket(ws2, "u3", "Bob");
        await new Promise((r) => setTimeout(r, 4100));
        assert.ok(!events.some((e) => e.online === false && e.userId === "u3"));
        presence.detachPresenceWebSocket(ws2);
    });

    it("sendToUser ignores closed sockets and bad payloads", function () {
        const sent = [];
        const ws = {
            readyState: 1,
            send(m) {
                sent.push(m);
            },
        };
        presence.attachPresenceWebSocket(ws, "u4", "C");
        const cyclic = {};
        cyclic.self = cyclic;
        presence.sendToUser("u4", cyclic);
        assert.strictEqual(sent.length, 0);
        presence.sendToUser("u4", { ok: true });
        assert.strictEqual(sent.length, 1);
        ws.readyState = 3;
        presence.sendToUser("u4", { ok: 2 });
        assert.strictEqual(sent.length, 1);
        presence.detachPresenceWebSocket(ws);
        presence.detachPresenceWebSocket({ /* no presence fields */ });
    });
});
