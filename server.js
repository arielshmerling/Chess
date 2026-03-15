const app = require("./src/app.js"); // Import the configured Express app
const { Database } = require("./src/db/database.js");
const gameManagerService = require("./src/modules/gamesManager/service.js");

// Initialize WebSocket service and lobby broadcast in the app
app.setWebSocketService(gameManagerService);
gameManagerService.setLobbyBroadcast(app.broadcastToLobby);

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log("listening on server. port:" + PORT);

    const db = Database.getInstance();
    await db.connect();
    try {
        await gameManagerService.deleteStaleNonTerminalGames();
    } catch (err) {
        console.error("Database cleanup failed:", err.message);
    }
    console.log("finish loading games");
    console.log("loading games completed");
});