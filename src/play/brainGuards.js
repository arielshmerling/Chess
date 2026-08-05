/**
 * Abuse controls for the /api/brain/* engine endpoints.
 *
 * Engine searches are the most expensive work the server does (thinking time is
 * clamped to at most 120s per search), so authentication alone is not enough:
 * one logged-in account could otherwise saturate every core. These guards cap
 * request rate and simultaneous searches per user and process-wide.
 */

const { createRateLimiter } = require("../security/rateLimit");
const { createConcurrencyGate } = require("../security/concurrencyGate");

/**
 * @param {string} name Environment variable name.
 * @param {number} fallback Used when unset or not a positive number.
 * @returns {number}
 */
function envInt(name, fallback) {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Identify the caller for throttling. Brain routes sit behind requireLogin, so
 * the session user is normally present; IP is only a fallback.
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function brainClientKey(req) {
    const userId = req && req.session && req.session.user_id;
    if (userId) {
        return "user:" + String(userId);
    }
    return "ip:" + String((req && req.ip) || "unknown");
}

/**
 * Per-user request rate cap across all brain endpoints. Generous enough for
 * normal play (one search per move, plus evaluation polling) while still
 * bounding a scripted flood.
 */
const brainRateLimit = createRateLimiter({
    windowMs: 60 * 1000,
    max: envInt("BRAIN_RATE_LIMIT_MAX", 120),
    keyFn: brainClientKey,
    message: "Too many engine requests. Try again shortly.",
});

/**
 * Simultaneous search cap. One search per user matches what the UI actually
 * needs; the global cap leaves headroom for the rest of the server.
 */
const engineGate = createConcurrencyGate({
    perKeyMax: envInt("BRAIN_MAX_CONCURRENT_PER_USER", 1),
    globalMax: envInt("BRAIN_MAX_CONCURRENT_TOTAL", 4),
    timeoutMs: envInt("BRAIN_SEARCH_TIMEOUT_MS", 180000),
    keyMessage: "An engine search is already running for your session.",
    globalMessage: "The engine is busy. Try again in a moment.",
    timeoutMessage: "The engine search took too long.",
});

module.exports = {
    brainClientKey,
    brainRateLimit,
    engineGate,
};
