/**
 * Desktop custom theme HTTP handlers (JSON file store).
 */

const catchAsync = require("../utils/catchAsync");
const customThemeStore = require("./customThemeStore");

exports.get = catchAsync(async (_req, res) => {
    const store = await customThemeStore.readAll();
    res.json(store);
});

exports.save = catchAsync(async (req, res) => {
    const store = await customThemeStore.writeAll(req.body || {});
    res.json(store);
});
