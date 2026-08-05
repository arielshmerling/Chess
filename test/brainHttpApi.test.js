const assert = require("assert");
const express = require("express");
const request = require("supertest");
const brainApi = require("../src/play/brainApi");
const brainGuards = require("../src/play/brainGuards");
const desktopBrainService = require("../src/desktop/desktopBrainService");
const engineService = require("../src/engines/engineService");
const { createRateLimiter } = require("../src/security/rateLimit");

/** Minimal Express-like response recorder. */
function fakeRes() {
    const res = { statusCode: 200, headers: {}, payload: null };
    res.status = function (code) {
        res.statusCode = code;
        return res;
    };
    res.json = function (payload) {
        res.payload = payload;
        return res;
    };
    res.set = function (name, value) {
        res.headers[String(name).toLowerCase()] = value;
        return res;
    };
    return res;
}

function fakeReq(body, userId) {
    return { body: body, session: { user_id: userId || "user-1" }, ip: "127.0.0.1" };
}

function deferred() {
    let resolve;
    const promise = new Promise(function (res) {
        resolve = res;
    });
    return { promise: promise, resolve: resolve };
}

function rethrow(err) {
    if (err) {
        throw err;
    }
}

describe("brainApi handlers", function () {
    afterEach(function () {
        brainGuards.engineGate.reset();
    });

    it("exports compute, evaluate, and abort handlers", function () {
        assert.strictEqual(typeof brainApi.computeMove, "function");
        assert.strictEqual(typeof brainApi.evaluatePosition, "function");
        assert.strictEqual(typeof brainApi.abortSearch, "function");
    });

    it("abortSearch handler delegates to desktopBrainService", async function () {
        let called = false;
        const original = desktopBrainService.abortSearch;
        desktopBrainService.abortSearch = function () {
            called = true;
        };
        try {
            const res = {
                json(payload) {
                    assert.deepStrictEqual(payload, { ok: true });
                },
            };
            await brainApi.abortSearch({}, res);
            assert.strictEqual(called, true);
        } finally {
            desktopBrainService.abortSearch = original;
        }
    });

    it("rejects a search with no gameState as 400 before touching the engine", async function () {
        const original = engineService.computeMove;
        let engineCalled = false;
        engineService.computeMove = async function () {
            engineCalled = true;
            return {};
        };
        try {
            const res = fakeRes();
            await brainApi.computeMove(fakeReq({ engine: "brain43" }), res, rethrow);
            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.payload.ok, false);
            assert.match(res.payload.message, /gameState/);
            assert.strictEqual(engineCalled, false);
        } finally {
            engineService.computeMove = original;
        }
    });

    it("answers 429 while the same session already has a search running", async function () {
        const original = engineService.computeMove;
        const pending = deferred();
        engineService.computeMove = function () {
            return pending.promise;
        };
        try {
            const firstRes = fakeRes();
            const first = brainApi.computeMove(fakeReq({ gameState: {} }), firstRes, rethrow);

            const busyRes = fakeRes();
            await brainApi.computeMove(fakeReq({ gameState: {} }), busyRes, rethrow);
            assert.strictEqual(busyRes.statusCode, 429);
            assert.strictEqual(busyRes.payload.ok, false);
            assert.strictEqual(busyRes.headers["retry-after"], "2");

            pending.resolve({ source: {}, target: {} });
            await first;
            assert.strictEqual(firstRes.statusCode, 200);
            assert.strictEqual(firstRes.payload.ok, true);
        } finally {
            engineService.computeMove = original;
        }
    });

    it("answers 503 once the process-wide search cap is reached", async function () {
        const original = engineService.computeMove;
        const pending = deferred();
        engineService.computeMove = function () {
            return pending.promise;
        };
        try {
            const globalMax = brainGuards.engineGate.stats().globalMax;
            const inFlight = [];
            for (let i = 0; i < globalMax; i += 1) {
                inFlight.push(
                    brainApi.computeMove(fakeReq({ gameState: {} }, "user-" + i), fakeRes(), rethrow),
                );
            }

            const busyRes = fakeRes();
            await brainApi.computeMove(fakeReq({ gameState: {} }, "user-late"), busyRes, rethrow);
            assert.strictEqual(busyRes.statusCode, 503);
            assert.strictEqual(busyRes.headers["retry-after"], "5");

            pending.resolve({ source: {}, target: {} });
            await Promise.all(inFlight);
        } finally {
            engineService.computeMove = original;
        }
    });

    it("keeps abort reachable while the search cap is saturated", async function () {
        const originalCompute = engineService.computeMove;
        const originalAbort = engineService.abortSearch;
        const pending = deferred();
        let aborted = false;
        engineService.computeMove = function () {
            return pending.promise;
        };
        engineService.abortSearch = function () {
            aborted = true;
        };
        try {
            const running = brainApi.computeMove(fakeReq({ gameState: {} }), fakeRes(), rethrow);
            const abortRes = fakeRes();
            await brainApi.abortSearch(fakeReq({}), abortRes, rethrow);
            assert.strictEqual(aborted, true);
            assert.deepStrictEqual(abortRes.payload, { ok: true });

            pending.resolve({ source: {}, target: {} });
            await running;
        } finally {
            engineService.computeMove = originalCompute;
            engineService.abortSearch = originalAbort;
        }
    });

    it("still maps a disabled engine to 403", async function () {
        const original = engineService.computeMove;
        engineService.computeMove = async function () {
            const err = new Error("Engine \"brain43\" is disabled by an administrator");
            err.code = "ENGINE_DISABLED";
            throw err;
        };
        try {
            const res = fakeRes();
            await brainApi.computeMove(fakeReq({ gameState: {} }), res, rethrow);
            assert.strictEqual(res.statusCode, 403);
            assert.strictEqual(res.payload.ok, false);
        } finally {
            engineService.computeMove = original;
        }
    });
});

describe("brain rate limiting", function () {
    it("throttles per session user and answers JSON 429 on /api paths", async function () {
        const limiter = createRateLimiter({
            windowMs: 60000,
            max: 2,
            keyFn: brainGuards.brainClientKey,
            message: "Too many engine requests. Try again shortly.",
        });
        const app = express();
        let currentUser = "alice";
        app.use(function (req, _res, next) {
            req.session = { user_id: currentUser };
            next();
        });
        app.post("/api/brain/compute-move", limiter, function (_req, res) {
            res.json({ ok: true });
        });

        await request(app).post("/api/brain/compute-move").expect(200);
        await request(app).post("/api/brain/compute-move").expect(200);
        const blocked = await request(app).post("/api/brain/compute-move").expect(429);
        assert.strictEqual(blocked.body.ok, false);
        assert.match(blocked.body.message, /Too many engine requests/);
        assert.ok(blocked.headers["retry-after"], "expected a Retry-After header");

        // A different account has its own bucket.
        currentUser = "bob";
        await request(app).post("/api/brain/compute-move").expect(200);
    });

    it("exposes the brain limiter for test resets", function () {
        assert.strictEqual(typeof brainGuards.brainRateLimit, "function");
        assert.strictEqual(typeof brainGuards.brainRateLimit.reset, "function");
    });
});

describe("desktopBrainService evaluatePosition", function () {
    it("rejects when game state is missing", async function () {
        await assert.rejects(() => desktopBrainService.evaluatePosition({ engine: "brain43" }));
    });
});
