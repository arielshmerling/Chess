/**
 * CSRF mitigation for cookie-session apps: require same-origin Origin or Referer
 * on state-changing requests. Complements SameSite=lax cookies.
 */

function requestHost(req) {
    const raw = req.get("x-forwarded-host") || req.get("host") || "";
    return String(raw).split(",")[0].trim().toLowerCase();
}

function originHost(originHeader) {
    if (!originHeader) {
        return null;
    }
    try {
        return new URL(originHeader).host.toLowerCase();
    } catch {
        return null;
    }
}

function refererHost(refererHeader) {
    if (!refererHeader) {
        return null;
    }
    try {
        return new URL(refererHeader).host.toLowerCase();
    } catch {
        return null;
    }
}

/**
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isSameOriginMutatingRequest(req) {
    const method = String(req.method || "GET").toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
        return true;
    }
    const host = requestHost(req);
    if (!host) {
        return false;
    }
    const fromOrigin = originHost(req.get("origin"));
    if (fromOrigin) {
        return fromOrigin === host;
    }
    const fromReferer = refererHost(req.get("referer"));
    if (fromReferer) {
        return fromReferer === host;
    }
    /* No Origin/Referer: allow non-browser clients (curl, tests) in non-production. */
    if (process.env.NODE_ENV !== "production") {
        return true;
    }
    return false;
}

function csrfSameOrigin(req, res, next) {
    if (isSameOriginMutatingRequest(req)) {
        return next();
    }
    if (req.path && req.path.startsWith("/api/")) {
        return res.status(403).json({ ok: false, message: "Forbidden" });
    }
    return res.status(403).send("Forbidden");
}

module.exports = {
    csrfSameOrigin,
    isSameOriginMutatingRequest,
};
