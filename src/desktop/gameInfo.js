/**
 * Game info payload for desktop clients (no MongoDB).
 */

function calculateTimer(game, isWhite) {
    if (game.startedOn) {
        if (isWhite) {
            if (game.chessGame.Turn === "white") {
                const currentTime = new Date().getTime() / 1000;
                const seconds = game.lastMoveOn / 1000;
                return game.chessGame.GameTimeLength - Math.round(currentTime - seconds);
            }
            const lastMove = game.moves[game.moves.length - 1];
            if (lastMove) {
                return lastMove.moveTime;
            }
            return game.chessGame.GameTimeLength;
        }
        if (game.chessGame.Turn === "black") {
            const currentTime = new Date().getTime() / 1000;
            const seconds = game.lastMoveOn / 1000;
            return game.chessGame.GameTimeLength - Math.round(currentTime - seconds);
        }
        const lastMove = game.moves[game.moves.length - 1];
        if (lastMove) {
            return lastMove.moveTime;
        }
        return game.chessGame.GameTimeLength;
    }
    return game.chessGame.GameTimeLength;
}

function createGameInfo(game, userName, userId) {
    let watcher = false;
    const clientData = {
        id: game.gameId,
        username: userName,
        userId: userId,
        creatorId: game.createdBy.userId,
        whitePlayerName: game.whitePlayer ? game.whitePlayer.userName : "",
        blackPlayerName: game.blackPlayer ? game.blackPlayer.userName : "",
        gameType: game.constructor.name,
        mode: game.mode,
        reviewType: game.reviewType,
        whiteTimer: calculateTimer(game, true),
        blackTimer: calculateTimer(game, false),
        status: game.status,
        isPrivate: game.isPrivate === true,
    };
    if (game.options) {
        clientData.mousePreference = game.options.mouse || "drag";
        clientData.difficulty = game.options.difficulty;
        clientData.engine = game.options.engine;
        clientData.showAvailableMoves = game.options.showAvailableMoves !== false;
    }
    if (game.chessGame) {
        const gtl = game.chessGame.GameTimeLength;
        if (typeof gtl === "number" && Number.isFinite(gtl) && gtl > 0) {
            clientData.gameTimeMinutes = Math.max(1, Math.round(gtl / 60));
        }
    }
    if (userName !== clientData.whitePlayerName && userName !== clientData.blackPlayerName) {
        watcher = true;
    }
    const stateForBoard =
        game.lastStatus === "in progress" ||
        game.status === "in progress" ||
        game.status === "pending" ||
        game.status === "establishing" ||
        game.status === "on hold" ||
        game.status === "reJoining";
    if (stateForBoard || watcher) {
        clientData.gameState = game.chessGame.GameState;
        clientData.watcher = watcher;
    }
    return clientData;
}

module.exports = { createGameInfo };
