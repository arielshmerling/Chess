/**
 * HTTP brain/engine endpoints for the web Play page.
 */

const catchAsync = require("../utils/catchAsync");
const engineService = require("../engines/engineService");

exports.computeMove = catchAsync(async (req, res) => {
    const move = await engineService.computeMove(req.body || {});
    res.json({ ok: true, move });
});

exports.evaluatePosition = catchAsync(async (req, res) => {
    const result = await engineService.evaluatePosition(req.body || {});
    res.json({ ok: true, result });
});

exports.abortSearch = catchAsync(async (_req, res) => {
    engineService.abortSearch();
    res.json({ ok: true });
});
