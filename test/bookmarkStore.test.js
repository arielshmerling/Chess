const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
    createDesktopTestRuntime,
    destroyDesktopTestRuntime,
    clearDesktopModuleCache,
} = require("./helpers/desktopRuntime");

describe("bookmarkStore", function () {
    let tempDir;
    let bookmarkStore;

    beforeEach(function () {
        const ctx = createDesktopTestRuntime();
        tempDir = ctx.tempDir;
        bookmarkStore = require("../src/desktop/bookmarkStore");
    });

    afterEach(function () {
        destroyDesktopTestRuntime(tempDir);
        tempDir = null;
        bookmarkStore = null;
    });

    it("returns empty list when bookmarks.json is missing", async function () {
        const list = await bookmarkStore.getAllUserBookmarks();
        assert.deepStrictEqual(list, []);
    });

    it("adds a game bookmark with moves and reads it back", async function () {
        const state = { turn: "white", board: [] };
        const moves = [JSON.stringify({ moveStr: "e4", turn: "white" })];
        const created = await bookmarkStore.addBookmark(
            null,
            state,
            "Test game",
            "SinglePlayerGame",
            moves,
            "brain42",
            10,
        );

        assert.ok(created._id);
        assert.strictEqual(created.name, "Test game");
        assert.strictEqual(created.engine, "brain42");
        assert.strictEqual(created.depth, 10);
        assert.strictEqual(created.moves.length, 1);

        const all = await bookmarkStore.getAllUserBookmarks();
        assert.strictEqual(all.length, 1);
        assert.strictEqual(all[0]._id, created._id);
    });

    it("adds a position bookmark with empty moves and optional originState", async function () {
        const state = { turn: "black", board: [] };
        const origin = { turn: "white", board: [] };
        const created = await bookmarkStore.addBookmark(
            null,
            state,
            "Test position",
            "SinglePlayerGame",
            [],
            "brain43",
            5,
            origin,
        );

        assert.strictEqual(created.moves.length, 0);
        assert.strictEqual(created.engine, "brain43");
        assert.strictEqual(created.depth, 5);

        const found = await bookmarkStore.findBookmarkById(created._id);
        assert.ok(found);
        assert.strictEqual(found.name, "Test position");
        assert.ok(found.originState);
    });

    it("updates and deletes bookmarks", async function () {
        const created = await bookmarkStore.addBookmark(
            null,
            { turn: "white" },
            "Rename me",
            "SinglePlayerGame",
            [],
            "brain41",
            2,
        );

        await bookmarkStore.updateBookmark(
            null,
            created._id,
            new Date(),
            "Renamed",
            "SinglePlayerGame",
            { turn: "black" },
            ["{}"],
            "brain42",
            15,
            null,
        );

        const updated = await bookmarkStore.findBookmarkById(created._id);
        assert.strictEqual(updated.name, "Renamed");
        assert.strictEqual(updated.engine, "brain42");
        assert.strictEqual(updated.depth, 15);
        assert.ok(!updated.originState);

        const deleted = await bookmarkStore.deleteBookmark(created._id);
        assert.strictEqual(deleted, true);
        assert.strictEqual(await bookmarkStore.findBookmarkById(created._id), null);
    });

    it("persists bookmarks to bookmarks.json on disk", async function () {
        await bookmarkStore.addBookmark(null, { turn: "white" }, "On disk", "SinglePlayerGame", [], "brain42", 10);

        clearDesktopModuleCache();
        const reloaded = require("../src/desktop/bookmarkStore");
        const list = await reloaded.getAllUserBookmarks();
        assert.strictEqual(list.length, 1);
        assert.strictEqual(list[0].name, "On disk");

        const filePath = path.join(tempDir, "bookmarks.json");
        assert.ok(fs.existsSync(filePath));
    });
});
