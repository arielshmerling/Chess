/**
 * Simple in-memory rate limiter (no external dependency).
 * Suitable for single-process deploys; replace with Redis-backed limiter for multi-instance.
 */

/**
 * @param {{ windowMs: number, max: number, keyFn?: (req: import('express').Request) => string, message?: string }} opts
 */
function createRateLimiter(opts) {
    const windowMs = opts.windowMs;
    const max = opts.max;
    const keyFn =
        opts.keyFn ||
        function (req) {
            return String(req.ip || req.connection && req.connection.remoteAddress || "unknown");
        };
    const message = opts.message || "Too many requests. Try again later.";
    const hits = new Map();

    function prune(now) {
        if (hits.size < 5000) {
            return;
        }
        for (const [k, v] of hits) {
            if (now - v.start > windowMs) {
                hits.delete(k);
            }
        }
    }

    function rateLimit(req, res, next) {
        const now = Date.now();
        prune(now);
        const key = keyFn(req);
        let entry = hits.get(key);
        if (!entry || now - entry.start > windowMs) {
            entry = { start: now, count: 0 };
            hits.set(key, entry);
        }
        entry.count += 1;
        if (entry.count > max) {
            res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
            if (req.path && req.path.startsWith("/api/")) {
                return res.status(429).json({ ok: false, message });
            }
            if (typeof req.flash === "function") {
                req.flash("messages", message);
            }
            if (req.path === "/login" || req.path === "/api/login") {
                return res.status(429).redirect("/login");
            }
            return res.status(429).send(message);
        }
        return next();
    }

    rateLimit.reset = function reset() {
        hits.clear();
    };

    rateLimit.max = max;

    return rateLimit;
}

module.exports = {
    createRateLimiter,
};
