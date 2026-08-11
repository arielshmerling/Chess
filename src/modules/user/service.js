const mongoose = require("mongoose");
const { User, Bookmark, USER_TYPES, resolveUserType } = require("./model");
const bcrypt = require("bcryptjs");
const ExpressError = require("../../utils/ExpressError");
const { notifyAdminPrivilegeChange } = require("../../utils/adminPrivilegeNotify");
const gamesManagerService = require("../gamesManager/service");
const { toClientBookmark } = require("../../play/bookmarkShape");

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const PLAYER_LEVELS = ["Rookie", "Skilled", "Elite", "Grand Master"];


exports.listUsersForAdmin = async () => {
    const [users, activeGamesByUser] = await Promise.all([
        User.find({})
            .select("username admin userType lastLogin email level elo joinedDate friends bookmarks")
            .sort({ username: 1 })
            .lean(),
        gamesManagerService.countActiveGamesPerUsername(),
    ]);
    return users.map((u) => ({
        id: String(u._id),
        username: u.username,
        admin: !!u.admin,
        userType: resolveUserType(u),
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

exports.updateUserByAdmin = async (userId, body, options = {}) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ExpressError("Invalid user id", 400);
    }
    const payload = body || {};
    const hasUsername = payload.username !== undefined && payload.username !== null;
    const hasEmail = payload.email !== undefined && payload.email !== null;
    const hasAdmin = Object.prototype.hasOwnProperty.call(payload, "admin");
    const hasUserType = Object.prototype.hasOwnProperty.call(payload, "userType");
    const hasLevel = Object.prototype.hasOwnProperty.call(payload, "level");
    const hasPassword = Object.prototype.hasOwnProperty.call(payload, "password");
    if (!hasUsername && !hasEmail && !hasAdmin && !hasUserType && !hasLevel && !hasPassword) {
        throw new ExpressError("Nothing to update", 400);
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new ExpressError("User not found", 404);
    }

    const oldAdmin = !!user.admin;
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

    if (hasUserType) {
        const nextType = String(payload.userType || "").trim();
        if (!USER_TYPES.includes(nextType)) {
            throw new ExpressError("Invalid user type", 400);
        }
        if (user.admin && nextType !== "Admin") {
            const adminCount = await User.countDocuments({ admin: true });
            if (adminCount <= 1) {
                throw new ExpressError(
                    "There must always be at least one admin. Promote another user to admin before removing this one.",
                    403
                );
            }
        }
        user.userType = nextType;
        user.admin = nextType === "Admin";
    } else if (hasAdmin) {
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
        if (nextAdmin) {
            user.userType = "Admin";
        } else if (user.userType === "Admin" || !user.userType) {
            user.userType = "Member";
        }
    }

    if (!USER_TYPES.includes(user.userType)) {
        user.userType = resolveUserType(user);
    }

    if (hasLevel) {
        const level = String(payload.level).trim();
        if (!PLAYER_LEVELS.includes(level)) {
            throw new ExpressError("Invalid level", 400);
        }
        user.level = level;
    }

    if (hasPassword) {
        const plain = String(payload.password);
        if (plain.length < 4 || plain.length > 30) {
            throw new ExpressError("Password must be between 4 and 30 characters", 400);
        }
        user.password = await bcrypt.hash(plain, 12);
    }

    await user.save();

    if ((hasAdmin || hasUserType) && oldAdmin !== !!user.admin) {
        await notifyAdminPrivilegeChange({
            actorUsername: options.actorUsername != null ? String(options.actorUsername) : "unknown",
            targetUsername: user.username,
            targetUserId: String(user._id),
            wasAdmin: oldAdmin,
            isAdmin: !!user.admin,
        });
    }

    return {
        id: String(user._id),
        username: user.username,
        email: user.email,
        admin: !!user.admin,
        userType: resolveUserType(user),
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
        userType: "Member",
        admin: false,
    });
    await user.save();
    return user;
};


exports.getAllUserBookmarks = async (userId) => {
    const user = await User.findOne({ _id: userId }).populate("bookmarks");
    const bookmarks = user && user.bookmarks ? user.bookmarks : [];
    return bookmarks.map((doc) => toClientBookmark(doc));
};


exports.addBookmark = async (
    userId,
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
    const user = await User.findOne({ _id: userId });
    if (!user) {
        return null;
    }
    const parsedDepth = Number(depth);
    const bookmarkDoc = new Bookmark({
        state: typeof gameState === "string" ? gameState : JSON.stringify(gameState),
        name,
        gameType,
        moves: Array.isArray(moves) ? moves : [],
        engine: (engine === "brain4" || engine === "brain41" || engine === "brain42" || engine === "brain43") ? engine : "brain43",
        depth: Number.isInteger(parsedDepth) && parsedDepth >= 1 && parsedDepth <= 6 ? parsedDepth : 3,
    });
    if (originState != null && String(originState).trim()) {
        bookmarkDoc.originState =
            typeof originState === "string" ? originState : JSON.stringify(originState);
    }
    if (typeof whitePlayerName === "string" && whitePlayerName.trim()) {
        bookmarkDoc.whitePlayerName = whitePlayerName.trim();
    }
    if (typeof blackPlayerName === "string" && blackPlayerName.trim()) {
        bookmarkDoc.blackPlayerName = blackPlayerName.trim();
    }
    await bookmarkDoc.save();
    user.bookmarks.push(bookmarkDoc._id);
    await user.save();
    return toClientBookmark(bookmarkDoc);
};

exports.updateBookmark = async (
    userId,
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
    try {
        const user = await User.findOne({ _id: userId });
        const userBookmark = user && user.bookmarks.find((o) => o._id == id);
        const bookmarkDoc = await Bookmark.findOne({ _id: id });
        if (bookmarkDoc && userBookmark) {
            if (name !== undefined) {bookmarkDoc.name = name;}
            if (date !== undefined) {bookmarkDoc.date = new Date(date);}
            if (gameType !== undefined) {bookmarkDoc.gameType = gameType;}
            if (gameState !== undefined) {
                bookmarkDoc.state = typeof gameState === "string" ? gameState : JSON.stringify(gameState);
                bookmarkDoc.markModified("state");
            }
            if (moves !== undefined) {
                bookmarkDoc.moves = moves;
                bookmarkDoc.markModified("moves");
            }
            if (engine !== undefined) {
                bookmarkDoc.engine = (engine === "brain4" || engine === "brain41" || engine === "brain42" || engine === "brain43") ? engine : "brain43";
            }
            if (depth !== undefined) {
                const parsedDepth = Number(depth);
                bookmarkDoc.depth = Number.isInteger(parsedDepth) && parsedDepth >= 1 && parsedDepth <= 6 ? parsedDepth : 3;
            }
            if (originState !== undefined) {
                if (originState == null || !String(originState).trim()) {
                    bookmarkDoc.originState = undefined;
                } else {
                    bookmarkDoc.originState =
                        typeof originState === "string" ? originState : JSON.stringify(originState);
                }
            }
            if (whitePlayerName !== undefined) {
                bookmarkDoc.whitePlayerName =
                    whitePlayerName == null || !String(whitePlayerName).trim()
                        ? undefined
                        : String(whitePlayerName).trim();
            }
            if (blackPlayerName !== undefined) {
                bookmarkDoc.blackPlayerName =
                    blackPlayerName == null || !String(blackPlayerName).trim()
                        ? undefined
                        : String(blackPlayerName).trim();
            }
            await bookmarkDoc.save();
            return toClientBookmark(bookmarkDoc);
        }
    } catch (error) {
        console.error(error);
    }
    return null;
};

exports.applyBookmark = async (userId, gameId, bookarkId) => {
    try {

        const game = gamesManagerService.getGameById(gameId);
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return false;
        }
        const userBookmark = user.bookmarks.find((o) => o._id == bookarkId);
        const bookmarkDoc = await Bookmark.findOne({ _id: bookarkId });

        if (bookmarkDoc && userBookmark && game) {
            const ownsGame =
                (game.createdBy && String(game.createdBy.userId) === String(userId)) ||
                (game.whitePlayer && String(game.whitePlayer.userId) === String(userId)) ||
                (game.blackPlayer && String(game.blackPlayer.userId) === String(userId));
            if (!ownsGame) {
                return false;
            }
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
                return true;
            }
        }
    } catch (error) {
        console.error(error);
    }
    return false;
};

exports.deleteBookmark = async (userId, id) => {
    try {
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return false;
        }
        const owned = user.bookmarks.some((o) => String(o._id) === String(id));
        if (!owned) {
            return false;
        }
        const deletedBookmark = await Bookmark.findOneAndDelete({ _id: id });
        if (!deletedBookmark) {
            return false;
        }
        user.bookmarks = user.bookmarks.filter((o) => String(o._id) !== String(id));
        await user.save();
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
};

function toIso(value) {
    if (!value) {
        return null;
    }
    try {
        return new Date(value).toISOString();
    } catch (_err) {
        return null;
    }
}

/**
 * Safe profile fields for the Account page (no password).
 * @param {string} userId
 */
exports.getAccountProfile = async (userId) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ExpressError("Invalid user id", 400);
    }
    const user = await User.findById(userId)
        .select("username email admin userType level elo joinedDate lastLogin lastGameOptions friends bookmarks")
        .lean();
    if (!user) {
        throw new ExpressError("User not found", 404);
    }
    return {
        id: String(user._id),
        username: user.username,
        email: user.email != null ? String(user.email) : "",
        userType: resolveUserType(user),
        level: user.level != null ? String(user.level) : "",
        elo: user.elo != null ? Number(user.elo) : null,
        joinedDate: toIso(user.joinedDate),
        lastLogin: toIso(user.lastLogin),
        friendsCount: Array.isArray(user.friends) ? user.friends.length : 0,
        bookmarksCount: Array.isArray(user.bookmarks) ? user.bookmarks.length : 0,
        lastGameOptions: user.lastGameOptions || null,
    };
};

/**
 * GDPR Art. 15/20 export payload (no password hash).
 * @param {string} userId
 */
exports.buildAccountDataExport = async (userId) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ExpressError("Invalid user id", 400);
    }
    const user = await User.findById(userId).lean();
    if (!user) {
        throw new ExpressError("User not found", 404);
    }
    const username = user.username;
    const friendIds = []
        .concat(user.friends || [])
        .concat(user.friendInvitesReceived || [])
        .concat(user.friendInvitesSent || [])
        .map((id) => String(id));
    const uniqueFriendIds = [...new Set(friendIds)];
    const friendDocs = uniqueFriendIds.length
        ? await User.find({ _id: { $in: uniqueFriendIds } }).select("username").lean()
        : [];
    const nameById = new Map(friendDocs.map((u) => [String(u._id), u.username]));

    const mapIds = (ids) => (Array.isArray(ids) ? ids : []).map((id) => ({
        id: String(id),
        username: nameById.get(String(id)) || null,
    }));

    const bookmarkIds = Array.isArray(user.bookmarks) ? user.bookmarks : [];
    const bookmarks = bookmarkIds.length
        ? await Bookmark.find({ _id: { $in: bookmarkIds } }).lean()
        : [];

    const { Game } = require("../game/model");
    const games = await Game.find({
        $or: [
            { createByUserId: user._id },
            { createBy: username },
            { whitePlayer: username },
            { blackPlayer: username },
        ],
    }).lean();

    return {
        exportedAt: new Date().toISOString(),
        schemaVersion: 1,
        profile: {
            id: String(user._id),
            username: user.username,
            email: user.email,
            userType: resolveUserType(user),
            admin: !!user.admin,
            level: user.level,
            elo: user.elo,
            joinedDate: toIso(user.joinedDate),
            lastLogin: toIso(user.lastLogin),
            lastGameOptions: user.lastGameOptions || null,
            playUiSettings: user.playUiSettings || null,
            playCustomThemes: user.playCustomThemes || null,
        },
        friends: mapIds(user.friends),
        friendInvitesReceived: mapIds(user.friendInvitesReceived),
        friendInvitesSent: mapIds(user.friendInvitesSent),
        bookmarks: bookmarks.map((b) => ({
            id: String(b._id),
            name: b.name,
            gameType: b.gameType,
            engine: b.engine,
            depth: b.depth,
            date: toIso(b.date),
            whitePlayerName: b.whitePlayerName,
            blackPlayerName: b.blackPlayerName,
            moves: b.moves,
            state: b.state,
            originState: b.originState,
        })),
        games: games.map((g) => ({
            id: String(g._id),
            createBy: g.createBy,
            createByUserId: g.createByUserId != null ? String(g.createByUserId) : null,
            state: g.state,
            reason: g.reason,
            result: g.result,
            created: toIso(g.created),
            whitePlayer: g.whitePlayer,
            blackPlayer: g.blackPlayer,
            gameType: g.gameType,
            isPrivate: !!g.isPrivate,
            timeMinutes: g.timeMinutes,
            moves: g.moves,
        })),
    };
};

/**
 * GDPR Art. 17 self-service erase with cascade.
 * @param {string} userId
 * @param {{ confirmUsername: string }} opts
 */
exports.deleteAccountCascade = async (userId, opts) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ExpressError("Invalid user id", 400);
    }
    const confirmUsername = opts && opts.confirmUsername != null
        ? String(opts.confirmUsername).trim()
        : "";
    if (!confirmUsername) {
        throw new ExpressError("Type your username to confirm deletion", 400);
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new ExpressError("User not found", 404);
    }
    if (confirmUsername !== user.username) {
        throw new ExpressError("Username confirmation does not match", 400);
    }
    if (user.admin) {
        const adminCount = await User.countDocuments({ admin: true });
        if (adminCount <= 1) {
            throw new ExpressError(
                "There must always be at least one admin. Promote another user to admin before deleting this account.",
                403,
            );
        }
    }

    const username = user.username;
    const bookmarkIds = Array.isArray(user.bookmarks) ? user.bookmarks.slice() : [];

    await gamesManagerService.eraseUserFromGames({
        userId: String(user._id),
        username,
    });

    if (bookmarkIds.length) {
        await Bookmark.deleteMany({ _id: { $in: bookmarkIds } });
    }

    await User.updateMany(
        {},
        {
            $pull: {
                friends: user._id,
                friendInvitesReceived: user._id,
                friendInvitesSent: user._id,
            },
        },
    );

    await User.deleteOne({ _id: user._id });
    return { ok: true, username };
};

/**
 * Change password for the signed-in user (requires current password).
 * @param {string} userId
 * @param {{ currentPassword: string, newPassword: string, confirmPassword: string }} opts
 */
exports.changeAccountPassword = async (userId, opts) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ExpressError("Invalid user id", 400);
    }
    const currentPassword = opts && opts.currentPassword != null ? String(opts.currentPassword) : "";
    const newPassword = opts && opts.newPassword != null ? String(opts.newPassword) : "";
    const confirmPassword = opts && opts.confirmPassword != null ? String(opts.confirmPassword) : "";

    if (!currentPassword || !newPassword || !confirmPassword) {
        throw new ExpressError("Current password, new password, and confirmation are required", 400);
    }
    if (newPassword !== confirmPassword) {
        throw new ExpressError("New password and confirmation do not match", 400);
    }
    if (newPassword.length < 4 || newPassword.length > 30) {
        throw new ExpressError("Password must be between 4 and 30 characters", 400);
    }
    if (newPassword === currentPassword) {
        throw new ExpressError("New password must be different from the current password", 400);
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new ExpressError("User not found", 404);
    }
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
        throw new ExpressError("Current password is incorrect", 400);
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    return { ok: true };
};
