/**
 * Web custom-theme HTTP handlers (Mongo user prefs).
 */

const catchAsync = require("../utils/catchAsync");
const webPlayPrefsStore = require("./webPlayPrefsStore");

exports.get = catchAsync(async (req, res) => {
    const store = await webPlayPrefsStore.readCustomThemes(req.session.user_id);
    res.json(store);
});

exports.save = catchAsync(async (req, res) => {
    const store = await webPlayPrefsStore.writeCustomThemes(req.session.user_id, req.body || {});
    res.json(store);
});
