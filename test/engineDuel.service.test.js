/**
 * Engine duel create/stop/loop with stubbed registry, engines, and gamesManager.
 */
"use strict";

const assert = require("assert");
const path = require("path");

const duelPath = path.join(__dirname, "../src/modules/game/engineDuelService.js");
const registryPath = require.resolve("../src/engines/registry");
const engineServicePath = require.resolve("../src/engines/engineService");
const gamesManagerPath = require.resolve("../src/modules/gamesManager/service");

describe("engineDuelService create/stop", function () {
    let registry;
    let engineService;
    let gamesManager;
    let origRegistry;
    let origEngine;
    let origGames;
    let computeCalls;

    beforeEach(function () {
        computeCalls = [];
        delete require.cache[duelPath];
        registry = require(registryPath);
        engineService = require(engineServicePath);
        gamesManager = require(gamesManagerPath);

        origRegistry = {
            getEngine: registry.getEngine,
            listPlayEngines: registry.listPlayEngines,
        };
        origEngine = {
            resolveEnabledPlayEngine: engineService.resolveEnabledPlayEngine,
            computeMove: engineService.computeMove,
            abortSearch: engineService.abortSearch,
        };
        origGames = {
            AddGame: gamesManager.AddGame,
            storeGameInDB: gamesManager.storeGameInDB,
            getGameById: gamesManager.getGameById,
        };

        registry.getEngine = (id) => (id === "brain41" || id === "brain43" ? { id, fallbackLabel: id } : null);
        registry.listPlayEngines = () => [{ id: "brain41" }, { id: "brain43" }];
        engineService.resolveEnabledPlayEngine = async (id) => id;
        engineService.computeMove = async (opts) => {
            computeCalls.push(opts);
            return {
                source: { row: 6, col: 4 },
                target: { row: 4, col: 4 },
                valid: true,
                moveStr: "e4",
            };
        };
        engineService.abortSearch = () => {};
        gamesManager.AddGame = () => {};
        gamesManager.storeGameInDB = async () => ({ id: "duel-db-1" });
        gamesManager.getGameById = () => null;
    });

    afterEach(function () {
        Object.assign(registry, origRegistry);
        Object.assign(engineService, origEngine);
        Object.assign(gamesManager, origGames);
        delete require.cache[duelPath];
    });

    it("rejects unknown or disabled engines", async function () {
        const svc = require(duelPath);
        await assert.rejects(
            () =>
                svc.createAndStartEngineDuel(
                    { adminUsername: "a", adminUserId: "1", whiteEngine: "nope", blackEngine: "brain41" },
                    () => {},
                    () => {},
                ),
            (err) => err.code === "INVALID_ENGINE",
        );
        engineService.resolveEnabledPlayEngine = async () => "brain43";
        await assert.rejects(
            () =>
                svc.createAndStartEngineDuel(
                    {
                        adminUsername: "a",
                        adminUserId: "1",
                        whiteEngine: "brain41",
                        blackEngine: "brain43",
                    },
                    () => {},
                    () => {},
                ),
            (err) => err.code === "ENGINE_DISABLED",
        );
    });

    it("creates a duel, lists it, and stops it", async function () {
        this.timeout(10000);
        const svc = require(duelPath);
        const lobby = [];
        const registered = [];
        const { game, gameId } = await svc.createAndStartEngineDuel(
            {
                adminUsername: "admin",
                adminUserId: "aid",
                whiteEngine: "brain41",
                blackEngine: "brain43",
                whiteDifficulty: 2,
                blackDifficulty: 9,
                timeMinutes: 15,
            },
            (g, meta) => lobby.push({ g, meta }),
            (g) => registered.push(g),
        );
        assert.strictEqual(gameId, "duel-db-1");
        assert.strictEqual(game.constructor.name, "EngineDuelGame");
        assert.strictEqual(game.options.whiteDifficulty, 2);
        assert.strictEqual(game.options.blackDifficulty, 3); /* clamped */
        assert.strictEqual(game.init(), false);
        assert.ok(lobby.length === 1);
        assert.ok(registered.length === 1);
        assert.ok(svc.listRunningDuels().includes("duel-db-1"));

        const stop = await svc.stopEngineDuel("duel-db-1");
        assert.strictEqual(stop.ok, true);
        assert.strictEqual(game.isAbortRequested(), true);

        const missing = await svc.stopEngineDuel("missing");
        assert.strictEqual(missing.ok, false);

        /* Allow loop to notice abort */
        await new Promise((r) => setTimeout(r, 400));
    });

    it("run loop applies computeMove then stops on empty move", async function () {
        this.timeout(10000);
        engineService.computeMove = async () => {
            computeCalls.push(1);
            return null;
        };
        const svc = require(duelPath);
        const { game } = await svc.createAndStartEngineDuel(
            {
                adminUsername: "admin",
                adminUserId: "aid",
                whiteEngine: "brain41",
                blackEngine: "brain43",
                timeMinutes: 5,
            },
            () => {},
            () => {},
        );
        await new Promise((r) => setTimeout(r, 600));
        assert.ok(computeCalls.length >= 1);
        assert.strictEqual(game._duelRunning, false);
    });
});
