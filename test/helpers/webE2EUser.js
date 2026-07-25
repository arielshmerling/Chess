/**
 * Ensures a dedicated non-admin web user exists for HTTP / Playwright tests.
 * Credentials come from E2E_USERNAME / E2E_PASSWORD, or stable local defaults.
 *
 * Does not modify application source — only upserts a Mongo user document.
 */
require("dotenv").config();

const bcrypt = require("bcryptjs");
const { Database } = require("../../src/db/database");
const { User } = require("../../src/modules/user/model");

const DEFAULT_USERNAME = "e2e_web_member";
const DEFAULT_PASSWORD = "E2eTestPass!123";

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

/**
 * Connect Mongo (idempotent) and ensure the e2e member user can log in.
 * @returns {Promise<{ username: string, password: string }>}
 */
async function ensureWebE2EUser() {
    if (!process.env.SESSION_SECRET) {
        throw new Error("SESSION_SECRET is required for web e2e / API tests");
    }

    process.env.DATABASE_URL = getWebE2EDatabaseUrl();
    await Database.getInstance().connect();

    const { username, password } = getWebE2ECredentials();
    const hash = await bcrypt.hash(password, 12);
    let user = await User.findOne({ username });

    if (!user) {
        user = new User({
            username,
            password: hash,
            email: `${username}@example.test`,
            level: "1",
            userType: "Member",
            admin: false,
        });
        await user.save();
    } else {
        user.password = hash;
        user.admin = false;
        user.userType = "Member";
        await user.save();
    }

    return { username, password };
}

module.exports = {
    getWebE2EDatabaseUrl,
    getWebE2ECredentials,
    ensureWebE2EUser,
    DEFAULT_USERNAME,
};
