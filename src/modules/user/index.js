const express = require("express");
const userController = require("./controller");
const { storeReturnTo, requiresAdmin, requireLogin } = require("../../utils");
const router = express.Router();

router.get("/", userController.showLoginPage);

router.route("/login")
    .get(userController.showLoginPage)
    .post(storeReturnTo, userController.login);

router.post("/api/login", storeReturnTo, userController.loginJson);

router.get("/logout", userController.logout);
router.get("/validateUsername", userController.validateUsername);


router.post("/admin/generate-state/stop", requiresAdmin, userController.stopGenerateState);
router.get("/admin/generate-state/stream", requiresAdmin, userController.generateStateStream);
router.get("/admin/generate-state", requiresAdmin, userController.showGenerateStatePage);
router.get("/admin", requiresAdmin, userController.showAdminPage);
router.patch("/admin/users/:id", requiresAdmin, userController.updateUserAdmin);

router.route("/register")
    .get(requiresAdmin, userController.showRegistrationPage)
    .post(requiresAdmin, userController.register);

router.route("/bookmark", requireLogin)
    .get(userController.getBookmarks)
    .post(userController.setBookmark);

router.post("/updateBookmark", requireLogin, userController.updateBookmark);
router.post("/applyBookmark", requireLogin, userController.applyBookmark);
router.post("/deleteBookmark", requireLogin, userController.deleteBookmark);

module.exports = router;