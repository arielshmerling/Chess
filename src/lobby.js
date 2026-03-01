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

function openPlayNowModal() {
    const modal = document.getElementById("playNowModal");
    if (!modal) { return; }
    const mouseDrag = document.getElementById("mouseDrag");
    const mouseDouble = document.getElementById("mouseDouble");
    const mouseDragLabel = document.getElementById("mouseDragLabel");
    if (mouseDrag && mouseDouble && mouseDragLabel) {
        const isMobile = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
        if (isMobile) {
            mouseDouble.checked = true;
            mouseDrag.disabled = true;
            mouseDragLabel.classList.add("disabled");
        } else {
            mouseDrag.disabled = false;
            mouseDragLabel.classList.remove("disabled");
        }
    }
    modal.setAttribute("aria-hidden", "false");
}

function closePlayNowModal() {
    const modal = document.getElementById("playNowModal");
    if (modal) {
        modal.setAttribute("aria-hidden", "true");
    }
}

function startNewGameFromModal(event) {
    event.preventDefault();
    const form = document.getElementById("playNowForm");
    if (!form) { return; }
    const formData = new FormData(form);
    const color = formData.get("color") || "white";
    const engine = formData.get("engine") || "brain4";
    const difficulty = formData.get("difficulty") || "3";
    const mouse = formData.get("mouse") || "drag";
    const showMoves = formData.get("showMoves") === "1" ? "1" : "0";
    const params = new URLSearchParams({
        gameType: "1",
        color: color,
        engine: engine,
        difficulty: difficulty,
        mouse: mouse,
        showMoves: showMoves
    });
    closePlayNowModal();
    window.location = "/game?" + params.toString();
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