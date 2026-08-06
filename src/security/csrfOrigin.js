/**
 * CSRF mitigation for cookie-session apps: require same-origin Origin or Referer
 * on state-changing requests. Complements SameSite=lax cookies.
 *
 * SEC-04: Never trust a client-supplied X-Forwarded-Host as the expected host.
 * Prefer Express req.hostname (respects trust proxy) and optional ALLOWED_HOST(S).
 */

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
function requestHost(req) {
    const allowed = allowedHostsFromEnv();
    if (allowed.length === 1) {
        return allowed[0];
    }

    const hostname = req && typeof req.hostname === "string" ? req.hostname.trim().toLowerCase() : "";
    if (hostname) {
        if (allowed.length && !hostMatchesAllowlist(hostname, allowed)) {
            return "";
        }
        const port = requestPort(req);
        return port ? hostname + ":" + port : hostname;
    }

    /* Last resort: Host header only — never X-Forwarded-Host alone. */
    const raw = (req && req.get && req.get("host")) || "";
    const host = String(raw).split(",")[0].trim().toLowerCase();
    if (allowed.length && host && !hostMatchesAllowlist(host.split(":")[0], allowed)) {
        return "";
    }
    return host;
}

/**
 * @returns {string[]}
 */
function allowedHostsFromEnv() {
    const raw = process.env.ALLOWED_HOSTS || process.env.ALLOWED_HOST || "";
    return String(raw)
        .split(",")
        .map(function (h) {
            return h.trim().toLowerCase();
        })
        .filter(Boolean);
}

/**
 * @param {string} hostname Host without port, or host:port.
 * @param {string[]} allowed
 * @returns {boolean}
 */
function hostMatchesAllowlist(hostname, allowed) {
    const bare = String(hostname).split(":")[0].toLowerCase();
    return allowed.some(function (entry) {
        const entryBare = entry.split(":")[0];
        return entry === hostname || entryBare === bare || entry === bare;
    });
}

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
function requestPort(req) {
    const hostHeader = (req && req.get && req.get("host")) || "";
    const fromHeader = String(hostHeader).split(",")[0].trim();
    const colon = fromHeader.lastIndexOf(":");
    if (colon > 0 && fromHeader.indexOf("]") < colon) {
        return fromHeader.slice(colon + 1);
    }
    return "";
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
    requestHost,
};
