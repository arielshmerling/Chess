const runtime = require("./runtime");

function ensureGuestSession(req, _res, next) {
    if (!runtime.isDesktopMode()) {
        return next();
    }
    if (!req.session) {
        return next();
    }
    const uid = req.session.user_id != null ? String(req.session.user_id) : "";
    const validGuestId = /^[a-f0-9]{24}$/i.test(uid);
    if (!validGuestId) {
        req.session.user_id = runtime.GUEST_USER_ID;
        req.session.user_name = runtime.GUEST_USER_NAME;
    }
    if (req.session.admin == null) {
        req.session.admin = false;
    }
    return next();
}

function setDesktopLocals(req, res, next) {
    if (runtime.isDesktopMode()) {
        res.locals.isDesktop = true;
        res.locals.username = req.session.user_name || runtime.GUEST_USER_NAME;
        res.locals.admin = !!req.session.admin;
    }
    return next();
}

module.exports = {
    ensureGuestSession,
    setDesktopLocals,
};
