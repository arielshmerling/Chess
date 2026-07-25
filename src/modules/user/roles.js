/**
 * Session-based role capabilities for Admin / Partner / Member.
 * `session.admin` remains authoritative for Admin (legacy); Partner/Member use `userType`.
 */

const { USER_TYPES, resolveUserType } = require("./model");

/**
 * @param {{ admin?: boolean, userType?: string }|null|undefined} session
 * @returns {"Admin"|"Partner"|"Member"}
 */
function resolveSessionUserType(session) {
    return resolveUserType(session || {});
}

/**
 * @param {{ admin?: boolean, userType?: string }|null|undefined} session
 */
function isAdminSession(session) {
    return resolveSessionUserType(session) === "Admin";
}

/**
 * Debug (PracticeGame / gameType 3) — Admin and Partner.
 * @param {{ admin?: boolean, userType?: string }|null|undefined} session
 */
function canAccessDebug(session) {
    const type = resolveSessionUserType(session);
    return type === "Admin" || type === "Partner";
}

/**
 * New Play shell (/play) — Admin, Partner, and Member (any logged-in session).
 * @param {{ user_id?: *, admin?: boolean, userType?: string }|null|undefined} session
 */
function canAccessPlayPage(session) {
    return !!(session && session.user_id);
}

/**
 * Position Setup + Brain Config on the Play shell — Admin and Partner only.
 * @param {{ admin?: boolean, userType?: string }|null|undefined} session
 */
function canUsePlayAdvancedTools(session) {
    const type = resolveSessionUserType(session);
    return type === "Admin" || type === "Partner";
}

module.exports = {
    USER_TYPES,
    resolveSessionUserType,
    isAdminSession,
    canAccessDebug,
    canAccessPlayPage,
    canUsePlayAdvancedTools,
};
