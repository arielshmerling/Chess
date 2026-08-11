/**
 * Forgot / reset password flow (FR-AUTH-018…020).
 */
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const { loadWebApp, resetWebRateLimits } = require("./helpers/webApp");
const { ensureWebE2EUsers } = require("./helpers/webE2EUser");
const { User } = require("../src/modules/user/model");
const userService = require("../src/modules/user/service");

describe("password recovery", function () {
    this.timeout(30000);

    let app;
    const sentMails = [];

    before(async function () {
        await ensureWebE2EUsers();
        app = loadWebApp();
        userService._setPasswordResetSendMailForTests(async function (opts) {
            sentMails.push(opts);
        });
    });

    after(function () {
        userService._setPasswordResetSendMailForTests(null);
    });

    beforeEach(function () {
        resetWebRateLimits(app);
        sentMails.length = 0;
    });

    it("GET /forgot-password and /reset-password render pages", async function () {
        const forgot = await request(app).get("/forgot-password").expect(200);
        assert.match(forgot.text, /Forgot password/i);
        const missing = await request(app).get("/reset-password").expect(200);
        assert.match(missing.text, /missing or incomplete/i);
        const withToken = await request(app).get("/reset-password?token=abc").expect(200);
        assert.match(withToken.text, /Choose a new password/i);
        assert.match(withToken.text, /name="token"/);
    });

    it("POST /api/forgot-password does not reveal whether the email exists", async function () {
        const unknown = await request(app)
            .post("/api/forgot-password")
            .send({ email: "nobody-exists-" + Date.now() + "@example.test" })
            .expect(200);
        assert.strictEqual(unknown.body.ok, true);
        assert.match(String(unknown.body.message || ""), /If an account exists/i);
        assert.strictEqual(sentMails.length, 0);
    });

    it("sends recovery email for each account sharing the same email", async function () {
        const stamp = Date.now();
        const sharedEmail = `shared_${stamp}@example.test`;
        const password = "SharedPass!123";
        const hash = await bcrypt.hash(password, 12);
        const names = [`pwshare_a_${stamp}`, `pwshare_b_${stamp}`];
        for (let i = 0; i < names.length; i += 1) {
            await User.create({
                username: names[i],
                password: hash,
                email: sharedEmail,
                level: "Rookie",
                userType: "Member",
                admin: false,
            });
        }

        const requested = await request(app)
            .post("/api/forgot-password")
            .send({ email: sharedEmail })
            .expect(200);
        assert.strictEqual(requested.body.ok, true);
        assert.strictEqual(sentMails.length, 2);
        const subjects = sentMails.map(function (m) { return m.subject; }).sort();
        assert.ok(subjects[0].includes(names[0]) || subjects[1].includes(names[0]));
        assert.ok(subjects[0].includes(names[1]) || subjects[1].includes(names[1]));

        await User.deleteMany({ username: { $in: names } });
    });

    it("sends a recovery email and completes reset with matching email", async function () {
        const username = `pwreset_${Date.now()}`;
        const email = `${username}@example.test`;
        const oldPassword = "OldPass!1234";
        const newPassword = "NewPass!5678";
        const hash = await bcrypt.hash(oldPassword, 12);
        await User.create({
            username,
            password: hash,
            email,
            level: "Rookie",
            userType: "Member",
            admin: false,
        });

        const requested = await request(app)
            .post("/api/forgot-password")
            .send({ email })
            .expect(200);
        assert.strictEqual(requested.body.ok, true);
        assert.strictEqual(sentMails.length, 1);
        assert.strictEqual(sentMails[0].to, email);
        const match = String(sentMails[0].text).match(/reset-password\?token=([A-Za-z0-9_-]+)/);
        assert.ok(match, "email should include a reset token URL");
        const token = match[1];

        const userAfterRequest = await User.findOne({ username });
        assert.ok(userAfterRequest.passwordResetTokenHash);
        assert.strictEqual(
            userAfterRequest.passwordResetTokenHash,
            crypto.createHash("sha256").update(token, "utf8").digest("hex"),
        );
        assert.doesNotMatch(
            JSON.stringify(userAfterRequest.toObject()),
            new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
            "raw token must not be stored on the user document",
        );

        const wrongEmail = await request(app)
            .post("/api/reset-password")
            .send({
                token,
                email: "other@example.test",
                newPassword,
                confirmPassword: newPassword,
            })
            .expect(400);
        assert.strictEqual(wrongEmail.body.ok, false);

        const ok = await request(app)
            .post("/api/reset-password")
            .send({
                token,
                email,
                newPassword,
                confirmPassword: newPassword,
            })
            .expect(200);
        assert.strictEqual(ok.body.ok, true);

        const reused = await request(app)
            .post("/api/reset-password")
            .send({
                token,
                email,
                newPassword: "AnotherPass!9",
                confirmPassword: "AnotherPass!9",
            })
            .expect(400);
        assert.strictEqual(reused.body.ok, false);

        const loginOld = await request(app)
            .post("/api/login")
            .send({ username, password: oldPassword })
            .expect(401);
        assert.strictEqual(loginOld.body.ok, false);

        const loginNew = await request(app)
            .post("/api/login")
            .send({ username, password: newPassword })
            .expect(200);
        assert.strictEqual(loginNew.body.ok, true);

        await User.deleteOne({ username });
    });
});
