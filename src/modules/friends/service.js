const mongoose = require("mongoose");
const { User } = require("../user/model");
const gamesManagerService = require("../gamesManager/service");
const presence = require("../../utils/presence");
const ExpressError = require("../../utils/ExpressError");

const MAX_SEARCH_LEN = 48;
const SEARCH_RESULTS_LIMIT = 25;

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Keep only ASCII letters and digits (username search).
 * @param {unknown} q
 */
function sanitizeFriendSearchQuery(q) {
    if (q == null) {
        return "";
    }
    return String(q).replace(/[^a-zA-Z0-9]/g, "").slice(0, MAX_SEARCH_LEN);
}

/**
 * @returns {Promise<Set<string>>}
 */
async function getUsernamesCurrentlyPlaying() {
    const games = await gamesManagerService.getOnGoingOnlineGames(500, { publicOnly: false });
    const names = new Set();
    for (const g of games) {
        const w = g.whitePlayer?.userName;
        const b = g.blackPlayer?.userName;
        if (w) {
            names.add(String(w));
        }
        if (b) {
            names.add(String(b));
        }
    }
    return names;
}

/** All usernames in ongoing DB-tracked games (for friends UI playing sync). */
exports.getPlayingUsernamesList = async () => {
    const s = await getUsernamesCurrentlyPlaying();
    return Array.from(s);
};

/**
 * @param {string} currentUserId
 */
exports.getFriendsPagePayload = async (currentUserId) => {
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
        throw new ExpressError("Invalid session", 400);
    }
    const me = await User.findById(currentUserId)
        .populate("friends", "username")
        .populate("friendInvitesReceived", "username")
        .populate("friendInvitesSent", "username")
        .lean();
    if (!me) {
        throw new ExpressError("User not found", 404);
    }

    const playing = await getUsernamesCurrentlyPlaying();

    const friendIds = new Set((me.friends || []).map((f) => String(f._id)));

    const meUsername = me.username != null ? String(me.username) : "";

    const friendsOnly = [];
    for (const f of me.friends || []) {
        const id = String(f._id);
        const username = f.username != null ? String(f.username) : "";
        let status = "offline";
        let sharedGameWithMeId = null;
        if (playing.has(username)) {
            status = "playing";
            sharedGameWithMeId =
                gamesManagerService.findSharedOnlineGameIdBetweenUsers(currentUserId, id) ||
                (await gamesManagerService.findSharedOnlineGameIdByUsernames(meUsername, username));
        } else if (presence.isOnline(id)) {
            status = "online";
        }
        friendsOnly.push({ id, username, status, rowType: "friend", sharedGameWithMeId });
    }

    const pendingOutgoing = (me.friendInvitesSent || [])
        .filter((u) => u && u._id && !friendIds.has(String(u._id)))
        .map((u) => ({
            id: String(u._id),
            username: u.username != null ? String(u.username) : "",
            rowType: "pendingOut",
        }));

    const friends = [...friendsOnly, ...pendingOutgoing].sort((a, b) =>
        a.username.localeCompare(b.username, undefined, { sensitivity: "base" })
    );

    const offersIn = (me.friendInvitesReceived || []).map((u) => ({
        id: String(u._id),
        username: u.username != null ? String(u.username) : "",
    }));

    let pendingGameInvite = null;
    const pendingGame = gamesManagerService.findPendingGameCreatedByMe(
        gamesManagerService.GameTypes.ONLINE,
        currentUserId
    );
    if (pendingGame && pendingGame.invitedUserId) {
        const inviteeOid = pendingGame.invitedUserId;
        const inviteeDoc = await User.findById(inviteeOid).select("username").lean();
        pendingGameInvite = {
            gameId: String(pendingGame.gameId),
            inviteeUserId: String(inviteeOid),
            inviteeUsername:
                inviteeDoc && inviteeDoc.username != null ? String(inviteeDoc.username) : "",
        };
    }

    const incomingGames = gamesManagerService.findPendingIncomingFriendGameInvites(currentUserId);
    const incomingGameInvites = incomingGames.map((g) => {
        const fromId = g.createdBy && g.createdBy.userId ? String(g.createdBy.userId) : "";
        let fromUsername = "";
        if (g.createdBy && g.createdBy.userName) {
            fromUsername = String(g.createdBy.userName);
        } else if (g.whitePlayer && g.whitePlayer.userId && String(g.whitePlayer.userId) === fromId) {
            fromUsername = String(g.whitePlayer.userName || "");
        } else if (g.blackPlayer && g.blackPlayer.userId && String(g.blackPlayer.userId) === fromId) {
            fromUsername = String(g.blackPlayer.userName || "");
        }
        return {
            gameId: String(g.gameId),
            fromUserId: fromId,
            fromUsername: fromUsername,
            offer: g.inviteOffer || null,
        };
    });

    return { friends, offersIn, pendingGameInvite, incomingGameInvites };
};

/**
 * @param {string} currentUserId
 * @param {string} rawQuery
 */
exports.searchUsers = async (currentUserId, rawQuery) => {
    const q = sanitizeFriendSearchQuery(rawQuery);
    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
        throw new ExpressError("Invalid session", 400);
    }
    if (!q || q.length < 1) {
        return { results: [] };
    }

    const me = await User.findById(currentUserId)
        .select("friends friendInvitesSent friendInvitesReceived")
        .lean();
    if (!me) {
        throw new ExpressError("User not found", 404);
    }

    const friendIds = new Set((me.friends || []).map((id) => String(id)));
    const sentIds = new Set((me.friendInvitesSent || []).map((id) => String(id)));
    const receivedIds = new Set((me.friendInvitesReceived || []).map((id) => String(id)));

    const rx = new RegExp(escapeRegex(q), "i");
    const candidates = await User.find({
        _id: { $ne: currentUserId },
        username: rx,
    })
        .select("username")
        .limit(SEARCH_RESULTS_LIMIT)
        .lean();

    const results = candidates.map((u) => {
        const id = String(u._id);
        return {
            id,
            username: u.username != null ? String(u.username) : "",
            isFriend: friendIds.has(id),
            requestSent: sentIds.has(id),
            requestReceived: receivedIds.has(id),
        };
    });

    return { results };
};

/**
 * @param {string} fromUserId
 * @param {string} targetUserId
 */
exports.sendFriendInvite = async (fromUserId, targetUserId) => {
    if (!mongoose.Types.ObjectId.isValid(fromUserId) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
        throw new ExpressError("Invalid user id", 400);
    }
    if (fromUserId === targetUserId) {
        throw new ExpressError("Cannot invite yourself", 400);
    }

    const [fromUser, targetUser] = await Promise.all([
        User.findById(fromUserId).select("friends friendInvitesSent friendInvitesReceived username"),
        User.findById(targetUserId).select("friends friendInvitesSent friendInvitesReceived username"),
    ]);
    if (!fromUser || !targetUser) {
        throw new ExpressError("User not found", 404);
    }

    const tId = targetUser._id;
    const fId = fromUser._id;

    if (fromUser.friends.some((id) => id.equals(tId))) {
        throw new ExpressError("Already friends", 409);
    }
    if (fromUser.friendInvitesSent.some((id) => id.equals(tId))) {
        throw new ExpressError("Invite already sent", 409);
    }
    if (fromUser.friendInvitesReceived.some((id) => id.equals(tId))) {
        throw new ExpressError("This user already invited you — accept from your offers list", 409);
    }

    await User.updateOne({ _id: fId }, { $addToSet: { friendInvitesSent: tId } });
    await User.updateOne({ _id: tId }, { $addToSet: { friendInvitesReceived: fId } });

    return { ok: true };
};

/**
 * @param {string} currentUserId
 * @param {string} fromUserId - sender of the offer being accepted
 */
exports.acceptFriendInvite = async (currentUserId, fromUserId) => {
    if (!mongoose.Types.ObjectId.isValid(currentUserId) || !mongoose.Types.ObjectId.isValid(fromUserId)) {
        throw new ExpressError("Invalid user id", 400);
    }
    if (currentUserId === fromUserId) {
        throw new ExpressError("Invalid request", 400);
    }

    const meOid = new mongoose.Types.ObjectId(currentUserId);
    const fromOid = new mongoose.Types.ObjectId(fromUserId);

    const otherExists = await User.exists({ _id: fromOid });
    if (!otherExists) {
        throw new ExpressError("User not found", 404);
    }

    // Single-document updates only (no multi-doc transaction — works on standalone MongoDB).
    const r1 = await User.updateOne(
        { _id: meOid, friendInvitesReceived: fromOid },
        {
            $pull: {
                friendInvitesReceived: fromOid,
                friendInvitesSent: fromOid,
            },
            $addToSet: { friends: fromOid },
        }
    );
    if (r1.matchedCount === 0) {
        throw new ExpressError("No pending offer from this user", 400);
    }

    const r2 = await User.updateOne(
        { _id: fromOid },
        {
            $pull: {
                friendInvitesSent: meOid,
                friendInvitesReceived: meOid,
            },
            $addToSet: { friends: meOid },
        }
    );
    if (r2.matchedCount === 0) {
        await User.updateOne(
            { _id: meOid },
            {
                $pull: { friends: fromOid },
                $addToSet: { friendInvitesReceived: fromOid },
            }
        );
        throw new ExpressError("User not found", 404);
    }

    return { ok: true };
};

/**
 * @param {string} currentUserId
 * @param {string} fromUserId
 */
exports.declineFriendInvite = async (currentUserId, fromUserId) => {
    if (!mongoose.Types.ObjectId.isValid(currentUserId) || !mongoose.Types.ObjectId.isValid(fromUserId)) {
        throw new ExpressError("Invalid user id", 400);
    }

    const me = await User.findById(currentUserId).select("friendInvitesReceived");
    if (!me) {
        throw new ExpressError("User not found", 404);
    }
    const otherOid = new mongoose.Types.ObjectId(fromUserId);
    const hasOffer = me.friendInvitesReceived.some((id) => id.equals(otherOid));
    if (!hasOffer) {
        throw new ExpressError("No pending offer from this user", 400);
    }

    await User.updateOne({ _id: me._id }, { $pull: { friendInvitesReceived: otherOid } });
    await User.updateOne({ _id: otherOid }, { $pull: { friendInvitesSent: me._id } });

    return { ok: true };
};

/**
 * @param {string} currentUserId
 * @param {string} friendUserId
 */
exports.removeFriend = async (currentUserId, friendUserId) => {
    if (!mongoose.Types.ObjectId.isValid(currentUserId) || !mongoose.Types.ObjectId.isValid(friendUserId)) {
        throw new ExpressError("Invalid user id", 400);
    }
    if (currentUserId === friendUserId) {
        throw new ExpressError("Invalid request", 400);
    }

    const me = await User.findById(currentUserId).select("friends");
    if (!me) {
        throw new ExpressError("User not found", 404);
    }
    const fOid = new mongoose.Types.ObjectId(friendUserId);
    const isFriend = me.friends.some((id) => id.equals(fOid));
    if (!isFriend) {
        throw new ExpressError("Not in your friends list", 400);
    }

    await User.updateOne({ _id: me._id }, { $pull: { friends: fOid } });
    await User.updateOne({ _id: fOid }, { $pull: { friends: me._id } });

    return { ok: true };
};

/**
 * Sender cancels an outgoing invite (same DB effect as recipient declining).
 * @param {string} currentUserId
 * @param {string} targetUserId
 */
exports.withdrawFriendInvite = async (currentUserId, targetUserId) => {
    if (!mongoose.Types.ObjectId.isValid(currentUserId) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
        throw new ExpressError("Invalid user id", 400);
    }
    if (currentUserId === targetUserId) {
        throw new ExpressError("Invalid request", 400);
    }

    const me = await User.findById(currentUserId).select("friendInvitesSent");
    if (!me) {
        throw new ExpressError("User not found", 404);
    }
    const targetOid = new mongoose.Types.ObjectId(targetUserId);
    const hasSent = me.friendInvitesSent.some((id) => id.equals(targetOid));
    if (!hasSent) {
        throw new ExpressError("No pending offer to this user", 400);
    }

    await User.updateOne({ _id: me._id }, { $pull: { friendInvitesSent: targetOid } });
    await User.updateOne({ _id: targetOid }, { $pull: { friendInvitesReceived: me._id } });

    return { ok: true };
};

exports.sanitizeFriendSearchQuery = sanitizeFriendSearchQuery;
