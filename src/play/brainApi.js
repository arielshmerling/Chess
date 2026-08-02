/**
 * HTTP brain/engine endpoints for the web Play page.
 */

const catchAsync = require("../utils/catchAsync");
const engineService = require("../engines/engineService");

exports.computeMove = catchAsync(async (req, res) => {
    try {
        const move = await engineService.computeMove(req.body || {});
        res.json({ ok: true, move });
    } catch (err) {
        if (err && err.code === "ENGINE_DISABLED") {
            return res.status(403).json({ ok: false, message: err.message });
        }
        throw err;
    }
});

exports.evaluatePosition = catchAsync(async (req, res) => {
    try {
        const result = await engineService.evaluatePosition(req.body || {});
        res.json({ ok: true, result });
    } catch (err) {
        if (err && err.code === "ENGINE_DISABLED") {
            return res.status(403).json({ ok: false, message: err.message });
        }
        throw err;
    }
});

exports.abortSearch = catchAsync(async (_req, res) => {
    engineService.abortSearch();
    res.json({ ok: true });
});
