

exports.requireLogin = async (req, res, next) => {

    if (!req || !req.session || !req.session.user_id) {
        req.session.returnTo = req.originalUrl;
        console.log("The user is not authenticated. Redirecting to login");
        return res.redirect("/login");
    }
    return next();
};


exports.requiresAdmin = async (req, res, next) => {
    if (!req || !req.session || !req.session.user_id || !req.session.admin) {
        console.log("The user is not an admin. Redirecting to login");
        return res.redirect("/login");
    }
    return next();
};

module.exports.storeReturnTo = (req, res, next) => {
    if (req.session.returnTo) {
        res.locals.returnTo = req.session.returnTo;
    }
    next();
};