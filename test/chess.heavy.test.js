/**
 * Heavy / long-running tests.
 * Run separately from fast unit tests: npm run test:heavy
 * Do not include this file in the default npm test run.
 */
/* eslint-disable */

const { ChessGame } = require("../src/ChessGame");
const gamesManagerService = require("../src/modules/gamesManager/service");
const assert = require("assert");

let game;

before(() => {
    game = new ChessGame();
});

describe("Heavy tests (long execution)", () => {
    it("placeholder - game instance is created", () => {
        assert.ok(game);
        assert.strictEqual(game.Turn, "white");
    });

    /**
     * Full replay logic (getPGNFiles + readPGNGames + replayPGNGames with saveToDB: false).
     * Executes all games and moves like addGamesToDB but never calls State.save(); verifies no errors.
     */
    it("replays all PGN games without saving to DB (no errors during execution)", async () => {
        const files = await gamesManagerService.getPGNFiles();
        assert.ok(Array.isArray(files), "getPGNFiles should return an array");

        const pgnGames = await gamesManagerService.readPGNGames(files);
        assert.ok(Array.isArray(pgnGames), "readPGNGames should return an array");

        await gamesManagerService.replayPGNGames(pgnGames, { saveToDB: false });

        if (pgnGames.length > 0) {
            const first = pgnGames[0];
            assert.ok(first.moves != null, "each game should have a moves array");
            assert.ok(Array.isArray(first.moves), "game.moves should be an array");
        }
    });
});
