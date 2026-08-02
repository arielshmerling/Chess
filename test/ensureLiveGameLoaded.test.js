/**
 * ensureLiveGameLoaded — rebuild in-memory games from Mongo after process restart.
 */
"use strict";

const assert = require("assert");
const mongoose = require("mongoose");
const gamesManagerService = require("../src/modules/gamesManager/service");
const { Game } = require("../src/modules/game/model");
const {
    getWebE2EDatabaseUrl,
    ensureWebE2EUsers,
} = require("./helpers/webE2EUser");

describe("ensureLiveGameLoaded", function () {
    this.timeout(30000);

    let primary;
    let other;

    before(async function () {
        try {
            getWebE2EDatabaseUrl();
        } catch (err) {
            this.skip();
        }
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(getWebE2EDatabaseUrl());
        }
        const users = await ensureWebE2EUsers();
        primary = users.primary;
        other = users.other;
    });

    it("rebuilds an OnlineGame from Mongo when missing from memory", async function () {
        const doc = await Game.create({
            createBy: primary.username,
            createByUserId: primary.id,
            state: "in progress",
            gameType: "OnlineGame",
            whitePlayer: primary.username,
            blackPlayer: other.username,
            isPrivate: false,
            timeMinutes: 15,
            moves: [],
        });
        const id = String(doc._id);
        try {
            assert.strictEqual(gamesManagerService.getGameById(id), undefined);
            const game = await gamesManagerService.ensureLiveGameLoaded(id);
            assert.ok(game);
            assert.strictEqual(game.constructor.name, "OnlineGame");
            assert.strictEqual(String(game.gameId), id);
            assert.strictEqual(game.whitePlayer.userName, primary.username);
            assert.strictEqual(game.blackPlayer.userName, other.username);
            assert.ok(gamesManagerService.getGameById(id));
            const again = await gamesManagerService.ensureLiveGameLoaded(id);
            assert.strictEqual(again, game);
        } finally {
            await Game.findByIdAndDelete(id);
        }
    });

    it("returns null for terminal games", async function () {
        const doc = await Game.create({
            createBy: primary.username,
            createByUserId: primary.id,
            state: "game over",
            gameType: "OnlineGame",
            whitePlayer: primary.username,
            blackPlayer: other.username,
            moves: [],
        });
        const id = String(doc._id);
        try {
            const game = await gamesManagerService.ensureLiveGameLoaded(id);
            assert.strictEqual(game, null);
        } finally {
            await Game.findByIdAndDelete(id);
        }
    });
});
