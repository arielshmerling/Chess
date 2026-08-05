/**
 * HTTP brain/engine endpoints for the web Play page.
 *
 * Search requests run under a concurrency gate (see brainGuards) so no single
 * caller can occupy the CPU with parallel searches.
 */

const catchAsync = require("../utils/catchAsync");
const engineService = require("../engines/engineService");
const gate = require("../security/concurrencyGate");
const { brainClientKey, engineGate } = require("./brainGuards");

/**
 * Translate engine/gate failures into HTTP responses.
 *
 * @param {import('express').Response} res
 * @param {any} err
 * @returns {boolean} True when the error was handled.
 */
function respondEngineError(res, err) {
    const code = err && err.code;
    if (code === "ENGINE_DISABLED") {
        res.status(403).json({ ok: false, message: err.message });
        return true;
    }
    if (code === gate.BUSY_KEY) {
        res.set("Retry-After", "2");
        res.status(429).json({ ok: false, message: err.message });
        return true;
    }
    if (code === gate.BUSY_GLOBAL) {
        res.set("Retry-After", "5");
        res.status(503).json({ ok: false, message: err.message });
        return true;
    }
    if (code === gate.TIMEOUT) {
        res.status(504).json({ ok: false, message: err.message });
        return true;
    }
    return false;
}

/**
 * Reject obviously malformed search requests before any CPU is spent.
 * Detailed shape checks stay in the engine layer.
 *
 * @param {any} body
 * @returns {object} The validated body.
 * @throws {Error & { statusCode: number }}
 */
function requireSearchBody(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        const err = new Error("A JSON request body is required.");
        err.statusCode = 400;
        throw err;
    }
    if (body.gameState == null || body.gameState === "") {
        const err = new Error("gameState is required.");
        err.statusCode = 400;
        throw err;
    }
    return body;
}

/**
 * Shared wrapper: validate, then run the engine call under the gate.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {(body: object) => Promise<any>} work
 * @param {string} payloadKey Response property carrying the result.
 */
async function runGuardedSearch(req, res, work, payloadKey) {
    let body;
    try {
        body = requireSearchBody(req.body);
    } catch (err) {
        return res.status(err.statusCode || 400).json({ ok: false, message: err.message });
    }
    try {
        const value = await engineGate.run(brainClientKey(req), function () {
            return work(body);
        });
        return res.json({ ok: true, [payloadKey]: value });
    } catch (err) {
        if (respondEngineError(res, err)) {
            return undefined;
        }
        throw err;
    }
}

exports.computeMove = catchAsync(async (req, res) => {
    await runGuardedSearch(
        req,
        res,
        function (body) {
            return engineService.computeMove(body);
        },
        "move",
    );
});

exports.evaluatePosition = catchAsync(async (req, res) => {
    await runGuardedSearch(
        req,
        res,
        function (body) {
            return engineService.evaluatePosition(body);
        },
        "result",
    );
});

/**
 * Abort is deliberately outside the concurrency gate: it is cheap, and it must
 * stay reachable precisely when searches are saturating the gate.
 */
exports.abortSearch = catchAsync(async (_req, res) => {
    engineService.abortSearch();
    res.json({ ok: true });
});
