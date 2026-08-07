const express = require("express");

const { requireLogin, requiresAdmin } = require("./../../utils.js");
const gameManagerController = require("./controller");
const router = express.Router();
router.get("/home", requireLogin, gameManagerController.showHomePage);
router.get("/mobile-home", requireLogin, gameManagerController.showHomePageMobile);
router.get("/active-games", requireLogin, gameManagerController.getActiveGamesJson);
router.get("/active-games-list", requireLogin, gameManagerController.showActiveGamesListPage);
router.get("/list", requireLogin, gameManagerController.showList);
router.delete("/list/:id", requireLogin, gameManagerController.delete);
router.get("/generateState", requiresAdmin, gameManagerController.generateState);
router.get("/generateOpeningBook", requiresAdmin, gameManagerController.generateOpeningBook);
router.get("/search", requireLogin, gameManagerController.search);
router.get("/api/search/pgn", requireLogin, gameManagerController.searchPgnJson);

module.exports = router;