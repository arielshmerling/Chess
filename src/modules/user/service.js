const mongoose = require("mongoose");
const { User, Bookmark } = require("./model");
const bcrypt = require("bcryptjs");
const ExpressError = require("../../utils/ExpressError");
const gamesManagerService = require("../gamesManager/service");

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const PLAYER_LEVELS = ["Rookie", "Skilled", "Elite", "Grand Master"];


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

exports.updateUserByAdmin = async (userId, body) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ExpressError("Invalid user id", 400);
    }
    const payload = body || {};
    const hasUsername = payload.username !== undefined && payload.username !== null;
    const hasEmail = payload.email !== undefined && payload.email !== null;
    const hasAdmin = Object.prototype.hasOwnProperty.call(payload, "admin");
    const hasLevel = Object.prototype.hasOwnProperty.call(payload, "level");
    if (!hasUsername && !hasEmail && !hasAdmin && !hasLevel) {
        throw new ExpressError("Nothing to update", 400);
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new ExpressError("User not found", 404);
    }

    const oldUsername = user.username;

    if (hasUsername) {
        const username = String(payload.username).trim();
        if (!username) {
            throw new ExpressError("Username cannot be empty", 400);
        }
        if (username.length > 64) {
            throw new ExpressError("Username is too long", 400);
        }
        const taken = await User.findOne({ username, _id: { $ne: user._id } });
        if (taken) {
            throw new ExpressError("That username is already taken", 409);
        }
        if (username !== oldUsername) {
            user.username = username;
            await gamesManagerService.renameUsernameInGames(oldUsername, username);
        }
    }

    if (hasEmail) {
        const email = String(payload.email).trim();
        if (!email) {
            throw new ExpressError("Email cannot be empty", 400);
        }
        if (!EMAIL_RE.test(email)) {
            throw new ExpressError("Invalid email address", 400);
        }
        user.email = email;
    }

    if (hasAdmin) {
        const nextAdmin = Boolean(payload.admin);
        if (user.admin && !nextAdmin) {
            const adminCount = await User.countDocuments({ admin: true });
            if (adminCount <= 1) {
                throw new ExpressError(
                    "There must always be at least one admin. Promote another user to admin before removing this one.",
                    403
                );
            }
        }
        user.admin = nextAdmin;
    }

    if (hasLevel) {
        const level = String(payload.level).trim();
        if (!PLAYER_LEVELS.includes(level)) {
            throw new ExpressError("Invalid level", 400);
        }
        user.level = level;
    }

    await user.save();
    return {
        id: String(user._id),
        username: user.username,
        email: user.email,
        admin: !!user.admin,
        level: user.level,
    };
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


