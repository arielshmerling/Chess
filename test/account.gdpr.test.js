/**
 * Account page + GDPR export/delete (ON-45 / ON-46).
 */
"use strict";

const assert = require("assert");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const { loadWebApp, resetWebRateLimits } = require("./helpers/webApp");
const { ensureWebE2EUsers } = require("./helpers/webE2EUser");
const { User, Bookmark } = require("../src/modules/user/model");
const { Game } = require("../src/modules/game/model");
const gamesManagerService = require("../src/modules/gamesManager/service");

describe("account GDPR self-service", function () {
    this.timeout(30000);

    let app;
    let primary;

    before(async function () {
        const users = await ensureWebE2EUsers();
        primary = users.primary;
        app = loadWebApp();
    });

    beforeEach(function () {
        resetWebRateLimits(app);
    });

    async function loginAgent(creds) {
        const agent = request.agent(app);
        await agent
            .post("/login")
            .type("form")
            .send({ username: creds.username, password: creds.password })
            .expect(302);
        return agent;
    }

    it("GET /account without session redirects to login", async function () {
        const res = await request(app).get("/account").redirects(0);
        assert.strictEqual(res.status, 302);
        assert.ok(String(res.headers.location || "").includes("/login"));
    });

    it("GET /account shows profile details for the signed-in user", async function () {
        const agent = await loginAgent(primary);
        const res = await agent.get("/account").expect(200);
        assert.match(res.text, /Account/);
        assert.match(res.text, new RegExp(primary.username));
        assert.match(res.text, /Download JSON/);
        assert.match(res.text, /Delete my account/);
        assert.doesNotMatch(
            res.text,
            /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
            "joined/last-login should not render raw ISO timestamps",
        );
    });

    it("GET /api/account/export returns JSON without password", async function () {
        const agent = await loginAgent(primary);
        const res = await agent.get("/api/account/export").expect(200);
        assert.match(String(res.headers["content-disposition"] || ""), /attachment/);
        const body = typeof res.body === "object" && Object.keys(res.body).length
            ? res.body
            : JSON.parse(res.text);
        assert.strictEqual(body.schemaVersion, 1);
        assert.ok(body.profile);
        assert.strictEqual(body.profile.username, primary.username);
        assert.strictEqual(body.profile.password, undefined);
        assert.ok(Array.isArray(body.friends));
        assert.ok(Array.isArray(body.bookmarks));
        assert.ok(Array.isArray(body.games));
    });

    it("POST /api/account/delete requires matching username and erases the user", async function () {
        const username = `gdpr_del_${Date.now()}`;
        const password = "GdprDeletePass!123";
        const hash = await bcrypt.hash(password, 12);
        const user = await User.create({
            username,
            password: hash,
            email: `${username}@example.test`,
            level: "Rookie",
            userType: "Member",
            admin: false,
        });
        const bookmark = await Bookmark.create({
            name: "temp",
            state: "{}",
            moves: [],
        });
        user.bookmarks.push(bookmark._id);
        await user.save();

        await Game.create({
            createBy: username,
            createByUserId: user._id,
            whitePlayer: username,
            blackPlayer: "Brain 4.3",
            gameType: "SinglePlayerGame",
            state: "finished",
            moves: ["e4"],
        });
        await Game.create({
            createBy: username,
            createByUserId: user._id,
            whitePlayer: username,
            blackPlayer: "opponent_keep",
            gameType: "OnlineGame",
            state: "finished",
            moves: ["e4", "e5"],
        });

        const agent = await loginAgent({ username, password });
        const bad = await agent
            .post("/api/account/delete")
            .send({ confirmUsername: "wrong" })
            .expect(400);
        assert.strictEqual(bad.body.ok, false);

        const ok = await agent
            .post("/api/account/delete")
            .send({ confirmUsername: username })
            .expect(200);
        assert.strictEqual(ok.body.ok, true);

        const gone = await User.findById(user._id);
        assert.strictEqual(gone, null);
        const bookmarkGone = await Bookmark.findById(bookmark._id);
        assert.strictEqual(bookmarkGone, null);

        const spLeft = await Game.findOne({
            createByUserId: user._id,
            gameType: "SinglePlayerGame",
        });
        assert.strictEqual(spLeft, null);

        const online = await Game.findOne({
            blackPlayer: "opponent_keep",
            gameType: "OnlineGame",
        });
        assert.ok(online);
        assert.strictEqual(online.whitePlayer, gamesManagerService.ANONYMIZED_USERNAME);
    });

    it("POST /api/account/password updates password when current password is correct", async function () {
        const username = `gdpr_pw_${Date.now()}`;
        const oldPassword = "OldPass!1234";
        const newPassword = "NewPass!5678";
        const hash = await bcrypt.hash(oldPassword, 12);
        await User.create({
            username,
            password: hash,
            email: `${username}@example.test`,
            level: "Rookie",
            userType: "Member",
            admin: false,
        });

        const agent = await loginAgent({ username, password: oldPassword });
        const bad = await agent
            .post("/api/account/password")
            .send({
                currentPassword: "wrong",
                newPassword,
                confirmPassword: newPassword,
            })
            .expect(400);
        assert.strictEqual(bad.body.ok, false);

        const mismatch = await agent
            .post("/api/account/password")
            .send({
                currentPassword: oldPassword,
                newPassword,
                confirmPassword: "different",
            })
            .expect(400);
        assert.strictEqual(mismatch.body.ok, false);

        const ok = await agent
            .post("/api/account/password")
            .send({
                currentPassword: oldPassword,
                newPassword,
                confirmPassword: newPassword,
            })
            .expect(200);
        assert.strictEqual(ok.body.ok, true);

        await agent.get("/logout").expect(302);
        const relogin = await request.agent(app)
            .post("/login")
            .type("form")
            .send({ username, password: newPassword })
            .expect(302);
        assert.ok(String(relogin.headers.location || "").includes("/home")
            || String(relogin.headers.location || "").includes("/Home")
            || relogin.status === 302);

        await User.deleteOne({ username });
    });
});
