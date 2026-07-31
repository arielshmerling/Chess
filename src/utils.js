
const { isAdminSession } = require("./modules/user/roles");

/** JSON / data routes that are not under /api but must not become login returnTo. */
const DATA_PATHS = new Set([
    "/active-games",
    "/gameInfo",
    "/gameMoves",
    "/brain-config",
    "/validateUsername",
    "/bookmark",
]);

function requestPath(req) {
    return String(req && req.originalUrl ? req.originalUrl : "").split(/[?#]/, 1)[0];
}

function isApiPath(pathname) {
    if (
        pathname === "/api" ||
        pathname.startsWith("/api/") ||
        pathname === "/app/api" ||
        pathname.startsWith("/app/api/")
    ) {
        return true;
    }
    return DATA_PATHS.has(pathname);
}

/** Browser fetch() / XHR — never store these URLs as post-login destinations. */
function isNonNavigationalRequest(req) {
    if (isApiPath(requestPath(req))) {
        return true;
    }
    const dest = req && typeof req.get === "function" ? req.get("sec-fetch-dest") : "";
    if (dest === "empty") {
        return true;
    }
    const accept = String(req && typeof req.get === "function" ? req.get("accept") || "" : "");
    if (accept.includes("application/json") && !accept.includes("text/html")) {
        return true;
    }
    return false;
}

exports.normalizeReturnTo = (value) => {
    if (typeof value !== "string" ||
        value.charAt(0) !== "/" ||
        value.charAt(1) === "/" ||
        value.charAt(1) === "\\") {
        return "/Home";
    }
    return isApiPath(value.split(/[?#]/, 1)[0]) ? "/Home" : value;
};

exports.requireLogin = async (req, res, next) => {

    if (!req || !req.session || !req.session.user_id) {
        if (isNonNavigationalRequest(req)) {
            return res.status(401).json({ ok: false });
        }
        req.session.returnTo = req.originalUrl;
        console.log("The user is not authenticated. Redirecting to login");
        return res.redirect("/login");
    }
    return next();
};


exports.requiresAdmin = async (req, res, next) => {
    if (!req || !req.session || !req.session.user_id || !isAdminSession(req.session)) {
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
