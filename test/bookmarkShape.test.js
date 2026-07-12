const assert = require("assert");
const { toClientBookmark } = require("../src/play/bookmarkShape");

describe("bookmarkShape", function () {
    it("maps mongoose-like docs to desktop-compatible client bookmarks", function () {
        const shaped = toClientBookmark({
            _id: "abc123",
            name: "Test game",
            date: new Date("2026-01-01T00:00:00.000Z"),
            gameType: "SinglePlayerGame",
            state: "{\"board\":[]}",
            originState: "{\"board\":[]}",
            moves: ["{\"moveStr\":\"e4\"}"],
            engine: "brain43",
            depth: 10,
            whitePlayerName: "Alice",
            blackPlayerName: "Brain43",
        });

        assert.strictEqual(shaped._id, "abc123");
        assert.strictEqual(shaped.id, "abc123");
        assert.strictEqual(shaped.name, "Test game");
        assert.strictEqual(shaped.originState, "{\"board\":[]}");
        assert.deepStrictEqual(shaped.moves, ["{\"moveStr\":\"e4\"}"]);
        assert.strictEqual(shaped.whitePlayerName, "Alice");
        assert.strictEqual(shaped.blackPlayerName, "Brain43");
    });

    it("returns null for empty input", function () {
        assert.strictEqual(toClientBookmark(null), null);
    });
});
