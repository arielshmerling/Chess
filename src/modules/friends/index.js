const express = require("express");
const { requireLogin } = require("../../utils.js");
const friendsController = require("./controller");

const router = express.Router();

router.get("/friends", requireLogin, friendsController.showFriendsPage);
router.post("/api/presence/ping", requireLogin, friendsController.pingPresence);
router.get("/api/friends/data", requireLogin, friendsController.getData);
router.get("/api/friends/playing-usernames", requireLogin, friendsController.getPlayingUsernames);
router.get("/api/friends/search", requireLogin, friendsController.searchUsers);
router.post("/api/friends/invite", requireLogin, friendsController.sendInvite);
router.post("/api/friends/accept", requireLogin, friendsController.acceptInvite);
router.post("/api/friends/decline", requireLogin, friendsController.declineInvite);
router.post("/api/friends/remove", requireLogin, friendsController.removeFriend);
router.post("/api/friends/withdraw", requireLogin, friendsController.withdrawInvite);
router.post("/api/friends/game-invite", requireLogin, friendsController.sendGameInvite);
router.post("/api/friends/game-invite-decline", requireLogin, friendsController.declineGameInvite);
router.post("/api/friends/game-invite-withdraw", requireLogin, friendsController.withdrawGameInvite);

module.exports = router;
