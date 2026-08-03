/**
 * User type helpers shared by web (Mongo model) and desktop (no Mongo).
 * Keep this file free of mongoose so Electron can stage it alone.
 */

"use strict";

const USER_TYPES = ["Admin", "Partner", "Member"];

/**
 * Resolve userType for documents/sessions that predate the field.
 * @param {{ userType?: string, admin?: boolean }|null|undefined} user
 * @returns {"Admin"|"Partner"|"Member"}
 */
function resolveUserType(user) {
    // `admin` predates `userType`; it remains authoritative for legacy users
    // that may have received the new "Member" schema default.
    if (user && user.admin) {
        return "Admin";
    }
    if (user && USER_TYPES.includes(user.userType)) {
        return user.userType;
    }
    return "Member";
}

module.exports = {
    USER_TYPES,
    resolveUserType,
};
