/**
 * Admin-only toggle for routing lobby flows to /play instead of /game.
 */

const catchAsync = require("../utils/catchAsync");
const ExpressError = require("../utils/ExpressError");
const webPlayPrefsStore = require("./webPlayPrefsStore");

exports.getPreferPlayPage = catchAsync(async (req, res) => {
    if (!req.session.admin) {
        throw new ExpressError("Admin only", 403);
    }
    res.json({
        ok: true,
        preferPlayPage: !!req.session.preferPlayPage,
    });
});

exports.setPreferPlayPage = catchAsync(async (req, res) => {
    if (!req.session.admin) {
        throw new ExpressError("Admin only", 403);
    }
    const enabled = !!(req.body && req.body.preferPlayPage);
    await webPlayPrefsStore.writePreferPlayPage(req.session.user_id, enabled);
    req.session.preferPlayPage = enabled;
    res.json({
        ok: true,
        preferPlayPage: enabled,
    });
});
