/*global startGame */


/* eslint-disable-next-line no-unused-vars */
function menuPositionSetup() {
    console.log("not implemented");
};

/* eslint-disable-next-line no-unused-vars */
function menuSettings() {

}

/* eslint-disable-next-line no-unused-vars */
function startSearchingForOpponenet() {
    window.location = "./game?gameType=2"; // OnlineGame
}

/* eslint-disable-next-line no-unused-vars */
function startAIGame() {
    window.location = "./game?gameType=1"; //SinglePlayerGame
}

/* eslint-disable-next-line no-unused-vars */
function startPracticeGame() {
    window.location = "./game?gameType=3";
}
/* eslint-disable-next-line no-unused-vars */
function navigateToGameList() {
    window.location = "./list";
}
/* eslint-disable-next-line no-unused-vars */
function movePiece() {

}
/* eslint-disable-next-line no-unused-vars */
function OpenMenu() {

    const mainMenu = document.getElementById("mainMenu");
    if (mainMenu.style.visibility == "hidden") {
        mainMenu.style.visibility = "visible";
        mainMenu.style.opacity = "1";
    }
    else {
        mainMenu.style.visibility = "hidden";
        mainMenu.style.opacity = "0";
    }
}

/* eslint-disable-next-line no-unused-vars */
function menuNewGameTwoPlayers() {
    //  gameType = 2; OnlineGame
    startGame();
}
/* eslint-disable-next-line no-unused-vars */
function menuNewGameOnePlayer() {
    // gameType = 1;
    startGame();
}