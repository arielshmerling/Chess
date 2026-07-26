/**
 * Web custom-theme HTTP handlers (Mongo user prefs).
 */

const catchAsync = require("../utils/catchAsync");
const webPlayPrefsStore = require("./webPlayPrefsStore");
const { canCustomizeThemes } = require("../modules/user/roles");

exports.get = catchAsync(async (req, res) => {
    const store = await webPlayPrefsStore.readCustomThemes(req.session.user_id);
    res.json(store);
});

exports.save = catchAsync(async (req, res) => {
    const body = req.body || {};
    if (!canCustomizeThemes(req.session)) {
        // Members may switch the active theme, but not edit the theme catalog.
        const store = await webPlayPrefsStore.writeActiveThemeOnly(
            req.session.user_id,
            body.activeTheme,
        );
        return res.json(store);
    }
    const store = await webPlayPrefsStore.writeCustomThemes(req.session.user_id, body);
    res.json(store);
});
