/**
 * Admin-only toggle for routing lobby flows to /play instead of /game.
 */

const catchAsync = require("../utils/catchAsync");
const ExpressError = require("../utils/ExpressError");
const { User } = require("../modules/user/model");
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

exports.getLaunchContext = catchAsync(async (req, res) => {
    const user = await User.findById(req.session.user_id)
        .select("username lastGameOptions")
        .lean();
    res.json({
        ok: true,
        username: user && user.username ? user.username : req.session.user_name || "Player",
        lastGameOptions: user && user.lastGameOptions ? user.lastGameOptions : null,
    });
});
