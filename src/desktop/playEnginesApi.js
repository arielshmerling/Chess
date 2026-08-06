/**
 * Desktop Play engine catalog for the New Game / Game Run menus.
 */
const catchAsync = require("../utils/catchAsync");
const engineService = require("../engines/engineService");

exports.listPlay = catchAsync(async (_req, res) => {
    const engines = await engineService.listPlayEnginesForClient();
    res.json({ ok: true, engines: engines || [] });
});
