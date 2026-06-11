/**
 * Desktop bookmarks persisted as bookmarks.json in userData.
 */

const fs = require("fs").promises;
const { randomUUID } = require("crypto");
const runtime = require("./runtime");

async function readAll() {
    const filePath = runtime.getBookmarksFilePath();
    try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        if (error && error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
}

async function writeAll(bookmarks) {
    const filePath = runtime.getBookmarksFilePath();
    await fs.writeFile(filePath, JSON.stringify(bookmarks, null, 2), "utf8");
}

/**
 * Shape compatible with existing bookmark UI (_id, id, state, moves, engine, depth).
 */
function toClientBookmark(doc) {
    return {
        _id: doc._id,
        id: doc.id || doc._id,
        name: doc.name,
        date: doc.date,
        gameType: doc.gameType,
        state: doc.state,
        moves: doc.moves || [],
        engine: doc.engine,
        depth: doc.depth,
    };
}

exports.getAllUserBookmarks = async () => {
    const list = await readAll();
    return list.map(toClientBookmark);
};

exports.addBookmark = async (_userId, gameState, name, gameType, moves, engine, depth) => {
    const list = await readAll();
    const id = randomUUID();
    const parsedDepth = Number(depth);
    const bookmark = {
        _id: id,
        id,
        state: typeof gameState === "string" ? gameState : JSON.stringify(gameState),
        name: name || "Bookmark",
        gameType: gameType || "SinglePlayerGame",
        moves: Array.isArray(moves) ? moves : [],
        engine: runtime.normalizeEngine(engine),
        depth: Number.isInteger(parsedDepth) && parsedDepth >= 1 && parsedDepth <= 6 ? parsedDepth : 3,
        date: new Date(),
    };
    list.push(bookmark);
    await writeAll(list);
    return toClientBookmark(bookmark);
};

exports.updateBookmark = async (_userId, id, date, name, gameType, gameState, moves, engine, depth) => {
    const list = await readAll();
    const bookmark = list.find((b) => String(b._id) === String(id));
    if (!bookmark) {
        return;
    }
    if (name !== undefined) { bookmark.name = name; }
    if (date !== undefined) { bookmark.date = new Date(date); }
    if (gameType !== undefined) { bookmark.gameType = gameType; }
    if (gameState !== undefined) {
        bookmark.state = typeof gameState === "string" ? gameState : JSON.stringify(gameState);
    }
    if (moves !== undefined) { bookmark.moves = moves; }
    if (engine !== undefined) { bookmark.engine = runtime.normalizeEngine(engine); }
    if (depth !== undefined) {
        const parsedDepth = Number(depth);
        bookmark.depth = Number.isInteger(parsedDepth) && parsedDepth >= 1 && parsedDepth <= 6 ? parsedDepth : 3;
    }
    await writeAll(list);
};

exports.deleteBookmark = async (id) => {
    const list = await readAll();
    const next = list.filter((b) => String(b._id) !== String(id));
    if (next.length === list.length) {
        return false;
    }
    await writeAll(next);
    return true;
};

exports.findBookmarkById = async (id) => {
    const list = await readAll();
    return list.find((b) => String(b._id) === String(id)) || null;
};
