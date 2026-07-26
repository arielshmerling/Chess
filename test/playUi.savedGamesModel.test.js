const assert = require("assert");

const SavedGames = require("../src/play-ui/saved-games-model");

describe("play-ui saved games model", function () {
    describe("entryId", function () {
        it("prefers _id and falls back to id", function () {
            assert.strictEqual(SavedGames.entryId({ _id: "abc" }), "abc");
            assert.strictEqual(SavedGames.entryId({ id: 42 }), "42");
        });

        it("returns an empty string when there is no id", function () {
            assert.strictEqual(SavedGames.entryId({}), "");
            assert.strictEqual(SavedGames.entryId(null), "");
        });
    });

    describe("parseMoves", function () {
        it("parses JSON string moves", function () {
            const moves = SavedGames.parseMoves({
                moves: [JSON.stringify({ moveStr: "e4" }), { moveStr: "e5" }],
            });

            assert.deepStrictEqual(moves, [{ moveStr: "e4" }, { moveStr: "e5" }]);
        });

        it("returns an empty list when moves are missing", function () {
            assert.deepStrictEqual(SavedGames.parseMoves({}), []);
            assert.deepStrictEqual(SavedGames.parseMoves(null), []);
        });
    });

    describe("classification", function () {
        const position = { moves: [] };
        const game = { moves: [JSON.stringify({ moveStr: "e4" })] };

        it("treats an entry without moves as a saved position", function () {
            assert.strictEqual(SavedGames.isPosition(position), true);
            assert.strictEqual(SavedGames.isGame(position), false);
        });

        it("treats an entry with moves as a saved game", function () {
            assert.strictEqual(SavedGames.isGame(game), true);
            assert.strictEqual(SavedGames.isPosition(game), false);
        });

        it("filters by list tab, defaulting to games", function () {
            const entries = [position, game];

            assert.deepStrictEqual(SavedGames.filterEntries(entries, "positions"), [position]);
            assert.deepStrictEqual(SavedGames.filterEntries(entries, "games"), [game]);
            assert.deepStrictEqual(SavedGames.filterEntries(entries, undefined), [game]);
        });
    });

    describe("stateFromEntry", function () {
        it("reads a JSON string state", function () {
            const state = SavedGames.stateFromEntry({ state: '{"turn":"black"}' });

            assert.deepStrictEqual(state, { turn: "black" });
        });

        it("reads an object state", function () {
            const state = { turn: "white" };

            assert.strictEqual(SavedGames.stateFromEntry({ state }), state);
        });

        it("falls back to the older gameState field", function () {
            assert.deepStrictEqual(SavedGames.stateFromEntry({ gameState: { turn: "white" } }), {
                turn: "white",
            });
        });

        it("returns null for missing or broken state", function () {
            assert.strictEqual(SavedGames.stateFromEntry({}), null);
            assert.strictEqual(SavedGames.stateFromEntry({ state: "{oops" }), null);
            assert.strictEqual(SavedGames.stateFromEntry(null), null);
        });
    });

    describe("turn", function () {
        it("reports the side to move", function () {
            assert.strictEqual(SavedGames.turnFromEntry({ state: '{"turn":"black"}' }), "black");
            assert.strictEqual(SavedGames.formatTurn({ state: '{"turn":"black"}' }), "Next move: Black");
        });

        it("reports a placeholder when the turn is unknown", function () {
            assert.strictEqual(SavedGames.turnFromEntry({ state: "{}" }), null);
            assert.strictEqual(SavedGames.formatTurn({}), "Next move: —");
        });
    });

    describe("formatDate", function () {
        it("returns an empty string for missing or invalid dates", function () {
            assert.strictEqual(SavedGames.formatDate(null), "");
            assert.strictEqual(SavedGames.formatDate("not a date"), "");
        });

        it("formats a real date", function () {
            assert.ok(SavedGames.formatDate(new Date(2026, 0, 2, 3, 4)).length > 0);
        });
    });

    describe("players", function () {
        it("uses stored player names when both are present", function () {
            const players = SavedGames.resolvePlayers({
                whitePlayerName: "ariel",
                blackPlayerName: "guest",
            });

            assert.deepStrictEqual(players, { white: "ariel", black: "guest" });
        });

        it("falls back to the engine label for older entries", function () {
            const players = SavedGames.resolvePlayers({ engine: "brain42" }, function (id) {
                return "Brain " + id;
            });

            assert.deepStrictEqual(players, { white: "Player", black: "Brain brain42" });
        });

        it("uses the default engine id when the entry does not name one", function () {
            const seen = [];
            SavedGames.resolvePlayers({}, function (id) {
                seen.push(id);
                return id;
            });

            assert.deepStrictEqual(seen, ["brain43"]);
        });

        it("says Engine when no label resolver is supplied", function () {
            assert.strictEqual(SavedGames.formatPlayers({ engine: "brain42" }), "Player vs. Engine");
        });

        it("returns neutral names for a missing entry", function () {
            assert.deepStrictEqual(SavedGames.resolvePlayers(null), { white: "White", black: "Black" });
        });
    });

    describe("formatInfoTooltip", function () {
        it("lists save time, players, and id on separate lines", function () {
            const tooltip = SavedGames.formatInfoTooltip({
                _id: "abc",
                date: new Date(2026, 0, 2, 3, 4),
                whitePlayerName: "ariel",
                blackPlayerName: "guest",
            });
            const lines = tooltip.split("\n");

            assert.strictEqual(lines.length, 3);
            assert.match(lines[0], /^Saved: /);
            assert.strictEqual(lines[1], "ariel vs. guest");
            assert.strictEqual(lines[2], "Game ID: abc");
        });

        it("omits parts it cannot resolve", function () {
            const tooltip = SavedGames.formatInfoTooltip({ whitePlayerName: "a", blackPlayerName: "b" });

            assert.strictEqual(tooltip, "a vs. b");
        });
    });
});
