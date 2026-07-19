////////////
//Game Service
////////////

const { ChessGame } = require("../../ChessGame");
const { GameFactory } = require("./GameFactory");
const { Player } = require("./Player");


exports.newGame = (gameType, username, userId, options = {}) => {
    const player = new Player(userId, username);
    const gameInfo = {
        gameType,
        playAsBlack: options.color === "black",
        invitedUserId: options.invitedUserId != null ? String(options.invitedUserId) : undefined,
        isPrivate: options.isPrivate === true,
        options: {
            engine: options.engine || "brain43",
            difficulty: options.difficulty || 3,
            mouse: options.mouse || "drag",
            showAvailableMoves: options.showAvailableMoves !== false,
            timeMinutes: typeof options.timeMinutes === "number" && options.timeMinutes >= 1 && options.timeMinutes <= 180
                ? options.timeMinutes
                : 90,
        }
    };
    const game = GameFactory.createGame(gameInfo, player, "play");
    const tm = options.timeMinutes;
    if (typeof tm === "number" && tm >= 1 && tm <= 180) {
        game.chessGame.GameTimeLength = tm * 60;
    }
    return game;
};

exports.createReviewGame = (userId, username, gameInfo, mode) => {
    const player = new Player(userId, gameInfo.whitePlayer);
    const game = GameFactory.createGame(gameInfo, player, mode);
    const blackPlayer = new Player(userId, gameInfo.blackPlayer, false);
    game.joinGame(blackPlayer);
    return game;
};

exports.joinAsViewer = (game, userId, username) => {
    const viewerPlayer = new Player(userId, username);
    game.watch(viewerPlayer);
};

exports.createServerChessGame = (gameId, username, userId, gameType, mode, reviewType, whitePlayerName, blackPlayerName, whitePlayer, blackPlayer) => {
    const chessGame = new ChessGame();
    chessGame.startNewGame(true);
    const time = new Date().toISOString().match(/(\d{2}:){2}\d{2}/)[0];
    const game = {
        gameId: gameId,
        gameType: gameType,
        createdBy: userId,
        createOn: time,
        createdByUsername: username,
        chessGame: chessGame,
        turn: "white",
        whitePlayer: whitePlayer,
        blackPlayer: blackPlayer,
        whitePlayerName: whitePlayerName,
        blackPlayerName: blackPlayerName,
        mode: mode,
        reviewType: reviewType,
    };
    return game;
};