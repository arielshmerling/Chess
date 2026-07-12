/**
 * HTTP brain endpoints for the web Play page (in-process engine on the server).
 */

const catchAsync = require("../utils/catchAsync");
const desktopBrainService = require("../desktop/desktopBrainService");

exports.computeMove = catchAsync(async (req, res) => {
    const move = await desktopBrainService.computeMove(req.body || {});
    res.json({ ok: true, move });
});

exports.evaluatePosition = catchAsync(async (req, res) => {
    const result = await desktopBrainService.evaluatePosition(req.body || {});
    res.json({ ok: true, result });
});

exports.abortSearch = catchAsync(async (_req, res) => {
    desktopBrainService.abortSearch();
    res.json({ ok: true });
});
