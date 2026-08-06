/**
 * SpServerSync.create send paths with an injected Fake WebSocket.
 */
"use strict";

const assert = require("assert");
const SpServerSync = require("../src/session/spServerSync");
const WsTransport = require("../src/session/wsTransport");

describe("SpServerSync.create", function () {
    let lastSocket;
    let origCreate;

    function FakeWebSocket(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        lastSocket = this;
        const self = this;
        queueMicrotask(function () {
            self.readyState = 1;
            if (typeof self.onopen === "function") {
                self.onopen();
            }
        });
    }
    FakeWebSocket.prototype.send = function (data) {
        this.sent.push(typeof data === "string" ? JSON.parse(data) : data);
    };
    FakeWebSocket.prototype.close = function () {
        this.readyState = 3;
        if (typeof this.onclose === "function") {
            this.onclose();
        }
    };

    beforeEach(function () {
        lastSocket = null;
        origCreate = WsTransport.create;
        WsTransport.create = function (opts) {
            return origCreate(Object.assign({}, opts, { WebSocket: FakeWebSocket }));
        };
    });

    afterEach(function () {
        WsTransport.create = origCreate;
    });

    it("requires gameInfo.id and transport", function () {
        assert.throws(() => SpServerSync.create({}), /gameInfo\.id/);
    });

    it("connects, sends moves/clocks/resign/outOfTime, then detaches", async function () {
        const sync = SpServerSync.create({
            gameInfo: {
                id: "gid-1",
                username: "alice",
                userId: "uid-1",
                creatorId: "uid-1",
            },
            humanIsWhite: true,
            wsUrl: "ws://localhost/ws",
        });
        assert.strictEqual(sync.isReady(), false);

        const connectP = sync.connect();
        /* Wait until the fake socket is open and connect was sent. */
        for (let i = 0; i < 20 && (!lastSocket || lastSocket.readyState !== 1 || lastSocket.sent.length < 1); i++) {
            await new Promise((r) => setImmediate(r));
        }
        assert.ok(lastSocket);
        assert.strictEqual(lastSocket.readyState, 1);
        lastSocket.onmessage({
            data: JSON.stringify({ type: "info", info: "connected" }),
        });
        await connectP;
        assert.strictEqual(sync.isReady(), true);

        sync.sendHumanMove(null);
        sync.sendHumanMove(
            { source: { row: 6, col: 4 }, target: { row: 4, col: 4 }, moveStr: "e4" },
            { whiteTimer: 100, blackTimer: 90, moveTime: 5 },
        );
        sync.sendEngineMove(
            { source: { row: 1, col: 4 }, target: { row: 3, col: 4 }, moveStr: "e5" },
            { whiteTimer: 99, blackTimer: 88 },
        );
        sync.sendClockSync({ whiteTimer: 50, blackTimer: 40 });
        sync.sendResign({ whiteTimer: 1, blackTimer: 2 });
        sync.sendOutOfTime("white", { whiteTimer: 0, blackTimer: 10 });

        assert.ok(lastSocket.sent.length >= 2, JSON.stringify(lastSocket.sent));
        assert.ok(lastSocket.sent.some((m) => m.type === "move"));
        assert.ok(lastSocket.sent.some((m) => m.info === "clientEngineMove"));
        assert.ok(lastSocket.sent.some((m) => m.info === "clockSync"));
        assert.ok(lastSocket.sent.some((m) => m.info === "resign"));
        assert.ok(lastSocket.sent.some((m) => m.info === "outOfTime"));

        sync.detach();
        assert.strictEqual(sync.isReady(), false);
        const n = lastSocket.sent.length;
        sync.sendClockSync({ whiteTimer: 1, blackTimer: 1 });
        assert.strictEqual(lastSocket.sent.length, n);
    });

    it("rejects when socket closes before connected", async function () {
        const sync = SpServerSync.create({
            gameInfo: { id: "gid-2", username: "a", userId: "u" },
            wsUrl: "ws://localhost/ws",
        });
        const p = sync.connect();
        for (let i = 0; i < 20 && (!lastSocket || lastSocket.readyState !== 1); i++) {
            await new Promise((r) => setImmediate(r));
        }
        lastSocket.close();
        await assert.rejects(p, /closed before connected/);
    });

    it("toServerMovePayload passes through human moves", function () {
        const move = { source: { row: 1, col: 1 }, target: { row: 2, col: 2 }, valid: true };
        const out = SpServerSync.toServerMovePayload(move, { source: "human" });
        assert.strictEqual(out.source.row, 1);
        assert.strictEqual(SpServerSync.toServerMovePayload(null), null);
    });
});
