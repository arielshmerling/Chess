/**
 * Shared Helmet options for web + desktop.
 * Important: do not enable upgrade-insecure-requests on plain HTTP (breaks localhost).
 *
 * Script CSP (NFR-SEC-003 / ON-39): allow 'self', optional CDNs, and a per-response nonce.
 * Do not include 'unsafe-inline' in script-src — that re-enables XSS via injected
 * <script> / onclick= attributes. Inline <script> tags in EJS must carry nonce="…".
 * style-src may still use 'unsafe-inline' for legacy CSS patterns (separate from SEC-05).
 */
function buildHelmetOptions(options = {}) {
    const isProd = options.isProd === true;
    const scriptSrcUrl = options.scriptSrcUrl || [];
    const useScriptNonce = options.useScriptNonce !== false;

    const scriptSrc = ["'self'", ...scriptSrcUrl];
    if (useScriptNonce) {
        /* Helmet invokes this per request; nonce must already be on res.locals. */
        scriptSrc.push(function (req, res) {
            const nonce = res && res.locals && res.locals.cspNonce;
            return nonce ? "'nonce-" + nonce + "'" : null;
        });
    }

    const directives = {
        defaultSrc: ["'self'"],
        scriptSrc: scriptSrc,
        /* Explicitly ban HTML event-handler attributes (CSP3). */
        scriptSrcAttr: ["'none'"],
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
