const express = require("express");

const { requireLogin } = require("./../../utils.js");
const gameManagerController = require("./controller");
const router = express.Router();
router.get("/home", requireLogin, gameManagerController.showHomePage);
router.get("/list", requireLogin, gameManagerController.showList);
router.delete("/list/:id", requireLogin, gameManagerController.delete);
router.get("/generateState", requireLogin, gameManagerController.generateState);
router.get("/search", requireLogin, gameManagerController.search);

module.exports = router;