/**
 * adminPrivilegeNotify — skip channels when unconfigured; send when stubbed.
 */
"use strict";

const assert = require("assert");
const Module = require("module");

describe("adminPrivilegeNotify", function () {
    const envKeys = [
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USER",
        "SMTP_PASS",
        "SMTP_FROM",
        "ADMIN_NOTIFY_EMAILS",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER",
        "ADMIN_NOTIFY_SMS",
    ];
    let savedEnv;
    let originalLoad;
    let createTransportCalls;
    let sendMailCalls;
    let fetchCalls;
    let originalFetch;

    beforeEach(function () {
        savedEnv = {};
        for (const k of envKeys) {
            savedEnv[k] = process.env[k];
            delete process.env[k];
        }
        createTransportCalls = [];
        sendMailCalls = [];
        fetchCalls = [];
        originalFetch = global.fetch;
        originalLoad = Module._load;
        Module._load = function (request, parent, isMain) {
            if (request === "nodemailer") {
                return {
                    createTransport(opts) {
                        createTransportCalls.push(opts);
                        return {
                            async sendMail(mail) {
                                sendMailCalls.push(mail);
                            },
                        };
                    },
                };
            }
            return originalLoad.apply(this, arguments);
        };
        delete require.cache[require.resolve("../src/utils/adminPrivilegeNotify")];
    });

    afterEach(function () {
        Module._load = originalLoad;
        global.fetch = originalFetch;
        for (const k of envKeys) {
            if (savedEnv[k] === undefined) {
                delete process.env[k];
            } else {
                process.env[k] = savedEnv[k];
            }
        }
        delete require.cache[require.resolve("../src/utils/adminPrivilegeNotify")];
    });

    it("no-ops when neither SMTP nor Twilio is configured", async function () {
        const { notifyAdminPrivilegeChange } = require("../src/utils/adminPrivilegeNotify");
        await notifyAdminPrivilegeChange({
            actorUsername: "admin",
            targetUsername: "bob",
            targetUserId: "1",
            wasAdmin: false,
            isAdmin: true,
        });
        assert.strictEqual(createTransportCalls.length, 0);
        assert.strictEqual(fetchCalls.length, 0);
    });

    it("sends email on grant with STARTTLS port 587", async function () {
        process.env.SMTP_HOST = "smtp.example.com";
        process.env.SMTP_PORT = "587";
        process.env.SMTP_USER = "u";
        process.env.SMTP_PASS = "p";
        process.env.ADMIN_NOTIFY_EMAILS = " a@x.com , b@y.com ";
        const { notifyAdminPrivilegeChange } = require("../src/utils/adminPrivilegeNotify");
        await notifyAdminPrivilegeChange({
            actorUsername: "admin",
            targetUsername: "bob",
            targetUserId: "42",
            wasAdmin: false,
            isAdmin: true,
        });
        assert.strictEqual(createTransportCalls.length, 1);
        assert.strictEqual(createTransportCalls[0].secure, false);
        assert.strictEqual(createTransportCalls[0].requireTLS, true);
        assert.strictEqual(sendMailCalls.length, 1);
        assert.ok(sendMailCalls[0].text.includes("GRANTED"));
        assert.ok(sendMailCalls[0].text.includes("bob"));
        assert.strictEqual(sendMailCalls[0].to, "a@x.com, b@y.com");
    });

    it("uses implicit TLS on port 465 and revoke wording", async function () {
        process.env.SMTP_HOST = "smtp.example.com";
        process.env.SMTP_PORT = "465";
        process.env.SMTP_FROM = "from@x.com";
        process.env.ADMIN_NOTIFY_EMAILS = "ops@x.com";
        const { notifyAdminPrivilegeChange } = require("../src/utils/adminPrivilegeNotify");
        await notifyAdminPrivilegeChange({
            actorUsername: "admin",
            targetUsername: "bob",
            targetUserId: "42",
            wasAdmin: true,
            isAdmin: false,
        });
        assert.strictEqual(createTransportCalls[0].secure, true);
        assert.strictEqual(createTransportCalls[0].requireTLS, false);
        assert.ok(sendMailCalls[0].text.includes("REVOKED"));
        assert.strictEqual(sendMailCalls[0].from, "from@x.com");
    });

    it("sends SMS via Twilio when configured", async function () {
        process.env.TWILIO_ACCOUNT_SID = "ACxxx";
        process.env.TWILIO_AUTH_TOKEN = "tok";
        process.env.TWILIO_PHONE_NUMBER = "+15550001";
        process.env.ADMIN_NOTIFY_SMS = " +15550002 ";
        global.fetch = async function (url, init) {
            fetchCalls.push({ url, init });
            return { ok: true, text: async () => "ok" };
        };
        const { notifyAdminPrivilegeChange } = require("../src/utils/adminPrivilegeNotify");
        await notifyAdminPrivilegeChange({
            actorUsername: "admin",
            targetUsername: "bob",
            targetUserId: "42",
            wasAdmin: false,
            isAdmin: true,
        });
        assert.strictEqual(fetchCalls.length, 1);
        assert.ok(String(fetchCalls[0].url).includes("ACxxx"));
        assert.strictEqual(fetchCalls[0].init.method, "POST");
    });

    it("logs Twilio HTTP failures without throwing", async function () {
        process.env.TWILIO_ACCOUNT_SID = "ACxxx";
        process.env.TWILIO_AUTH_TOKEN = "tok";
        process.env.TWILIO_PHONE_NUMBER = "+15550001";
        process.env.ADMIN_NOTIFY_SMS = "+15550002";
        global.fetch = async function () {
            return { ok: false, status: 500, text: async () => "boom" };
        };
        const errors = [];
        const origErr = console.error;
        console.error = function (...args) {
            errors.push(args.join(" "));
        };
        try {
            const { notifyAdminPrivilegeChange } = require("../src/utils/adminPrivilegeNotify");
            await notifyAdminPrivilegeChange({
                actorUsername: "admin",
                targetUsername: "bob",
                targetUserId: "42",
                wasAdmin: true,
                isAdmin: true,
            });
        } finally {
            console.error = origErr;
        }
        assert.ok(errors.some((e) => e.includes("sms")));
    });
});
