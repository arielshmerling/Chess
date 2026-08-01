const catchAsync = require("../../utils/catchAsync");
const ExpressError = require("../../utils/ExpressError");
const presence = require("../../utils/presence");
const friendsService = require("./service");
const gameController = require("../game/controller");

exports.showFriendsPage = catchAsync(async (req, res) => {
    const sessionUserId = req.session.user_id ? String(req.session.user_id) : "";
    const sessionUsername = req.session.user_name != null ? String(req.session.user_name) : "";
    res.render("friends", { sessionUserId, sessionUsername });
});

exports.pingPresence = catchAsync(async (req, res) => {
    if (!req.session.user_id) {
        return res.status(401).json({ ok: false });
    }
    presence.touch(String(req.session.user_id));
    res.json({ ok: true });
});

exports.getData = catchAsync(async (req, res) => {
    const data = await friendsService.getFriendsPagePayload(String(req.session.user_id));
    res.json({ ok: true, ...data });
});

exports.getPlayingUsernames = catchAsync(async (req, res) => {
    const usernames = await friendsService.getPlayingUsernamesList();
    res.json({ ok: true, usernames });
});

exports.searchUsers = catchAsync(async (req, res) => {
    const q = req.query.q;
    const { results } = await friendsService.searchUsers(String(req.session.user_id), q);
    res.json({ ok: true, results });
});

exports.sendInvite = catchAsync(async (req, res) => {
    const targetUserId = req.body && req.body.targetUserId;
    if (targetUserId == null || String(targetUserId).trim() === "") {
        throw new ExpressError("targetUserId is required", 400);
    }
    await friendsService.sendFriendInvite(String(req.session.user_id), String(targetUserId).trim());
    res.json({ ok: true });
});

exports.acceptInvite = catchAsync(async (req, res) => {
    const fromUserId = req.body && req.body.fromUserId;
    if (fromUserId == null || String(fromUserId).trim() === "") {
        throw new ExpressError("fromUserId is required", 400);
    }
    await friendsService.acceptFriendInvite(String(req.session.user_id), String(fromUserId).trim());
    res.json({ ok: true });
});

exports.declineInvite = catchAsync(async (req, res) => {
    const fromUserId = req.body && req.body.fromUserId;
    if (fromUserId == null || String(fromUserId).trim() === "") {
        throw new ExpressError("fromUserId is required", 400);
    }
    await friendsService.declineFriendInvite(String(req.session.user_id), String(fromUserId).trim());
    res.json({ ok: true });
});

exports.removeFriend = catchAsync(async (req, res) => {
    const friendUserId = req.body && req.body.friendUserId;
    if (friendUserId == null || String(friendUserId).trim() === "") {
        throw new ExpressError("friendUserId is required", 400);
    }
    await friendsService.removeFriend(String(req.session.user_id), String(friendUserId).trim());
    res.json({ ok: true });
});

exports.withdrawInvite = catchAsync(async (req, res) => {
    const targetUserId = req.body && req.body.targetUserId;
    if (targetUserId == null || String(targetUserId).trim() === "") {
        throw new ExpressError("targetUserId is required", 400);
    }
    await friendsService.withdrawFriendInvite(String(req.session.user_id), String(targetUserId).trim());
    res.json({ ok: true });
});

exports.sendGameInvite = catchAsync(async (req, res) => {
    const targetUserId = req.body && req.body.targetUserId;
    if (targetUserId == null || String(targetUserId).trim() === "") {
        throw new ExpressError("targetUserId is required", 400);
    }
    const { gameId, offer } = await gameController.createFriendInviteGameForUser(
        String(req.session.user_id),
        String(req.session.user_name || ""),
        String(targetUserId).trim(),
        req.body || {}
    );
    res.json({ ok: true, gameId, offer: offer || null });
});

exports.declineGameInvite = catchAsync(async (req, res) => {
    const gameId = req.body && req.body.gameId;
    if (gameId == null || String(gameId).trim() === "") {
        throw new ExpressError("gameId is required", 400);
    }
    await gameController.declineFriendInviteGame(String(gameId).trim(), String(req.session.user_id));
    res.json({ ok: true });
});

exports.acceptGameInvite = gameController.acceptFriendGameInvite;

exports.withdrawGameInvite = catchAsync(async (req, res) => {
    const gameId = req.body && req.body.gameId;
    if (gameId == null || String(gameId).trim() === "") {
        throw new ExpressError("gameId is required", 400);
    }
    await gameController.withdrawFriendInviteGame(String(gameId).trim(), String(req.session.user_id));
    res.json({ ok: true });
});
