/**
 * game controller helpers: createPlaySpGame / duel handlers with stubs.
 */
"use strict";

const assert = require("assert");
const path = require("path");

const controllerPath = require.resolve("../src/modules/game/controller");
const gamesManagerPath = require.resolve("../src/modules/gamesManager/service");
const engineDuelPath = require.resolve("../src/modules/game/engineDuelService");

describe("game controller createPlaySpGame", function () {
    let gamesManager;
    let origStore;
    let origAdd;
    let origSetLobby;

    beforeEach(function () {
        delete require.cache[controllerPath];
        gamesManager = require(gamesManagerPath);
        origStore = gamesManager.storeGameInDB;
        origAdd = gamesManager.AddGame;
        origSetLobby = gamesManager.setLobbyBroadcast;
        gamesManager.storeGameInDB = async () => ({ id: "sp-play-1" });
        gamesManager.AddGame = () => {};
    });

    afterEach(function () {
        gamesManager.storeGameInDB = origStore;
        gamesManager.AddGame = origAdd;
        if (origSetLobby) {
            gamesManager.setLobbyBroadcast(null);
        }
        delete require.cache[controllerPath];
    });

    it("creates clientEngine SP and notifies lobby", async function () {
        const lobby = [];
        gamesManager.setLobbyBroadcast((payload) => {
            lobby.push(payload);
        });
        const controller = require(controllerPath);
        const { game, gameId } = await controller.createPlaySpGame("alice", "uid-1", {
            engine: "brain41",
            color: "white",
            difficulty: 2,
        });
        assert.strictEqual(gameId, "sp-play-1");
        assert.strictEqual(game.options.clientEngine, true);
        assert.strictEqual(game.status, "in progress");
        assert.ok(lobby.some((e) => e.type === "onlineGameInProgress"));
    });

    it("stopEngineDuelHandler returns 404 when missing", async function () {
        delete require.cache[engineDuelPath];
        const duel = require(engineDuelPath);
        const origStop = duel.stopEngineDuel;
        duel.stopEngineDuel = async () => ({ ok: false, message: "missing" });
        try {
            const controller = require(controllerPath);
            const res = {
                statusCode: 200,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    this.body = payload;
                    return this;
                },
            };
            await controller.stopEngineDuelHandler(
                { params: { id: "nope" }, body: {} },
                res,
                function next(err) {
                    if (err) {
                        throw err;
                    }
                },
            );
            assert.strictEqual(res.statusCode, 404);
            assert.strictEqual(res.body.ok, false);
        } finally {
            duel.stopEngineDuel = origStop;
        }
    });

    it("createEngineDuelHandler maps INVALID_ENGINE to 400", async function () {
        delete require.cache[engineDuelPath];
        const duel = require(engineDuelPath);
        const origCreate = duel.createAndStartEngineDuel;
        duel.createAndStartEngineDuel = async () => {
            const err = new Error("bad engine");
            err.code = "INVALID_ENGINE";
            throw err;
        };
        try {
            delete require.cache[controllerPath];
            const controller = require(controllerPath);
            const res = {
                statusCode: 200,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    this.body = payload;
                    return this;
                },
            };
            await controller.createEngineDuelHandler(
                {
                    session: { user_name: "admin", user_id: "a1" },
                    body: { whiteEngine: "x", blackEngine: "y" },
                },
                res,
                function next(err) {
                    if (err) {
                        throw err;
                    }
                },
            );
            assert.strictEqual(res.statusCode, 400);
            assert.strictEqual(res.body.ok, false);
        } finally {
            duel.createAndStartEngineDuel = origCreate;
        }
    });

    it("createPlaySpGameHandler succeeds with stubs", async function () {
        const engineService = require("../src/engines/engineService");
        const { User } = require("../src/modules/user/model");
        const origResolve = engineService.resolveEnabledPlayEngine;
        const origUpdate = User.findByIdAndUpdate;
        engineService.resolveEnabledPlayEngine = async (id) => id || "brain41";
        User.findByIdAndUpdate = async () => ({});
        try {
            delete require.cache[controllerPath];
            const controller = require(controllerPath);
            const res = {
                body: null,
                json(payload) {
                    this.body = payload;
                    return this;
                },
            };
            await controller.createPlaySpGameHandler(
                {
                    session: { user_name: "alice", user_id: "uid-1" },
                    body: {
                        color: "black",
                        engine: "brain41",
                        difficulty: 2,
                        mouse: "double",
                        timeMinutes: 45,
                        isPrivate: true,
                    },
                },
                res,
                function next(err) {
                    if (err) {
                        throw err;
                    }
                },
            );
            assert.strictEqual(res.body.ok, true);
            assert.strictEqual(res.body.gameId, "sp-play-1");
            assert.strictEqual(res.body.isPrivate, true);
        } finally {
            engineService.resolveEnabledPlayEngine = origResolve;
            User.findByIdAndUpdate = origUpdate;
        }
    });

    it("createPlaySpGameHandler rejects disabled engine", async function () {
        const engineService = require("../src/engines/engineService");
        const origResolve = engineService.resolveEnabledPlayEngine;
        engineService.resolveEnabledPlayEngine = async () => "brain43";
        try {
            delete require.cache[controllerPath];
            const controller = require(controllerPath);
            const res = {
                statusCode: 200,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    this.body = payload;
                    return this;
                },
            };
            await controller.createPlaySpGameHandler(
                {
                    session: { user_name: "alice", user_id: "uid-1" },
                    body: { engine: "brain41" },
                },
                res,
                function next(err) {
                    if (err) {
                        throw err;
                    }
                },
            );
            assert.strictEqual(res.statusCode, 400);
            assert.ok(/disabled/i.test(res.body.message));
        } finally {
            engineService.resolveEnabledPlayEngine = origResolve;
        }
    });

    it("getBrainConfig / saveBrainConfig for advanced tools", async function () {
        const roles = require("../src/modules/user/roles");
        const orig = roles.canUsePlayAdvancedTools;
        roles.canUsePlayAdvancedTools = () => true;
        delete require.cache[controllerPath];
        try {
            const controller = require(controllerPath);
            const resGet = {
                body: null,
                send(payload) {
                    this.body = payload;
                    return this;
                },
            };
            await controller.getBrainConfig(
                { session: {}, query: { engine: "brain41" } },
                resGet,
                function next(err) {
                    if (err) {
                        throw err;
                    }
                },
            );
            assert.strictEqual(resGet.body.engine, "brain41");
            assert.ok(resGet.body.config);

            const resSave = {
                body: null,
                send(payload) {
                    this.body = payload;
                    return this;
                },
            };
            await controller.saveBrainConfig(
                { session: {}, body: { engine: "brain41", config: resGet.body.config } },
                resSave,
                function next(err) {
                    if (err) {
                        throw err;
                    }
                },
            );
            assert.strictEqual(resSave.body.status, "OK");
        } finally {
            roles.canUsePlayAdvancedTools = orig;
            delete require.cache[controllerPath];
        }
    });

    it("createFriendInviteGameForUser validates ids and friendship", async function () {
        const { User } = require("../src/modules/user/model");
        const mongoose = require("mongoose");
        delete require.cache[controllerPath];
        const controller = require(controllerPath);
        const oid = () => new mongoose.Types.ObjectId().toString();
        await assert.rejects(
            () => controller.createFriendInviteGameForUser("a", "alice", "not-an-id", {}),
            (err) => Number(err.statusCode || err.status) === 400,
        );
        const me = oid();
        await assert.rejects(
            () => controller.createFriendInviteGameForUser(me, "alice", me, {}),
            (err) => Number(err.statusCode || err.status) === 400,
        );

        const target = oid();
        const origFind = User.findById;
        User.findById = function () {
            return {
                select() {
                    return Promise.resolve({ friends: [] });
                },
            };
        };
        try {
            await assert.rejects(
                () => controller.createFriendInviteGameForUser(me, "alice", target, {}),
                (err) => Number(err.statusCode || err.status) === 403,
            );
        } finally {
            User.findById = origFind;
        }
    });
});
