/**
 * Shared Helmet options for web + desktop.
 * Important: do not enable upgrade-insecure-requests on plain HTTP (breaks localhost).
 * Do not put a CSP nonce alone in script-src — it disables 'unsafe-inline' and blocks
 * legacy onclick= handlers used across site pages (NFR-SEC-003 / ON-39 SEC-05).
 */
function buildHelmetOptions(options = {}) {
    const isProd = options.isProd === true;
    const scriptSrcUrl = options.scriptSrcUrl || [];
    const directives = {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", ...scriptSrcUrl],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:", "https://cdn.jsdelivr.net"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
    };
    if (isProd && options.upgradeInsecureRequests !== false) {
        directives.upgradeInsecureRequests = [];
    }
    return {
        contentSecurityPolicy: {
            useDefaults: false,
            directives,
        },
        /* Keep Referer for same-origin CSRF Origin/Referer checks. */
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        /* Never send HSTS on plain HTTP / local — browsers cache it and force HTTPS. */
        hsts: isProd,
    };
}

module.exports = {
    buildHelmetOptions,
};
