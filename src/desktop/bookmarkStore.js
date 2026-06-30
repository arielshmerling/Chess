/**
 * Desktop bookmarks persisted as bookmarks.json in userData.
 */

const fs = require("fs").promises;
const { randomUUID } = require("crypto");
const { normalizeThinkingTimeSeconds } = require("../modules/game/brainConfigService");
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
        originState: doc.originState,
        moves: doc.moves || [],
        engine: doc.engine,
        depth: doc.depth,
        whitePlayerName: doc.whitePlayerName,
        blackPlayerName: doc.blackPlayerName,
    };
}

exports.getAllUserBookmarks = async () => {
    const list = await readAll();
    return list.map(toClientBookmark);
};

exports.addBookmark = async (
    _userId,
    gameState,
    name,
    gameType,
    moves,
    engine,
    depth,
    originState,
    whitePlayerName,
    blackPlayerName,
) => {
    const list = await readAll();
    const id = randomUUID();
    const bookmark = {
        _id: id,
        id,
        state: typeof gameState === "string" ? gameState : JSON.stringify(gameState),
        name: name || "Bookmark",
        gameType: gameType || "SinglePlayerGame",
        moves: Array.isArray(moves) ? moves : [],
        engine: runtime.normalizeEngine(engine),
        depth: normalizeThinkingTimeSeconds(depth),
        date: new Date(),
    };
    if (typeof whitePlayerName === "string" && whitePlayerName.trim()) {
        bookmark.whitePlayerName = whitePlayerName.trim();
    }
    if (typeof blackPlayerName === "string" && blackPlayerName.trim()) {
        bookmark.blackPlayerName = blackPlayerName.trim();
    }
    if (originState != null && String(originState).trim()) {
        bookmark.originState =
            typeof originState === "string" ? originState : JSON.stringify(originState);
    }
    list.push(bookmark);
    await writeAll(list);
    return toClientBookmark(bookmark);
};

exports.updateBookmark = async (
    _userId,
    id,
    date,
    name,
    gameType,
    gameState,
    moves,
    engine,
    depth,
    originState,
    whitePlayerName,
    blackPlayerName,
) => {
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
        bookmark.depth = normalizeThinkingTimeSeconds(depth);
    }
    if (whitePlayerName !== undefined) {
        if (whitePlayerName == null || !String(whitePlayerName).trim()) {
            delete bookmark.whitePlayerName;
        } else {
            bookmark.whitePlayerName = String(whitePlayerName).trim();
        }
    }
    if (blackPlayerName !== undefined) {
        if (blackPlayerName == null || !String(blackPlayerName).trim()) {
            delete bookmark.blackPlayerName;
        } else {
            bookmark.blackPlayerName = String(blackPlayerName).trim();
        }
    }
    if (originState !== undefined) {
        if (originState == null || !String(originState).trim()) {
            delete bookmark.originState;
        } else {
            bookmark.originState =
                typeof originState === "string" ? originState : JSON.stringify(originState);
        }
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
