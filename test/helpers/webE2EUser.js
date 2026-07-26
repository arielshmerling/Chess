/**
 * Ensures dedicated non-admin web users exist for HTTP / Playwright tests.
 * Credentials come from E2E_USERNAME / E2E_PASSWORD, or stable local defaults.
 *
 * Does not modify application source — only upserts Mongo user documents.
 */
require("dotenv").config();

const bcrypt = require("bcryptjs");
const { Database } = require("../../src/db/database");
const { User } = require("../../src/modules/user/model");

const DEFAULT_USERNAME = "e2e_web_member";
const DEFAULT_PASSWORD = "E2eTestPass!123";
const DEFAULT_OTHER_USERNAME = "e2e_web_other";

function getWebE2EDatabaseUrl() {
    if (process.env.E2E_DATABASE_URL) {
        return process.env.E2E_DATABASE_URL;
    }

    const source = process.env.DATABASE_URL;
    if (!source) {
        throw new Error("DATABASE_URL or E2E_DATABASE_URL is required for web tests");
    }
    if (!/\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//i.test(source)) {
        throw new Error(
            "Refusing to write web test data to a remote database. Set E2E_DATABASE_URL to a dedicated test database."
        );
    }

    const match = source.match(/^(mongodb:\/\/[^/]+\/)([^?]+)(.*)$/i);
    if (!match) {
        throw new Error("Could not derive a local web test database from DATABASE_URL");
    }
    const databaseName = match[2].endsWith("_e2e") ? match[2] : `${match[2]}_e2e`;
    return `${match[1]}${databaseName}${match[3]}`;
}

function getWebE2ECredentials() {
    return {
        username: process.env.E2E_USERNAME || DEFAULT_USERNAME,
        password: process.env.E2E_PASSWORD || DEFAULT_PASSWORD,
    };
}

function getWebE2EOtherCredentials() {
    return {
        username: process.env.E2E_OTHER_USERNAME || DEFAULT_OTHER_USERNAME,
        password: process.env.E2E_OTHER_PASSWORD || DEFAULT_PASSWORD,
    };
}

/**
 * @param {{ username: string, password: string }} creds
 * @param {"Member"|"Partner"|"Admin"} userType
 * @returns {Promise<{ username: string, password: string, id: string, userType: string }>}
 */
async function upsertTypedUser(creds, userType) {
    const hash = await bcrypt.hash(creds.password, 12);
    const type = userType === "Admin" || userType === "Partner" ? userType : "Member";
    let user = await User.findOne({ username: creds.username });

    if (!user) {
        user = new User({
            username: creds.username,
            password: hash,
            email: `${creds.username}@example.test`,
            level: "1",
            userType: type,
            admin: type === "Admin",
        });
        await user.save();
    } else {
        user.password = hash;
        user.userType = type;
        user.admin = type === "Admin";
        await user.save();
    }

    return {
        username: creds.username,
        password: creds.password,
        id: String(user._id),
        userType: type,
    };
}

/**
 * @param {{ username: string, password: string }} creds
 * @returns {Promise<{ username: string, password: string, id: string }>}
 */
async function upsertMemberUser(creds) {
    return upsertTypedUser(creds, "Member");
}

function getWebE2EPartnerCredentials() {
    return {
        username: process.env.E2E_PARTNER_USERNAME || "e2e_web_partner",
        password: process.env.E2E_PARTNER_PASSWORD || DEFAULT_PASSWORD,
    };
}

async function connectWebE2EDb() {
    if (!process.env.SESSION_SECRET) {
        throw new Error("SESSION_SECRET is required for web e2e / API tests");
    }
    process.env.DATABASE_URL = getWebE2EDatabaseUrl();
    await Database.getInstance().connect();
}

/**
 * Connect Mongo (idempotent) and ensure the primary e2e member can log in.
 * @returns {Promise<{ username: string, password: string, id: string }>}
 */
async function ensureWebE2EUser() {
    await connectWebE2EDb();
    return upsertMemberUser(getWebE2ECredentials());
}

/**
 * Primary + secondary members for friends invite / search scenarios.
 * @returns {Promise<{ primary: object, other: object }>}
 */
async function ensureWebE2EUsers() {
    await connectWebE2EDb();
    const primary = await upsertMemberUser(getWebE2ECredentials());
    const other = await upsertMemberUser(getWebE2EOtherCredentials());
    return { primary, other };
}

/**
 * Partner user for advanced Play features (theme editor, config, etc.).
 * @returns {Promise<{ username: string, password: string, id: string, userType: string }>}
 */
async function ensureWebE2EPartner() {
    await connectWebE2EDb();
    return upsertTypedUser(getWebE2EPartnerCredentials(), "Partner");
}

module.exports = {
    getWebE2EDatabaseUrl,
    getWebE2ECredentials,
    getWebE2EOtherCredentials,
    getWebE2EPartnerCredentials,
    ensureWebE2EUser,
    ensureWebE2EUsers,
    ensureWebE2EPartner,
    DEFAULT_USERNAME,
    DEFAULT_OTHER_USERNAME,
};
