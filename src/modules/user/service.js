const { User, Bookmark } = require("./model");
const bcrypt = require("bcryptjs");
const gamesManagerService = require("../gamesManager/service");


exports.listUsersForAdmin = async () => {
    const [users, activeGamesByUser] = await Promise.all([
        User.find({})
            .select("username admin lastLogin email level elo joinedDate friends bookmarks")
            .sort({ username: 1 })
            .lean(),
        gamesManagerService.countActiveGamesPerUsername(),
    ]);
    return users.map((u) => ({
        id: String(u._id),
        username: u.username,
        admin: !!u.admin,
        email: u.email != null ? String(u.email) : "",
        level: u.level != null ? String(u.level) : "",
        elo: u.elo != null ? Number(u.elo) : null,
        joinedDate: u.joinedDate ? u.joinedDate.toISOString() : null,
        lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
        activeGamesCount: activeGamesByUser.get(u.username) || 0,
        friendsCount: Array.isArray(u.friends) ? u.friends.length : 0,
        bookmarksCount: Array.isArray(u.bookmarks) ? u.bookmarks.length : 0,
    }));
};

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

exports.updateBookmark = async (userId, id, date, name, gameType, gameState, moves) => {
    try {
        const user = await User.findOne({ _id: userId });
        const userBookmark = user.bookmarks.find((o) => o._id == id);
        const bookmarkDoc = await Bookmark.findOne({ _id: id });
        if (bookmarkDoc && userBookmark) {
            if (name !== undefined) bookmarkDoc.name = name;
            if (date !== undefined) bookmarkDoc.date = new Date(date);
            if (gameType !== undefined) bookmarkDoc.gameType = gameType;
            if (gameState !== undefined) {
                bookmarkDoc.state = typeof gameState === "string" ? gameState : JSON.stringify(gameState);
                bookmarkDoc.markModified("state");
            }
            if (moves !== undefined) {
                bookmarkDoc.moves = moves;
                bookmarkDoc.markModified("moves");
            }
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


