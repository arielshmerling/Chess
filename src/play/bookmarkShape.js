/**
 * Client bookmark shape shared by desktop file store and web Mongo bookmarks.
 */

/**
 * @param {object} doc
 * @returns {object}
 */
function toClientBookmark(doc) {
    if (!doc) {
        return null;
    }
    const id = doc._id != null ? doc._id : doc.id;
    return {
        _id: id,
        id: id,
        name: doc.name,
        date: doc.date,
        gameType: doc.gameType,
        state: doc.state,
        originState: doc.originState,
        moves: Array.isArray(doc.moves) ? doc.moves : [],
        engine: doc.engine,
        depth: doc.depth,
        whitePlayerName: doc.whitePlayerName,
        blackPlayerName: doc.blackPlayerName,
    };
}

module.exports = {
    toClientBookmark,
};
