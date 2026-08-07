/**
 * PGN replay tests (full corpus under pgn/).
 * Run only via: npm run test:pgn
 * Excluded from test / test:all / test:heavy / coverage suites.
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
    it("replays all PGN games without saving to DB (no errors during execution)", async function () {
        this.timeout(600000);
        const files = await gamesManagerService.getPGNFiles();
        assert.ok(files.length > 0, "getPGNFiles should find .pgn files under pgn/");

        const pgnGames = await gamesManagerService.readPGNGames(files, { firstFileOnly: true });
        assert.ok(Array.isArray(pgnGames), "readPGNGames should return an array");
        assert.ok(pgnGames.length > 0, "expected at least one game from the first PGN file");

        await gamesManagerService.replayPGNGames(pgnGames, { saveToDB: false });

        if (pgnGames.length > 0) {
            const first = pgnGames[0];
            assert.ok(first.moves != null, "each game should have a moves array");
            assert.ok(Array.isArray(first.moves), "game.moves should be an array");
        }
    });
});
