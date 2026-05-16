/**
 * Desktop bookmark HTTP handlers (JSON file store).
 */

const catchAsync = require("../utils/catchAsync");
const bookmarkStore = require("./bookmarkStore");
const { applyBookmark } = require("./applyBookmark");

exports.list = catchAsync(async (_req, res) => {
    const bookmarks = await bookmarkStore.getAllUserBookmarks();
    res.send(bookmarks);
});

exports.create = catchAsync(async (req, res) => {
    const userId = req.session.user_id;
    const { gameState, name, gameType, moves, engine, depth } = req.body;
    await bookmarkStore.addBookmark(userId, gameState, name, gameType, moves, engine, depth);
    res.send('{"status":"OK"}');
});

exports.update = catchAsync(async (req, res) => {
    const userId = req.session.user_id;
    const { id, name, gameType, date, gameState, moves, engine, depth } = req.body;
    if (!id) {
        res.send("ERROR");
        return;
    }
    await bookmarkStore.updateBookmark(userId, id, date, name, gameType, gameState, moves, engine, depth);
    res.send('{"status":"OK"}');
});

exports.remove = catchAsync(async (req, res) => {
    const { id } = req.body;
    if (!id) {
        res.send("ERROR");
        return;
    }
    const ok = await bookmarkStore.deleteBookmark(id);
    res.send(ok ? '{"status":"OK"}' : "ERROR");
});

exports.apply = catchAsync(async (req, res) => {
    const userId = req.session.user_id;
    const { gameId, bookarkId } = req.body;
    if (!userId || !gameId || !bookarkId) {
        res.send("ERROR");
        return;
    }
    await applyBookmark(userId, gameId, bookarkId);
    res.send('{"status":"OK"}');
});
