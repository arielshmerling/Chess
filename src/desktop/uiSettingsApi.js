/**
 * Desktop UI settings HTTP handlers (settings.json in userData).
 */

const catchAsync = require("../utils/catchAsync");
const uiSettingsStore = require("./uiSettingsStore");

exports.get = catchAsync(async (_req, res) => {
    const settings = await uiSettingsStore.readAll();
    res.json(settings);
});

exports.save = catchAsync(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const settings = await uiSettingsStore.writeAll(body);
    res.json(settings);
});
