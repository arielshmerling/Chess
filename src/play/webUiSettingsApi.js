/**
 * Web Play UI settings HTTP handlers (Mongo user prefs).
 */

const catchAsync = require("../utils/catchAsync");
const webPlayPrefsStore = require("./webPlayPrefsStore");

exports.get = catchAsync(async (req, res) => {
    const settings = await webPlayPrefsStore.readUiSettings(req.session.user_id);
    res.json(settings);
});

exports.save = catchAsync(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const settings = await webPlayPrefsStore.writeUiSettings(req.session.user_id, body);
    res.json(settings);
});
