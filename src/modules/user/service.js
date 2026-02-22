const { User, Bookmark } = require("./model");
const bcrypt = require("bcryptjs");
const gamesManagerService = require("../gamesManager/service");


exports.userExist = async (username) => {
    const foundUser = await User.findOne({ username });
    return foundUser != null;
};

exports.findUser = async (username, password) => {
    const foundUser = await User.authenticate(username, password);
    if (foundUser) {
        return foundUser;
    }
    return null;
};

exports.registerNewUser = async (username, password, email, level) => {
    const hash = await bcrypt.hash(password, 12);
    const user = new User({
        username,
        password: hash,
        email,
        level,
    });
    await user.save();
    return user;
};


exports.getAllUserBookmarks = async (userId) => {
    const user = await User.findOne({ _id: userId }).populate("bookmarks");
    const bookmarks = user.bookmarks;
    return bookmarks;
};


exports.addBookmark = async (userId, gameState, name, gameType, moves) => {
    try {
        const user = await User.findOne({ _id: userId });
        if (user) {
            const bookmarkDoc = new Bookmark({
                state: JSON.stringify(gameState),
                name,
                gameType,
                moves,
            });
            await bookmarkDoc.save();
            user.bookmarks.push(bookmarkDoc._id);
            await user.save();
        }
    } catch (error) {
        console.error(error);
    }
};

exports.updateBookmark = async (userId, id, date, name, gameType) => {
    try {
        //const obj = await User.findOne({ bookmarks: { $elemMatch: { _id: id } } });
        const user = await User.findOne({ _id: userId });
        const userBookmark = user.bookmarks.find((o) => o._id == id);
        const bookmarkDoc = await Bookmark.findOne({ _id: id });
        if (bookmarkDoc && userBookmark) {
            bookmarkDoc.name = name;
            bookmarkDoc.date = new Date(date);
            bookmarkDoc.gameType = gameType;
            await bookmarkDoc.save();
        }
    } catch (error) {
        console.error(error);
    }
};

exports.applyBookmark = async (userId, gameId, bookarkId) => {
    try {

        const game = gamesManagerService.getGameById(gameId);
        const user = await User.findOne({ _id: userId });
        const userBookmark = user.bookmarks.find((o) => o._id == bookarkId);
        const bookmarkDoc = await Bookmark.findOne({ _id: bookarkId });

        if (bookmarkDoc && userBookmark && game) {
            if (game.constructor.name == "SinglePlayerGame") {
                const moves = bookmarkDoc.moves.map(m => JSON.parse(m));
                game.chessGame.loadMoves(moves);
                game.moves = [...moves];
                game.raiseEvent(game.OnBookmarkLoaded, { game, moves: bookmarkDoc.moves });
                console.log("moves loaded");
                game.chessGame.loadGame(bookmarkDoc.state);
                console.log("bookmark loaded");
                if (!game.chessGame.GameOver && game.chessGame.Turn == "black") {
                    game.makeBrainMove(false);
                }

            }
        }
    } catch (error) {
        console.error(error);
    }
};

exports.deleteBookmark = async (id) => {
    try {
        const deletedBookmark = await Bookmark.findOneAndDelete({ _id: id });
        return deletedBookmark != null;
    } catch (error) {
        console.error(error);
        return false;
    }
};


