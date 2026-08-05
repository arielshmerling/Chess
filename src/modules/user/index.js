const express = require("express");
const userController = require("./controller");
const gameController = require("../game/controller");
const { storeReturnTo, requiresAdmin, requireLogin } = require("../../utils");
const router = express.Router();

router.get("/", userController.showLoginPage);

router.route("/login")
    .get(userController.showLoginPage)
    .post(storeReturnTo, userController.login);

router.post("/api/login", storeReturnTo, userController.loginJson);

router.get("/logout", userController.logout);
router.get("/validateUsername", userController.validateUsername);
router.get("/privacy", userController.showPrivacyPage);
router.get("/terms", userController.showTermsPage);
router.get("/contact", userController.showContactPage);
router.get("/accessibility", userController.showAccessibilityPage);


router.post("/admin/generate-state/stop", requiresAdmin, userController.stopGenerateState);
router.get("/admin/generate-state/stream", requiresAdmin, userController.generateStateStream);
router.get("/admin/generate-state", requiresAdmin, (req, res) => {
    res.redirect(301, "/admin?tab=opening-book");
});
router.get("/admin", requiresAdmin, userController.showAdminPage);
router.get("/admin/opening-book", requiresAdmin, userController.getAdminOpeningBookStatus);
router.get("/admin/engines", requiresAdmin, userController.listAdminEngines);
router.patch("/admin/engines/:id", requiresAdmin, userController.updateAdminEngine);
router.post("/admin/bots/duel", requiresAdmin, gameController.createEngineDuelHandler);
router.post("/admin/bots/duel/:id/stop", requiresAdmin, gameController.stopEngineDuelHandler);
router.patch("/admin/users/:id", requiresAdmin, userController.updateUserAdmin);

router.route("/register")
    .get(requiresAdmin, userController.showRegistrationPage)
    .post(requiresAdmin, userController.register);

router.route("/bookmark")
    .get(requireLogin, userController.getBookmarks)
    .post(requireLogin, userController.setBookmark);

router.post("/updateBookmark", requireLogin, userController.updateBookmark);
router.post("/applyBookmark", requireLogin, userController.applyBookmark);
router.post("/deleteBookmark", requireLogin, userController.deleteBookmark);

module.exports = router;