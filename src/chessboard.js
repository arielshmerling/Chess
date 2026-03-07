/*global axios, ChessGame*/
//const { ChessGame } = require("./ChessGame");
// Globals
let promotionCallback = null;
let lastMove = null;
let drag = false;
let game;
let alertMode;
let promotingMode;
let dialogOn;
let gameType = 0;
let gameInfo;
let currentPlayerIsWhite;
let webSocket;
let whiteTimer, blackTimer;
let whiteHandle, blackHandle;
let disconnectionTimer, disconnectionTimerHandle, rejoined;
let moveHandle;
let moveIndex = 0;
const buttonsState = [];
let gameMoves = { moves: [] };
let bookmarks = [];
let autoCompletePromotion = false;
let animating = false;
let pause = false;
let draggedImage, offsetX, offsetY, chessboard, coordX, coordY, sourcePosition, targetPosition;
let currentEditingBookmark = null;
let clickToMoveSelected = null;

const WhitePawnUrl = "images/3409_white-pawn.png";
const WhiteRookUrl = "images/3406_white-rook.png";
const WhiteBishopUrl = "images/3407_white-bishop.png";
const WhiteKnightUrl = "images/3408_white-knight.png";
const WhiteKingUrl = "images/3404_white-king.png";
const WhiteQueenUrl = "images/3405_white-queen.png";

const BlackPawnUrl = "images/3403_black-pawn.png";
const BlackRookUrl = "images/3400_black-rook.png";
const BlackBishopUrl = "images/3401_black-bishop.png";
const BlackKnightUrl = "images/3402_black-knight.png";
const BlackKingUrl = "images/3398_black-king.png";
const BlackQueenUrl = "images/3399_black-queen.png";


const whitePiecesURL = [WhitePawnUrl, WhiteKingUrl, WhiteKnightUrl, WhiteBishopUrl, WhiteRookUrl, WhiteQueenUrl];
const blackPiecesURL = [BlackPawnUrl, BlackKingUrl, BlackKnightUrl, BlackBishopUrl, BlackRookUrl, BlackQueenUrl];


const guiBoard = [
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null]
];

const UserMessages = {
    OPPONENT_RECONNCETION_FAILED: "Opponent failed to reconnect",
};

const Labels = {
    LOAD_GAME: "Load Game",
    LOAD: "Load",
    ENTER_GAME_STATE: "Paste game state here...",
    CANCEL: "Cancel",
    YES: "Yes",
    NO: "No",
    REMATCH: "Rematch",
    RESIGN: "Resign",
    DRAW: "Draw Offer",
    UNDO: "Undo",
    REDO: "Redo",
    LAST_MOVE: "Last Move",
    HOME: "Quit",
    FLIP: "Flip",
    BOOKMARKS: "Bookmarks",
};

window.onload = function () {
    console.log(window.location.pathname);
    //populatePaletteSelctor();
    // overrideFormValidity();
    if (window.location.pathname == "/game" ||
        window.location.pathname == "/watch" ||
        window.location.pathname == "/review") {
        // setDefaultTheme(themes.darkTheme);
        game = new ChessGame();
        createGUIBoard();
        addOptionsButtons();
        generateMoveButtons();
        registerWindowEvents();
        startGame();
    }
};

/**
 * Registers to window events such as onmouseup, onmousedown, click, keydown, etc
 *
 
 * @example
 *
 *     registerWindowEvents()
 */
function registerWindowEvents() {
    document.onmousedown = startDrag;
    document.onmouseup = stopDrag;

    const menuButton = document.getElementById("menuButton");
    const lastMoveBtn = document.getElementById("lastMoveBtn");
    const bookmarkBtn = document.getElementById("bookmarkBtn");
    const bookmarksPanel = document.getElementById("bookmarksPanel");
    document.addEventListener("click", (event) => {
        if (menuButton && !menuButton.contains(event.target)) {
            closeMenu();
        }
        if (lastMoveBtn && !lastMoveBtn.contains(event.target)) {
            removeArrow();
        }
        if ((bookmarkBtn && !bookmarkBtn.contains(event.target))
            && bookmarksPanel && !bookmarksPanel.contains(event.target)) {

            closeBookmarkPanel();
        }

        if (currentEditingBookmark
            && event.target != currentEditingBookmark
            && event.target != currentEditingBookmark.parentElement
            && event.target != currentEditingBookmark.parentElement.parentElement
            && event.target != currentEditingBookmark.parentElement.parentElement.querySelector("#editBookmarkInput")

        ) {
            //console.log(event.target.id);
            exitEditBookmarkMode();
        }

    });

    document.addEventListener("contextmenu", event => {
        event.preventDefault();
    });

    document.addEventListener("keydown", OnKeyPressEventHandler);

    registerButtonEvents();
}

function registerButtonEvents() {

    const buttons = document.querySelectorAll(".button");
    for (const button of buttons) {
        button.removeEventListener("mousedown", onButtonMouseDown);
        button.removeEventListener("mouseup", onButtonMouseUp);
        button.removeEventListener("mouseleave", onButtonMouseUp);
        button.addEventListener("mousedown", onButtonMouseDown);
        button.addEventListener("mouseup", onButtonMouseUp);
        button.addEventListener("mouseleave", onButtonMouseUp);
    }

    const reviewButtons = document.querySelectorAll(".reviewButtons");
    for (const button of reviewButtons) {
        button.removeEventListener("mousedown", onReviewButtonMouseDown);
        button.removeEventListener("mouseup", onReviewButtonMouseUp);
        button.removeEventListener("mouseleave", onReviewButtonMouseUp);
        button.addEventListener("mousedown", onReviewButtonMouseDown);
        button.addEventListener("mouseup", onReviewButtonMouseUp);
        button.addEventListener("mouseleave", onReviewButtonMouseUp);
    }
}

function onButtonMouseDown(e) {
    if (e.target.classList.contains("btnDisabled")) { return; }
    e.target.classList.add("buttonPress");
}

function onButtonMouseUp(e) {
    e.target.classList.remove("buttonPress");
}

function onReviewButtonMouseDown(e) {
    if (e.target.classList.contains("btnDisabled")) { return; }
    e.target.classList.add("reviewButtonPress");
}

function onReviewButtonMouseUp(e) {
    e.target.classList.remove("reviewButtonPress");
}

function startDrag(e) {

    if (gameInfo.mode == "review") { return; }

    if (window.location.pathname != "/game") { return; }

    if (e.target.type != "textarea" && e.target.type != "text") {
        if (e.preventDefault) { e.preventDefault(); }
    }

    draggedImage = e.target;
    if (draggedImage.className != "draggable") { return; };

    if (gameType != "PracticeGame" &&
        currentPlayerIsWhite && draggedImage.src.indexOf("black") != -1 ||
        !currentPlayerIsWhite && draggedImage.src.indexOf("white") != -1) {
        return;
    }

    // if (game.GameOver) {
    //     return
    // }

    offsetX = e.clientX;
    offsetY = e.clientY;

    if (!draggedImage.style.left) {
        draggedImage.style.position = "relative";
        draggedImage.style.left = "0px";
    };
    if (!draggedImage.style.top) {
        draggedImage.style.position = "relative";
        draggedImage.style.top = "0px";
    };

    draggedImage.style.zIndex = "1";


    coordX = parseInt(draggedImage.style.left);
    coordY = parseInt(draggedImage.style.top);
    drag = true;
    sourcePosition = findPosition();
    document.onmousemove = onDragging;


    targetPosition = findPosition();

    if (gameInfo.showAvailableMoves !== false) {
        const options = game.possibleMoves(sourcePosition);
        for (const option of options) {
            guiBoard[option.target.row][option.target.col].classList.add("option");
        }
    }

    return false;

}

function onDragging(e) {

    if (!drag) {
        return;
    };
    //sconsole.log("onDragging")
    draggedImage.style.left = coordX + e.clientX - offsetX + "px";
    draggedImage.style.top = coordY + e.clientY - offsetY + "px";
    draggedImage.style.cursor = "grabbing";

    return false;
}

async function stopDrag() {
    if (!drag) {
        return;
    };

    draggedImage.style.cursor = "grab";
    drag = false;

    targetPosition = findPosition();
    const moved = await tryMove(sourcePosition, targetPosition);
    if (!moved) {
        movePieceOnBoardTo(sourcePosition);
    }

    document.onmousemove = null;
    resetSqaureColor();

}

async function tryMove(sourcePos, targetPos) {
    const moveObj = game.validateMove(sourcePos, targetPos, game.Turn);
    if (moveObj.valid) {
        const executed = game.makeMove(sourcePos, targetPos);
        lastMove = executed;
        switchClocks();
        if (gameType != "PracticeGame") {
            await sendMove(executed);
        } else {
            gameMoves.moves.push(executed);
            updateMovesTable(gameMoves.moves);
        }
        const state = game.GameState;
        if (state && state.board) {
            drawBoard(state.board);
            if (state.capturedPiecesList) {
                updateCaptureLists(state.capturedPiecesList);
            }
            if (gameInfo.mousePreference === "double") {
                applyMousePreference("double");
            }
        }
        if (gameType !== "PracticeGame") {
            gameMoves = await getGameMoves();
            updateMovesTable(gameMoves.moves);
        }
        return true;
    }
    return false;
}

function movePieceOnBoardTo(position) {

    const div = findSquareDivElement(position.row, position.col);
    if (div) {
        div.innerHTML = "";
        div.appendChild(draggedImage);
        draggedImage.style.left = "0px";
        draggedImage.style.top = "0px";
        draggedImage.style.zIndex = "0";
    }
}

function findPosition() {
    var left = draggedImage.getBoundingClientRect().x - chessboard.getBoundingClientRect().x;
    var top = draggedImage.getBoundingClientRect().y - chessboard.getBoundingClientRect().y;
    const totalWidth = chessboard.getBoundingClientRect().width;
    const totalHeight = chessboard.getBoundingClientRect().height;
    const SquareWidth = totalWidth / 8;
    const SquareHeight = totalHeight / 8;
    const col = Math.round((left / SquareWidth));
    const row = Math.round((top / SquareHeight));
    return { row: row, col: col };
}

/**
 *  Resets all GUI elements and starts a new game
 *
 
 * @example
 *
 *     startGame()
 */
function updateDebugGameId() {
    const el = document.getElementById("debugGameId");
    if (el) {
        const id = (typeof gameInfo !== "undefined" && gameInfo && gameInfo.id) ? gameInfo.id : "(none)";
        el.textContent = "Game ID: " + id;
    }
}

async function startGame(isRematch) {

    gameInfo = await getGameInfo(isRematch);
    updateDebugGameId();
    //console.log(gameInfo);
    gameType = gameInfo.gameType;
    currentPlayerIsWhite = gameInfo.username == gameInfo.whitePlayerName;

    registerGameEvents();
    resetAlerts();
    resetButtons();
    resetSqaureColor();
    resetChat();
    displayMessage("");


    const gameState = gameInfo.gameState;
    let isRejoined = false;
    if (gameState) {
        if (gameInfo.watcher) {
            currentPlayerIsWhite = true;
        } else {
            isRejoined = true;
        }

        game.loadGame(JSON.stringify(gameState));
        game.WhitePlayerView = currentPlayerIsWhite;
        gameMoves = await getGameMoves();
        updateMovesTable(gameMoves.moves);
        updateTimers(gameInfo);
        switchClocks();
        console.log("game loaded");
    }
    else {
        game.startNewGame(currentPlayerIsWhite);
        gameMoves = await getGameMoves();
        updateMovesTable(gameMoves.moves);
        resetClocks();
    }
    updateRowOrder();
    updateLegend();
    bookmarks = await getBookmarks();
    updateBookmarks(bookmarks);

    if (gameInfo.mode == "review") {
        if (gameInfo.reviewType == "pgn") { currentPlayerIsWhite = true; }
        game.startNewGame(currentPlayerIsWhite);
        if (!currentPlayerIsWhite) {
            clearArrows();
            updateRowOrder();
            updateLegend();
        }
        moveIndex = 0;
        const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
        blackPlayerInfoDiv.innerText = gameInfo.blackPlayerName;

        const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
        whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;

        disableButtons(["rematchBtn", "resignBtn", "drawBtn", "undoBtn", "redoBtn"]);
        hideButtons(["undoBtn", "redoBtn"]);
        enableButtons(["lastMoveBtn", "homeBtn"]);
        showMoveButtons(true);
    }
    else {
        switch (gameType) {
            case "PracticeGame":
                initPracticeGame(gameInfo, currentPlayerIsWhite);
                break;
            case "OnlineGame":
                initOnlineGame(gameInfo, currentPlayerIsWhite, isRematch, isRejoined, gameInfo.watcher);
                break;
            case "SinglePlayerGame":
                initSinglePlayerGame(gameInfo, currentPlayerIsWhite, isRematch);
                break;

            default:
                break;
        }
    }
}

function initPracticeGame(gameInfo) {
    const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
    const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
    whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;
    blackPlayerInfoDiv.innerText = gameInfo.blackPlayerName;

    disableButtons(["rematchBtn", "drawBtn"]);
    enableButtons(["resignBtn", "redoBtn", "undoBtn", "lastMoveBtn", "homeBtn"]);
    hideButtons(["drawBtn"]);
}

function initOnlineGame(gameInfo, currentPlayerIsWhite, isRematch, isRejoined, isWatcher) {
    if (!isRematch && gameInfo.mode != "review") {
        startWebSockets(gameInfo.username, currentPlayerIsWhite, isWatcher);
        if (currentPlayerIsWhite && !isRejoined && !isRematch && !isWatcher) { putCloak(); }
    }

    if (currentPlayerIsWhite) {
        const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
        whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;

        const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
        blackPlayerInfoDiv.innerText = (isRematch || isRejoined || isWatcher) ? gameInfo.blackPlayerName : "looking for opponent...";
        const opponentStatus = document.getElementById("blackPlayerStatus");
        opponentStatus.style.background = (isRematch || isRejoined || isWatcher) ? "var(--online-color)" : "var(--offline-color)";

        disableButtons(["redoBtn", "undoBtn", "rematchBtn", "resignBtn", "drawBtn", "lastMoveBtn"]);
        hideButtons(["undoBtn", "redoBtn"]);
        if (isRematch) {
            enableButtons(["resignBtn", "drawBtn", "lastMoveBtn", "homeBtn"]);
        }
    }
    else {
        const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
        blackPlayerInfoDiv.innerText = gameInfo.username;
        const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
        whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;

        disableButtons(["redoBtn", "undoBtn", "rematchBtn"]);
        enableButtons(["resignBtn", "drawBtn", "lastMoveBtn", "homeBtn"]);
        hideButtons(["undoBtn", "redoBtn"]);
    }


    // if (gameInfo.whiteTimer) {

    //     whiteTimer = gameInfo.whiteTimer;
    //     const whiteClock = document.getElementById("whiteClockTimeText");
    //     whiteClock.innerText = timerToText(whiteTimer);
    // }

    // if (gameInfo.blackTimer) {

    //     blackTimer = gameInfo.blackTimer;
    //     const blackClock = document.getElementById("blackClockTimeText");
    //     blackClock.innerText = timerToText(blackTimer);
    // }
}

function initSinglePlayerGame(gameInfo, currentPlayerIsWhite, isRematch) {
    if (!isRematch && gameInfo.mode != "review") {
        startWebSockets(gameInfo.username, currentPlayerIsWhite);
    }


    const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
    whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;

    const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
    blackPlayerInfoDiv.innerText = gameInfo.blackPlayerName;

    const opponentStatus = document.getElementById("blackPlayerStatus");
    opponentStatus.style.background = "var(--online-color)";

    disableButtons(["rematchBtn", "redoBtn", "undoBtn", "drawBtn"]);
    enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
    hideButtons(["undoBtn", "redoBtn"]);

    applyMousePreference(gameInfo.mousePreference);
}

function applyMousePreference(preference) {
    clickToMoveSelected = null;
    const innerBoard = document.getElementById("innerBoard");
    if (!innerBoard) { return; }
    innerBoard.removeEventListener("click", onBoardClickToMove);
    if (preference === "double") {
        const pieces = document.querySelectorAll("#innerBoard .square img");
        pieces.forEach(function (img) {
            const isOurPiece = currentPlayerIsWhite && img.src.indexOf("white") !== -1 ||
                !currentPlayerIsWhite && img.src.indexOf("black") !== -1;
            if (isOurPiece) {
                img.setAttribute("class", "nondraggable");
            }
        });
        innerBoard.addEventListener("click", onBoardClickToMove);
    }
}

function onBoardClickToMove(e) {
    if (gameInfo.mode === "review" || game.GameOver) { return; }
    if (gameType !== "SinglePlayerGame" && gameType !== "PracticeGame") { return; }
    const square = e.target.closest(".square");
    if (!square) { return; }
    const row = parseInt(square.getAttribute("data-row"), 10);
    const col = parseInt(square.getAttribute("data-col"), 10);
    if (isNaN(row) || isNaN(col)) { return; }
    const pos = { row: row, col: col };
    const pieceImg = square.querySelector("img");
    const isOurPiece = pieceImg && (
        (currentPlayerIsWhite && pieceImg.src.indexOf("white") !== -1) ||
        (!currentPlayerIsWhite && pieceImg.src.indexOf("black") !== -1)
    );
    if (!clickToMoveSelected) {
        if (isOurPiece && game.Turn === (currentPlayerIsWhite ? "white" : "black")) {
            clickToMoveSelected = pos;
            resetSqaureColor();
            square.classList.add("optionSquare");
            if (gameInfo.showAvailableMoves !== false) {
                const options = game.possibleMoves(pos);
                for (const option of options) {
                    guiBoard[option.target.row][option.target.col].classList.add("option");
                }
            }
        }
        return;
    }
    if (clickToMoveSelected.row === row && clickToMoveSelected.col === col) {
        clickToMoveSelected = null;
        resetSqaureColor();
        return;
    }
    if (isOurPiece) {
        clickToMoveSelected = pos;
        resetSqaureColor();
        square.classList.add("optionSquare");
        if (gameInfo.showAvailableMoves !== false) {
            const options = game.possibleMoves(pos);
            for (const option of options) {
                guiBoard[option.target.row][option.target.col].classList.add("option");
            }
        }
        return;
    }
    tryMove(clickToMoveSelected, pos).then(function (moved) {
        clickToMoveSelected = null;
        resetSqaureColor();
    });
}

/**
 *  Register to the game's event such as Check, Checkmate, Draw, Promotion, etc.
 *
 
 * @example
 *
 *     registerGameEvents()
 */
function registerGameEvents() {
    game.OnUpdate = onUpdateReceivedEventHandler;
    // game.OnCheck = checkEventHandler;
    // game.OnCheckmate = checkmateEventHandler;
    game.OnPromotion = promotionEventHandler;
    // game.OnDraw = drawEventHandler;
    game.OnUndo = undoEventHandler;
}

/**
 *  Creates the HTML DOM Elements that assemblies the Chess board.
 *
 
 * @example
 *
 *     createGUIBoard()
 */
function createGUIBoard() {
    const div = document.getElementById("chessboard");
    if (!div) { return; }
    div.innerHTML = "";
    const chessboard_horizontal_stack = document.createElement("div");
    chessboard_horizontal_stack.setAttribute("class", "chessboard_horizontal_stack");

    chessboard_horizontal_stack.appendChild(createSide());
    chessboard_horizontal_stack.appendChild(createBoard());
    chessboard_horizontal_stack.appendChild(createSide("right"));

    div.appendChild(chessboard_horizontal_stack);
    //div.appendChild(createPromotionBox())
    div.appendChild(createLoadGamePanel());


    const canvas = document.createElement("canvas");
    canvas.setAttribute("class", "arrowsCanvas");
    canvas.setAttribute("id", "arrowsCanvas");
    div.appendChild(canvas);

    chessboard = document.getElementById("innerBoard");
}

/**
 *  Draws the entire board.
 *
 *  @param {number[][]} board - A 2D Array with the board content to display.
 * 
 * @example
 *
 *     drawBoard(gameState.board);
 */
function drawBoard(board) {
    for (let i = 0; i < game.BOARD_ROWS; i++) {
        for (let j = 0; j < game.BOARD_COLUMNS; j++) {
            const div = findSquareDivElement(i, j);
            div.innerHTML = "";
            const piece = board[i][j];
            const url = getImageUrl(piece);
            if (url) {
                placePiece(url, i, j);
            }
        }
    }
}

/**
 *  Creates the HTML DOM Elements that assemblies the Chess board's side including the row numbers.
 *
 * @param {boolean} isRight - determines if the side is the right side. default is left
 * @return {HTMLDivElement} the div Element containing the side
 * @example
 *
 *     createSide(true)  // right
 * createSide(false) // left
 * createSide()      // left
 */
function createSide(isRight) {

    const whitePlayView = game ? game.WhitePlayerView : true;
    const right = (isRight) ? "right" : "";
    const leftside = document.createElement("div");
    leftside.setAttribute("class", "side_vertical_stack");

    const leftUpperCorner = document.createElement("div");
    leftUpperCorner.setAttribute("class", "frame corner");
    leftside.appendChild(leftUpperCorner);

    const leftSideLegend = document.createElement("div");
    leftSideLegend.setAttribute("class", "side_squares");


    for (let i = game.BOARD_ROWS; i > 0; i--) {
        const square = document.createElement("div");
        square.setAttribute("class", "frame square " + right);
        square.innerText = whitePlayView ? i : game.BOARD_ROWS - i + 1;
        square.setAttribute("id", "row" + square.innerText + right);
        leftSideLegend.appendChild(square);
    }

    leftside.appendChild(leftSideLegend);

    const leftBottomCorner = document.createElement("div");
    leftBottomCorner.setAttribute("class", "frame corner");
    leftside.appendChild(leftBottomCorner);
    return leftside;
}

/**
 *  Creates the HTML DOM Elements that assemblies the main Chess board including the top and bottom legends.
 *
 * @param {boolean} isWhitePlayerView - determines if the board should be set as a white player view or not
 * @return {HTMLDivElement} The div Element containing the main board part
 * @example
 *
 *     createBoard(true)  // White player View
 * createBoard(false) // Black Player View
 */
function createBoard(isWhitePlayerView) {

    const mainBoard = document.createElement("div");
    mainBoard.setAttribute("class", "chessboard_vertical_stack");

    const topLegend = createLegend(true);
    mainBoard.appendChild(topLegend);

    const squares = createSquares(isWhitePlayerView);
    mainBoard.appendChild(squares);

    const bottomLegend = createLegend(false);
    mainBoard.appendChild(bottomLegend);

    return mainBoard;
}

/**
 *  Creates the HTML DOM Elements that assemblies the legend of the main Chess board. 
 * The legend is the frame part that shows the columns letters at the top and bottom of the board.
 *
 * @param {boolean} isTop - Determines if the request is to create a top legend or a bottom legend.
 * @return {HTMLDivElement} The div Element containing a legend part
 * @example
 *
 *     createLegend(true)  // top
 * createLegend(false) // Bottom
 */
function createLegend(isTop) {
    const top = (isTop) ? "top" : "";
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const legendTop = document.createElement("div");
    legendTop.setAttribute("class", "frame legend " + top);
    for (let i = 0; i < game.BOARD_COLUMNS; i++) {
        const square = document.createElement("div");
        square.setAttribute("class", "frame square");
        square.innerText = letters[i];
        square.setAttribute("id", "col" + letters[i] + top);
        legendTop.appendChild(square);
    }
    return legendTop;
}

/**
 *  Creates the HTML DOM Elements that assemblies the squares of the main Chess board. 
 *
 * @return {HTMLDivElement} The div Element containing a squares part of the board
 * @example
 *
 *     createSquares()  
 */
function createSquares() {
    const squares = document.createElement("div");
    squares.setAttribute("class", "squares");
    squares.setAttribute("id", "innerBoard");

    for (let i = 0; i < game.BOARD_ROWS; i++) {
        for (let j = 0; j < game.BOARD_COLUMNS; j++) {
            const square = document.createElement("div");
            const className = `square ${((i + j) % 2) === 0 ? "white" : "black"}`;
            square.setAttribute("class", className);
            square.setAttribute("data-row", i);
            square.setAttribute("data-col", j);
            squares.appendChild(square);
            guiBoard[i][j] = square;
        }
    }
    return squares;
}

/**
 *  Finds and returns the div elelemt of a square at the requested position.
 *
 *  @param {number} row - The row of the square.
 *  @param {number} col - The column of the square.
 * 
 * @example
 *
 *     findSquareDivElement(0,0);
 */
function findSquareDivElement(row, col) {
    return guiBoard[row][col];
}

/**
 *  Gets the URL for the image of the request piece. 
 *
 *  @param {object} piece - The piece object containing the piece color and type.
 *  @return {string} The URL for the image of the request piece. Returns null if parameter is null.
 * 
 * @example
 *
 *     getImageUrl(piece);
 */
function getImageUrl(piece) {
    if (piece) { return (piece.color == "white") ? whitePiecesURL[piece.pieceType] : blackPiecesURL[piece.pieceType]; }
    return null;

}

/**
 *  Creating a piece GUI element and places it on the board. 
 *
 *  @param {string} url - The URL for the image of the request piece.
 *  @param {number} row - The row of the square.
 *  @param {number} col - The column of the square.
 * 
 * @example
 *
 *     placePiece(url, row, col);
 */
function placePiece(url, row, col) {

    guiBoard[row][col].appendChild(createPiece(url));
}

/**
 *  Creates a new HTML Image Element
 *
 *  @param {string} url - The URL for the image of the request piece.
 *  @return {HTMLImageElement} The created image
 * 
 * @example
 *
 *     createPiece(url);
 */
function createPiece(url) {
    const img = document.createElement("img");
    img.setAttribute("src", url);
    // img.setAttribute("width", 100) // default size.
    img.setAttribute("class", "draggable");

    if (gameType != "PracticeGame") {
        if (currentPlayerIsWhite && img.src.indexOf("black") != -1 ||
            !currentPlayerIsWhite && img.src.indexOf("white") != -1) {
            img.setAttribute("class", "nondraggable");
        }
    }
    if (gameInfo.mode == "review") { img.setAttribute("class", "nondraggable"); }

    return img;
}

/**
 *  Update the box with the captured pieces
 *
 *  @param {Array} captured - The list of captured pieces
 * 
 * @example
 *
 *     updateCaptureLists(captured);
 */
function updateCaptureLists(captured) {
    const divWhite = document.getElementById("whiteCapturedPiece");
    const divBlack = document.getElementById("blackCapturedPiece");

    divWhite.innerHTML = "";
    divBlack.innerHTML = "";

    for (let i = 0; i < captured.length; i++) {
        const element = captured[i];
        if (element.color == "white") {
            addPiecesImages(divWhite, element);
        }
        else {
            addPiecesImages(divBlack, element);
        }
    }
}

/**
 *  Adds a piece to the captured pieces box
 *
 *  @param {HTMLDivElement} div - The div element contianing the captured pieces
 *  @param {object} pieceObj - The pieces to add
 * 
 * @example
 *
 *     addPiecesImages(divWhite, element);
 */
function addPiecesImages(div, pieceObj) {
    const img = document.createElement("img");
    const url = getImageUrl(pieceObj);
    img.setAttribute("src", url);
    img.setAttribute("class", "draggable captured");
    div.appendChild(img);
}

function updateRowOrder() {
    for (let i = game.BOARD_ROWS; i > 0; i--) {
        const rightLegendSquare = document.getElementById("row" + i + "right");
        const leftLegendSquare = document.getElementById("row" + i);
        rightLegendSquare.innerText = game.WhitePlayerView ? i : game.BOARD_ROWS - i + 1;
        leftLegendSquare.innerText = game.WhitePlayerView ? i : game.BOARD_ROWS - i + 1;
    }
}

function updateLegend() {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    for (let i = 0; i < game.BOARD_COLUMNS; i++) {
        const topLegendSquare = document.getElementById("col" + letters[i] + "top");
        const bottomLegendSquare = document.getElementById("col" + letters[i]);
        topLegendSquare.innerText = game.WhitePlayerView ? letters[i] : letters[game.BOARD_COLUMNS - i - 1];
        bottomLegendSquare.innerText = game.WhitePlayerView ? letters[i] : letters[game.BOARD_COLUMNS - i - 1];
    }
}

/**
 *  Resets the speacial events alerts, such as Check, CheckMate or Draw 
 *
 * @example
 *
 *     resetAlerts()  
 */
function resetAlerts() {
    const frame = document.getElementsByClassName("frame");
    for (const el of frame) {
        el.classList.remove("checkAlert");
        el.classList.remove("checkmateAlert");
        el.classList.remove("drawAlert");
    }
}

function resetButtons() {
    const buttons = document.getElementsByClassName("button");
    enableButtons([...buttons]);
    // for (const button of buttons) {

    //     button.classList.remove("btnDisabled");
    // }
    disableButtons(["rematchBtn"]);
    //document.getElementById("rematchBtn").classList.add("btnDisabled");
}

function resetClocks() {
    clearInterval(whiteHandle);
    clearInterval(blackHandle);
    blackTimer = 90 * 60;
    whiteTimer = 90 * 60;
    const whiteClock = document.getElementById("whiteClockTimeText");
    whiteClock.innerText = timerToText(whiteTimer);
    const blackClock = document.getElementById("blackClockTimeText");
    blackClock.innerText = timerToText(blackTimer);

}

/**
 *  Resets the colors of the squares to the default 
 *
 * @example
 *
 *     resetSqaureColor()  
 */
function resetSqaureColor() {
    if (guiBoard[0][0] == null) { return; }
    for (let i = 0; i < game.BOARD_ROWS; i++) {
        for (let j = 0; j < game.BOARD_COLUMNS; j++) {
            const className = `square ${((i + j) % 2) === 0 ? "white" : "black"}`;
            guiBoard[i][j].setAttribute("class", className);
        }
    }
}

/// Cloak

function createCloak() {
    const cloakDiv = document.createElement("div");
    cloakDiv.setAttribute("class", "cloak");
    cloakDiv.setAttribute("id", "cloak");
    return cloakDiv;
}

function putCloak() {
    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = createCloak();
    chessboardDiv.appendChild(cloakDiv);
    cloakDiv.style.visibility = "visible";
    cloakDiv.style.opacity = "1";
}

function removeCloak() {
    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = document.getElementById("cloak");
    if (cloakDiv) {
        cloakDiv.style.visibility = "hidden";
        cloakDiv.style.opacity = "0";
        chessboardDiv.removeChild(cloakDiv);
    }
}

/// Promotion


async function promotionEventHandler(turn) {

    if (gameInfo.mode == "review") { return; }

    const opponenetMove = (currentPlayerIsWhite && turn == "black") ||
        (!currentPlayerIsWhite && turn == "white");

    if (gameType == "SinglePlayerGame" && opponenetMove) { return; }

    if (gameType == "OnlineGame" && opponenetMove) { return; }

    // if (gameType == 'SinglePlayerGame' && !humanMove)
    //     return // no need to show promotion dialog if promotion happaned for other non human player on server

    if (autoCompletePromotion) { return; }

    return new Promise((resolve) => {

        displayMessage("Promotion!");
        log("System", "Promotion");
        promotingMode = true;
        dialogOn = true;
        showPromotionDialog((selectedPiece) => {
            lastMove.selectedPiece = selectedPiece;
            game.completePromotion(lastMove);
            if (gameType == "OnlineGame" || gameType == "SinglePlayerGame") {
                sendMove(lastMove);
            }
            console.log("promotion completed:");
            // console.log(lastMove);
            promotingMode = false;
            resolve();
        });
    });
}

function promotionSelected(e) {
    const selectedPiece = parseInt(e.target.alt);
    //console.log(game.pieceName(selectedPiece));
    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = document.getElementById("cloak");
    const promotionSelectionBox = document.getElementById("promotionSelectionBox");
    cloakDiv.removeChild(promotionSelectionBox);
    chessboardDiv.removeChild(cloakDiv);
    dialogOn = false;
    displayMessage("");
    promotionCallback(selectedPiece);
}

function showPromotionDialog(callback) {

    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = createCloak();
    const promotionBox = createPromotionBox();
    cloakDiv.appendChild(promotionBox);
    chessboardDiv.appendChild(cloakDiv);

    cloakDiv.style.visibility = "visible";
    cloakDiv.style.opacity = "1";
    promotionCallback = callback;
}

/**
 *  Creates the HTML DOM Element that assemblies the promotion dialog pop ups when a pawn promotes, allowing the user to pick a piece (queen, rook, bishop, or knight). 
 *
 * @return {HTMLDivElement} The div Element containing the promotion dialog
 * @example
 *
 *     createPromotionBox()  
 */
function createPromotionBox() {


    const promotionDivSelection = document.createElement("div");
    promotionDivSelection.setAttribute("class", "promotionSelectionBox");
    promotionDivSelection.setAttribute("id", "promotionSelectionBox");
    for (let i = game.KNIGHT; i <= game.QUEEN; i++) {
        const piece = createPiece(whitePiecesURL[i]);
        piece.setAttribute("class", "promotionPiece");
        piece.setAttribute("alt", i);
        piece.onclick = promotionSelected;
        promotionDivSelection.appendChild(piece);
    }

    // cloakDiv.appendChild(promotionDivSelection);
    return promotionDivSelection;
}

/**
 *  Displays a flash message to the user on special events.
 * An Empty string, clears the message
 *
 *  @param {string} message - The message to show to the user.
 * 
 * @example
 *
 *     displayMessage("Check!")  
 * displayMessage("")  
 */
function displayMessage(message) {

    const existing = document.getElementById("flash");
    if (existing) {
        document.body.removeChild(existing);
    }

    if (message) {
        const div = document.createElement("div");
        div.classList.add("topbarMessages");
        div.classList.add("flash-message");
        div.innerHTML = message;
        div.id = "flash";
        document.body.appendChild(div);
    }
}

/// MessageBox

function createMessageBox(text, yesCallback, noCallback) {
    const messageBoxPanel = document.createElement("div");
    messageBoxPanel.setAttribute("class", "messageBoxPanel");
    messageBoxPanel.setAttribute("id", "messageBoxPanel");

    const messageBoxText = document.createElement("div");
    messageBoxText.innerText = text;
    messageBoxText.setAttribute("class", "messageBoxText");
    messageBoxText.setAttribute("id", "messageBoxText");
    messageBoxPanel.appendChild(messageBoxText);

    const buttonsArea = document.createElement("div");
    buttonsArea.setAttribute("class", "loadGameButtons");
    buttonsArea.setAttribute("id", "loadGameButtons");

    const yesButton = document.createElement("button");
    yesButton.setAttribute("class", "button");
    yesButton.setAttribute("id", "yesButton");
    yesButton.innerText = Labels.YES;
    yesButton.addEventListener("click", () => { hideMessageBox(); yesCallback(); }, { once: true });
    buttonsArea.appendChild(yesButton);

    const noButton = document.createElement("button");
    noButton.setAttribute("class", "button");
    noButton.setAttribute("id", "noButton");
    noButton.innerText = Labels.NO;
    noButton.addEventListener("click", () => { hideMessageBox(); noCallback(); }, { once: true });
    buttonsArea.appendChild(noButton);
    messageBoxPanel.appendChild(buttonsArea);
    return messageBoxPanel;
}

function hideMessageBox() {

    const messageBoxPanel = document.getElementById("messageBoxPanel");
    if (messageBoxPanel) {
        const chessboardDiv = document.getElementById("chessboard");
        messageBoxPanel.classList.add("hide");
        const cloakDiv = document.getElementById("cloak");
        if (cloakDiv) {
            cloakDiv.style.visibility = "hidden";
            cloakDiv.style.opacity = "0";
            chessboardDiv.removeChild(cloakDiv);
            chessboardDiv.removeChild(messageBoxPanel);
        }
        // enableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
        restoreButtonsState();


        dialogOn = false;
    }
}

function messageBox(text, yesCallback, noCallback) {

    dialogOn = true;
    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = createCloak();
    chessboardDiv.appendChild(cloakDiv);
    cloakDiv.style.visibility = "visible";
    cloakDiv.style.opacity = "1";
    chessboardDiv.appendChild(createMessageBox(text, yesCallback, noCallback));
    registerButtonEvents();
    saveButtonsState();
    disableButtons(["rematchBtn", "resignBtn", "drawBtn", "redoBtn", "undoBtn", "lastMoveBtn", "homeBtn", "bookmarkBtn"]);
}

// Game Event Handlers

/**
 *  An event handler triggered when the game needs to update on a new state in the game 
 *
 *  @param {object} gameState - The message to show to the user.
 * 
 * @example
 *
 *     onUpdateReceivedEventHandler(state)  
 */
async function onUpdateReceivedEventHandler(gameState) {
    drag = false;
    const { board, capturedPiecesList } = gameState;
    drawBoard(board);
    if (gameInfo.mousePreference === "double") {
        applyMousePreference("double");
    }
    updateCaptureLists(capturedPiecesList);

    if (gameInfo.mode != "review") {
        if (gameInfo.gameType != "PracticeGame") {
            gameMoves = await getGameMoves();
        }
        updateMovesTable(gameMoves.moves);
        moveIndex = gameMoves.moves.length;
        const turnStr = "td_move" + moveIndex;
        const td = document.getElementById(turnStr);
        if (td) {
            scrollMoveCellIntoView(td);
        }

    }
    // displayAlgebricNotation(algebricNotation)

    if (gameState.checkmate) {
        await checkmateEventHandler(game.Turn);
    } else if (gameState.check) {
        await checkEventHandler(game.Turn);
    }

    if (gameState.draw) {
        await drawEventHandler(game.DrawReason);
    }

    //we were in check but not anymore
    if (alertMode && !gameState.check && !gameState.checkmate && !gameState.draw) {

        alertMode = false;
        resetAlerts();
        displayMessage("");
    }
    if (game.GameOver) {
        //document.getElementById("rematchBtn").classList.remove("btnDisabled");
        enableButtons(["rematchBtn"]);
        gameMoves = await getGameMoves();
        updateMovesTable(gameMoves.moves);
    }
}

function checkEventHandler(turn) {
    alertMode = true;
    console.log(`Check! ${game.colorName(turn)} under attack`);
    displayMessage("Check");
    const playerName = game.colorName(turn) == "Black" ? gameInfo.whitePlayerName : gameInfo.blackPlayerName;
    log(playerName, "Check!");
    const frame = document.getElementsByClassName("frame");
    for (const el of frame) { el.classList.add("checkAlert"); }
}

async function checkmateEventHandler(turn) {
    alertMode = true;
    displayMessage(`Checkmate! ${game.opponent(game.colorName(turn))} wins!`);
    const playerName = game.colorName(turn) == "Black" ? gameInfo.whitePlayerName : gameInfo.blackPlayerName;
    log(playerName, "Checkmate!");
    const frame = document.getElementsByClassName("frame");
    for (const el of frame) {
        el.classList.remove("checkAlert");
        el.classList.add("checkmateAlert");
    }
    window.clearInterval(whiteHandle);
    window.clearInterval(blackHandle);
    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
    //document.getElementById("rematchBtn").classList.remove("btnDisabled");
    enableButtons(["rematchBtn"]);
    if (gameInfo.gameType != "PracticeGame") {
        gameMoves = await getGameMoves();
    }
    updateMovesTable(gameMoves.moves);
}

async function drawEventHandler(reason) {
    clearInterval(whiteHandle);
    clearInterval(blackHandle);
    alertMode = true;
    displayMessage(`Draw! ${reason}`);
    log("System", "Draw");
    const frame = document.getElementsByClassName("frame");
    for (const el of frame) { el.classList.add("drawAlert"); }
    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
    //document.getElementById("rematchBtn").classList.remove("btnDisabled");
    enableButtons(["rematchBtn"]);
    gameMoves = await getGameMoves();
    updateMovesTable(gameMoves.moves);
}

function undoEventHandler(moves) {
    animating = true;
    const speed = 50;
    const move = moves[moves.length - 1];
    if (move) {
        clearArrows();

        const divMoveTarget = findSquareDivElement(move.target.row, move.target.col);
        const img = divMoveTarget.childNodes[0];
        if (!img) {
            animating = false;
            game.forceUpdate();
            return;

        }
        console.log(divMoveTarget.style.width);
        const squareWidth = divMoveTarget.offsetWidth;
        const squareHeight = divMoveTarget.offsetWidth;
        const horizontalDistance = (move.source.col - move.target.col) * squareWidth;
        const verticallDistance = (move.source.row - move.target.row) * squareHeight;
        const verticalSteps = verticallDistance / speed;
        const horizontalSteps = horizontalDistance / speed;

        let left = 0;
        let top = 0;

        img.style.zIndex = "2";
        img.style.position = "absolute";

        const interval = setInterval(() => {
            left += horizontalSteps;
            top += verticalSteps;
            img.style.marginLeft = left + "px";
            img.style.marginTop = top + "px";

            if (Math.abs(left - horizontalDistance * 2) < 1
                && Math.abs(top - verticallDistance * 2) < 1) {
                clearInterval(interval);
                img.style.position = "relative";
                img.style.marginLeft = "0px";
                img.style.marginTop = "0px";
                animating = false;
                game.forceUpdate();
            }
        }
            , 2);
    }
    else { animating = false; console.log("error"); }
}

/**
 * Scroll the moves panel so the given cell is visible. Does not scroll the document.
 */
function scrollMoveCellIntoView(td) {
    if (!td) { return; }
    const movesDiv = document.getElementById("movesDiv");
    if (!movesDiv) { return; }
    const row = td.closest("tr");
    if (!row) { return; }
    const rowTop = row.offsetTop;
    const rowHeight = row.offsetHeight;
    const containerHeight = movesDiv.clientHeight;
    const scrollBottom = movesDiv.scrollTop + containerHeight;
    if (rowTop < movesDiv.scrollTop || rowTop + rowHeight > scrollBottom) {
        movesDiv.scrollTop = Math.max(0, rowTop - Math.floor(containerHeight / 2) + Math.floor(rowHeight / 2));
    }
}

function updateMovesTable(moves) {

    const movesDiv = document.getElementById("movesDiv");
    movesDiv.innerHTML = "";
    const table = document.createElement("table");
    table.classList.add("movesTable");

    for (let i = 0; i < moves.length; i += 2) {
        const whiteMove = moves[i];
        const blackMove = ((i + 1) < moves.length) ? moves[i + 1] : { moveStr: "" };
        const tr = document.createElement("tr");
        const td_num = document.createElement("td");
        td_num.innerHTML = (i / 2) + 1;
        td_num.classList.add("tdNum");
        const td_white = document.createElement("td");
        td_white.innerHTML = whiteMove.moveStr;
        td_white.id = "td_move" + (i + 1);
        td_white.classList.add("tdMove");
        td_white.onclick = loadMove;
        td_num.onclick = loadMove;
        const td_black = document.createElement("td");
        td_black.id = "td_move" + (i + 2);
        td_black.classList.add("tdMove");
        td_white.onclick = loadMove;
        td_black.innerHTML = blackMove ? blackMove.moveStr : "";
        td_black.onclick = loadMove;
        tr.appendChild(td_num);
        tr.appendChild(td_white);
        tr.appendChild(td_black);
        table.appendChild(tr);
    }
    movesDiv.appendChild(table);

}

async function animateMove(move) {

    return new Promise((resolve, reject) => {
        animating = true;
        const speed = 20;

        if (move) {
            clearArrows();

            const divMoveTarget = findSquareDivElement(move.source.row, move.source.col);
            const img = divMoveTarget.childNodes[0];
            if (!img) {
                game.forceUpdate();
                animating = false;
                reject();
                return;

            }
            const squareWidth = divMoveTarget.offsetWidth;
            const squareHeight = divMoveTarget.offsetWidth;
            const horizontalDistance = (move.target.col - move.source.col) * squareWidth;
            const verticallDistance = (move.target.row - move.source.row) * squareHeight;
            const verticalSteps = verticallDistance / speed;
            const horizontalSteps = horizontalDistance / speed;

            let left = 0;
            let top = 0;

            img.style.zIndex = "2";
            img.style.position = "absolute";

            const interval = setInterval(() => {
                left += horizontalSteps;
                top += verticalSteps;
                img.style.marginLeft = left + "px";
                img.style.marginTop = top + "px";

                if (Math.abs(left - horizontalDistance * 2) < 1
                    && Math.abs(top - verticallDistance * 2) < 1) {
                    clearInterval(interval);
                    img.style.position = "relative";
                    img.style.marginLeft = "0px";
                    img.style.marginTop = "0px";
                    game.forceUpdate();
                    animating = false;
                    resolve();
                }
            }
                , 2);
        }
        else {
            animating = false;
            reject("error");
        }
    });
}


function closeMenu() {

    const mainMenu = document.getElementById("mainMenu");

    if (mainMenu.style.visibility != "hidden") {
        mainMenu.style.visibility = "hidden";
        mainMenu.style.opacity = "0";
    }
}

/// Last Move Arrow

function viewLastMove() {


    if (isButtonDisabled("lastMoveBtn")) { return; }


    const moves = game.Moves;
    if (moves.length == 0) {
        return;
    }
    const lastMove = moves[moves.length - 1];

    const canvas = document.getElementById("arrowsCanvas");
    if (canvas.style.visibility == "visible") {
        clearArrows();
        return;
    }
    const divMoveTarget = findSquareDivElement(lastMove.target.row, lastMove.target.col);
    const squareWidth = divMoveTarget.offsetWidth;

    canvas.style.visibility = "visible";
    chessboard = document.getElementById("innerBoard");
    canvas.setAttribute("width", chessboard.offsetWidth);
    canvas.setAttribute("height", chessboard.offsetWidth);
    const ctx = canvas.getContext("2d");
    let x1, y1, x2, y2;
    if (lastMove.whitePlayerView == game.WhitePlayerView) {
        x1 = lastMove.source.col * squareWidth + squareWidth / 2;
        y1 = lastMove.source.row * squareWidth + squareWidth / 2;
        x2 = lastMove.target.col * squareWidth + squareWidth / 2;
        y2 = lastMove.target.row * squareWidth + squareWidth / 2;
    }
    else {
        x1 = (game.BOARD_COLUMNS - lastMove.source.col - 1) * squareWidth + squareWidth / 2;
        y1 = (game.BOARD_ROWS - lastMove.source.row - 1) * squareWidth + squareWidth / 2;
        x2 = (game.BOARD_COLUMNS - lastMove.target.col - 1) * squareWidth + squareWidth / 2;
        y2 = (game.BOARD_ROWS - lastMove.target.row - 1) * squareWidth + squareWidth / 2;
    }
    drawArrow(ctx, x1, y1, x2, y2, chessboard.offsetWidth / 40, "#33a033");
}

function removeArrow() {
    const canvas = document.getElementById("arrowsCanvas");
    canvas.style.visibility = "hidden";
}

function drawArrow(ctx, fromx, fromy, tox, toy, arrowWidth, color) {
    //variables to be used when creating the arrow
    var headlen = arrowWidth / 2;
    var angle = Math.atan2(toy - fromy, tox - fromx);

    ctx.save();
    ctx.strokeStyle = color;

    //starting path of the arrow from the start square to the end square
    //and drawing the stroke
    ctx.beginPath();
    ctx.moveTo(fromx, fromy);
    ctx.lineTo(tox, toy);
    ctx.lineWidth = arrowWidth;
    ctx.stroke();

    //starting a new path from the head of the arrow to one of the sides of
    //the point
    ctx.beginPath();
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6),
        toy - headlen * Math.sin(angle - Math.PI / 6));

    //path from the side point of the arrow, to the other side point
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6),
        toy - headlen * Math.sin(angle + Math.PI / 6));

    //path from the side point back to the tip of the arrow, and then
    //again to the opposite side point
    ctx.lineTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6),
        toy - headlen * Math.sin(angle - Math.PI / 6));

    //draws the paths created above
    ctx.stroke();
    ctx.restore();

}

function clearArrows() {
    const canvas = document.getElementById("arrowsCanvas");
    if (!canvas) { return; }
    canvas.style.visibility = "hidden";
}

function closeDialogs() {
    const clearArrows = document.getElementById("loadGamePanel");
    clearArrows.style.visibility = "hidden";

    const cloak = document.getElementById("cloak");
    if (cloak) {
        cloak.style.visibility = "hidden";
        cloak.style.opacity = "0";
    }
    dialogOn = false;
}

function OnKeyPressEventHandler(event) {

    if (event.target.id == "chatline") {
        if (event.key === "Enter") {
            sendChatMessage(event.target.value);
        }
        return;
    }

    if (event.key === "Escape") {
        clearArrows();
        closeDialogs();
    }

    if (dialogOn) { return; }

    if (event.key.toLowerCase() == "z" && event.ctrlKey) {
        menuUndo();
    }
    if (event.key.toLowerCase() == "u" && event.ctrlKey) {
        game.forceUpdate();
    }
    if (event.key.toLowerCase() == "b" && event.ctrlKey) {
        flipboard();
    }
    if (event.key.toLowerCase() == "w" && event.ctrlKey) {
        game.WhitePlayerView = true;
        clearArrows();
        updateRowOrder();
        updateLegend();
    }
    if (event.key.toLowerCase() == "f" && event.ctrlKey) {
        game.WhitePlayerView = !game.WhitePlayerView;
        clearArrows();
        updateRowOrder();
        updateLegend();
    }

    if (event.key.toLowerCase() == "n" && event.ctrlKey) {
        // gameType = 2
        startGame();
    }


    if (event.key.toLowerCase() == "c" && event.ctrlKey) {
        //    gameType = 1 //
        startGame();
    }


    if (event.key.toLowerCase() == "v" && !event.ctrlKey) {
        viewLastMove();
    }

    if (event.key == "F3") {
        menuLoadEventHandler();
    }

    if (event.key == "F2") {
        menuSaveEventHandler();
    }
}

function flipboard() {
    game.WhitePlayerView = !game.WhitePlayerView;
    clearArrows();
    updateRowOrder();
    updateLegend();
}

function menuLoadEventHandler() {
    showLoadGameDialog();
}

/// Web Sockets and comminications

function startWebSockets(username, isWhite, isWatcher) {
    console.log("starting web sockets");
    // Use same protocol (ws/wss) and host as the current page, connect to /ws route
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const connection = `${protocol}//${window.location.host}/ws`;
    webSocket = new WebSocket(connection, "protocolOne");


    webSocket.onopen = async () => {
        console.log("connection opened");
        const gameConnectData = {
            username: username, isWhite: isWhite,
            gameId: gameInfo.id, creatorId: gameInfo.creatorId, userId: gameInfo.userId
        };
        const message = {
            type: isWatcher ? "watch" : "connection",
            data: gameConnectData
        };
        await sendMessage(message);
    };

    webSocket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        if (message.type == "move") {
            if (game.GameOver) {
                gameMoves = await getGameMoves();
                updateMovesTable(gameMoves.moves);
                return;
            }
            const move = message.data;
            let moveObj;


            if (move.promotion) {
                if (!move.selectedPiece) {
                    return;
                }
                else {
                    await animateMove(move);
                    moveObj = game.makeMove(move.source, move.target);
                    game.completePromotion(move);
                }
            }
            else {
                await animateMove(move);
                moveObj = game.makeMove(move.source, move.target);
            }

            lastMove = moveObj;
            moveAccepted(move);
            switchClocks();
        };

        if (message.type == "info") {
            const info = message.info;
            if (info == "game over") {
                displayMessage("Game Over");
                log("System", "Game Over");
                enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
                disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                gameMoves = await getGameMoves();
                updateMovesTable(gameMoves.moves);
            }

            if (info == "Opponenet left the game") {
                const player = currentPlayerIsWhite ? "White" : "Black";
                //displayMessage(`The opponent left,  ${player} wins`);
                game.resign(player);
                hideMessageBox();
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
            }

            if (info == "Opponent disconnected") {
                displayMessage("The opponent disconnected");
                log("System", "The opponent disconnected");
                const opponentStatus = currentPlayerIsWhite ?
                    document.getElementById("blackPlayerStatus") :
                    document.getElementById("whitePlayerStatus");
                opponentStatus.style.background = "var(--error-color)";
                hideMessageBox();
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
                startDisconnectionTimer();
            }

            if (info == "Opponent failed to reconnect") {
                displayMessage(UserMessages.OPPONENT_RECONNCETION_FAILED);

                const opponentStatus = currentPlayerIsWhite ?
                    document.getElementById("blackPlayerStatus") :
                    document.getElementById("whitePlayerStatus");
                opponentStatus.style.background = "var(--offline-color)";
                const player = currentPlayerIsWhite ? "White" : "Black";
                game.resign(player);
            }


            if (info == "Opponent resigned") {
                const player = currentPlayerIsWhite ? "White" : "Black";
                displayMessage(`The opponent resigned, ${player} wins `);
                const playerName = !currentPlayerIsWhite ? gameInfo.whitePlayerName : gameInfo.blackPlayerName;
                log(playerName, "I resign!");
                hideMessageBox();
                game.resign(player);
                disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
                gameMoves = await getGameMoves();
                updateMovesTable(gameMoves.moves);

            }

            if (info == "move validation failed") {
                const player = currentPlayerIsWhite ? "White" : "Black";
                displayMessage("Something went wrong");
                log("Server", "Something went wrong");
                hideMessageBox();
                game.resign(player);
                disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
                gameMoves = await getGameMoves();
                updateMovesTable(gameMoves.moves);
            }

            if (info == "opponent joined") {
                //displayMessage(`An opponent joined`);
                const opponentStatus = currentPlayerIsWhite ?
                    document.getElementById("blackPlayerStatus") :
                    document.getElementById("whitePlayerStatus");
                opponentStatus.style.background = "var(--online-color)";

                const opponentName = currentPlayerIsWhite ?
                    document.getElementById("blackPlayerName") :
                    document.getElementById("whitePlayerName");
                opponentName.innerText = message.data;

                removeCloak();
                enableButtons(["resignBtn", "drawBtn", "lastMoveBtn", "homeBtn"]);

            }

            if (info == "opponent rejoined") {
                displayMessage("The opponent rejoined");
                log("System", "The opponent rejoined");
                const opponentStatus = currentPlayerIsWhite ?
                    document.getElementById("blackPlayerStatus") :
                    document.getElementById("whitePlayerStatus");
                opponentStatus.style.background = "var(--online-color)";
                rejoined = true;
                switchClocks();
            }

            if (info == "offer rematch") {
                displayMessage("");
                if (gameInfo.gameType == "OnlineGame") {
                    messageBox("Opponenet offer a rematch, agree?", acceptRematch, declineRematch);
                } else if (gameInfo.gameType == "SinglePlayerGame") {
                    if (typeof gameInfo !== "undefined" && gameInfo) {
                        window.__LAST_GAME_OPTIONS__ = {
                            color: currentPlayerIsWhite ? "white" : "black",
                            engine: gameInfo.engine || "brain4",
                            difficulty: gameInfo.difficulty != null ? gameInfo.difficulty : 3,
                            mouse: gameInfo.mousePreference || "drag",
                            showAvailableMoves: gameInfo.showAvailableMoves !== false
                        };
                    }
                    if (typeof openPlayNowModal === "function") {
                        openPlayNowModal();
                    }
                }
            }

            if (info == "rematch accepted") {


                // Online
                if (gameInfo.gameType == "OnlineGame") {
                    displayMessage("Rematch offer accepted");
                    log("System", "Rematch offer accepted");
                    enableButtons(["resignBtn", "drawBtn", "lastMoveBtn", "homeBtn"]);
                    disableButtons(["rematchBtn"]);
                }
                else if (gameInfo.gameType == "SinglePlayerGame") {
                    enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
                }

                console.log("rematch accepted. Chaging game ID from:" + gameInfo.id + " to: " + message.gameId);
                gameInfo.id = message.gameId; // update with the new game id
                await setRematchGameId(gameInfo.id);
                startGame(true);


            }

            if (info == "rematch declined") {
                if (gameInfo.gameType == "OnlineGame") {
                    displayMessage("Rematch offer declined");
                    log("System", "Rematch offer declined");
                }
                disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                //document.getElementById("rematchBtn").classList.remove("btnDisabled");                
                enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
            }

            if (info == "offer draw") {
                displayMessage("");
                messageBox("Opponent sent a draw offer, accept?", acceptDraw, declineDraw);
            }

            if (info == "draw accepted") {

                const offerBy = message.isWhite ? "black" : "white";
                displayMessage("Draw offer accepted");
                log("System", "Draw offer accepted");
                game.drawOfferAccepted(offerBy);
                disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);


                gameMoves = await getGameMoves();
                updateMovesTable(gameMoves.moves);
            }

            if (info == "draw declined") {
                displayMessage("Draw offer declined");
                log("System", "Draw offer declined");
                enableButtons(["resignBtn", "drawBtn", "lastMoveBtn", "homeBtn"]);
            }

            if (info == "new watcher") {
                const watcherName = message.data;
                displayMessage(watcherName + " is watching the game");
                disableButtons(["rematchBtn", "resignBtn", "redoBtn", "undoBtn", "drawBtn", "bookmarkBtn"]);
            }

            if (info == "chat") {
                log(message.username, message.data, true);
            }
        }

        if (message.type == "cmd") {
            const info = message.data;
            if (info == "undo") {
                game.undo();
            }
        }
    };

}

async function declineDraw() {
    if (gameInfo.gameType == "SinglePlayerGame" || gameInfo.gameType == "OnlineGame") {
        const message = {
            type: "info",
            info: "draw declined",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite

        };
        await sendMessage(message);
    }

    displayMessage("Draw offer declined");
    log("System", "Draw offer declined");
    enableButtons(["resignBtn", "drawBtn", "lastMoveBtn", "homeBtn"]);

}

async function declineRematch() {

    if (gameInfo.gameType == "SinglePlayerGame" || gameInfo.gameType == "OnlineGame") {
        const message = {
            type: "info",
            info: "rematch declined",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite
        };
        await sendMessage(message);
    }
}

async function moveAccepted(move) {
    if (gameInfo.gameType == "SinglePlayerGame") {
        const message = {
            type: "info",
            info: "move accepted",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite,
            moveTime: currentPlayerIsWhite ? whiteTimer : blackTimer,
            moveStr: move.moveStr,

        };
        await sendMessage(message);
    }
}

async function acceptRematch() {
    if (gameInfo.gameType == "SinglePlayerGame" || gameInfo.gameType == "OnlineGame") {
        const message = {
            type: "info",
            info: "rematch accepted",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite

        };
        await sendMessage(message);
        enableButtons(["resignBtn", "drawBtn", "lastMoveBtn", "homeBtn"]);
        disableButtons(["rematchBtn"]);
    }
}

async function acceptDraw() {
    if (gameInfo.gameType == "SinglePlayerGame" || gameInfo.gameType == "OnlineGame") {
        const message = {
            type: "info",
            info: "draw accepted",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite

        };
        await sendMessage(message);
        disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
        enableButtons(["lastMoveBtn", "homeBtn"]);

    }

    const offerBy = currentPlayerIsWhite ? "black" : "white";

    displayMessage("Draw offer accepted");
    game.drawOfferAccepted(offerBy);

    gameMoves = await getGameMoves();
    updateMovesTable(gameMoves.moves);

    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
    enableButtons(["rematchBtn"]);
    //document.getElementById("rematchBtn").classList.remove("btnDisabled");
}

async function offerDraw() {
    if (gameInfo.gameType == "SinglePlayerGame" || gameInfo.gameType == "OnlineGame") {
        const message = {
            type: "info",
            info: "offer draw",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite

        };
        await sendMessage(message);

        displayMessage("Draw offer sent");
        log("System", "Draw offer sent");
        disableButtons(["drawBtn"]);
    }
}

function offerCanceled() {
    displayMessage("");
    enableButtons(["resignBtn", "drawBtn", "lastMoveBtn", "homeBtn"]);
}

async function sendCommand(cmd, payload) {
    const message = {
        type: "cmd",
        info: cmd,
        data: payload,
        gameId: gameInfo.id,
        userId: gameInfo.userId,
        username: gameInfo.username,
        isWhite: currentPlayerIsWhite,
    };
    await sendMessage(message);
}

async function sendMessage(message) {
    if (webSocket && webSocket.readyState == WebSocket.OPEN) {
        const messageStr = JSON.stringify(message);
        await webSocket.send(messageStr);
    }
}

async function sendOutOfTime(loser) {
    if (gameInfo.gameType == "SinglePlayerGame" || gameInfo.gameType == "OnlineGame") {
        const message = {
            type: "info",
            info: "outOfTime",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite,
            loser: loser,
        };
        await sendMessage(message);
    }
}


/// Buttons

function isButtonDisabled(button) {
    const drawButton = document.getElementById(button);
    if (drawButton.classList.contains("btnDisabled")) { return true; }
    return false;
}

function saveButtonsState() {
    const buttons = document.getElementsByClassName("button");
    for (const button of buttons) {
        const id = button.id;
        // const isDisabled = button.classList.contains("btnDisabled");
        const isDisabled = button.disabled;
        const entry = { id, isDisabled };
        buttonsState.push(entry);
    }
}

function restoreButtonsState() {
    while (buttonsState.length > 0) {
        const entry = buttonsState.pop();

        const element = document.getElementById(entry.id);
        if (element) {
            element.disabled = entry.isDisabled;
        }
    }
}


/// Menu Event Handlers

function menuOfferDrawEventHandler() {

    const drawButton = document.getElementById("drawBtn");
    if (drawButton && drawButton.disabled) { return; }

    if (game.GameOver || dialogOn) { return; }

    messageBox("Offer a Draw?", offerDraw, offerCanceled);
}

async function menuRematchEventHandler() {

    if (isButtonDisabled("rematchBtn")) { return; }

    if (!game.GameOver || dialogOn) { return; }

    if (gameType == "SinglePlayerGame") {
        // Single player: open new game options dialog instead of message box
        if (typeof gameInfo !== "undefined" && gameInfo) {
            window.__LAST_GAME_OPTIONS__ = {
                color: currentPlayerIsWhite ? "white" : "black",
                engine: gameInfo.engine || "brain4",
                difficulty: gameInfo.difficulty != null ? gameInfo.difficulty : 3,
                mouse: gameInfo.mousePreference || "drag",
                showAvailableMoves: gameInfo.showAvailableMoves !== false
            };
        }
        if (typeof openPlayNowModal === "function") {
            openPlayNowModal();
        }
        return;
    }

    if (gameType == "OnlineGame") {
        const message = {
            type: "info",
            info: "offer rematch",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite

        };
        await sendMessage(message);

        displayMessage("Rematch offer sent");
        log("System", "Rematch offer sent");
        disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
        document.getElementById("rematchBtn").classList.remove("btnDisabled");
        return;
    }

    displayMessage("New Game Started");
    startGame();
}


function disableButtons(btnList) {

    for (const btnName of btnList) {
        const button = document.getElementById(btnName);
        if (button) {
            button.disabled = true;
            //button.classList.add("btnDisabled");
        }
    }
}



function hideButtons(btnList) {

    for (const btnName of btnList) {
        const button = document.getElementById(btnName);
        if (button) {
            button.classList.add("hide");
        }
    }
}


function enableButtons(btnList) {

    for (const btnName of btnList) {
        const button = document.getElementById(btnName);
        if (button) {
            button.disabled = false;
            //button.classList.remove("btnDisabled");
        }
    }
}

async function menuResignEventHandler() {
    if (isButtonDisabled("resignBtn")) { return; }

    if (game.GameOver) { return; }

    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
    enableButtons(["rematchBtn"]);

    if (gameInfo.gameType == "PracticeGame") {
        displayMessage("Game Over");
        log("System", "Game Over");
    }
    else {
        const player = currentPlayerIsWhite ? "White" : "Black";
        const humanHasMoved = currentPlayerIsWhite ? game.Moves.length >= 1 : game.Moves.length >= 2;
        game.resign(player);
        const message = {
            type: "info",
            info: "resign",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite,
            moveTime: currentPlayerIsWhite ? whiteTimer : blackTimer,
        };
        await sendMessage(message);
        gameMoves = await getGameMoves();
        if (humanHasMoved && gameMoves.moves && game.ResultMove) {
            const last = gameMoves.moves[gameMoves.moves.length - 1];
            if (!last || last.moveStr !== game.ResultMove.moveStr) {
                gameMoves.moves = [...gameMoves.moves, game.ResultMove];
            }
        }
        updateMovesTable(gameMoves.moves);
        displayMessage(humanHasMoved ? `You resigned, ${!currentPlayerIsWhite ? "White" : "Black"} wins ` : "Game cancelled");
        log(humanHasMoved ? currentPlayerIsWhite ? gameInfo.whitePlayerName : gameInfo.blackPlayerName : "System", humanHasMoved ? "I resign!" : "Game cancelled");
    }

    const player = currentPlayerIsWhite ? "White" : "Black";
    if (gameInfo.gameType === "PracticeGame") {
        game.resign(player);
        const playerName = currentPlayerIsWhite ? gameInfo.whitePlayerName : gameInfo.blackPlayerName;
        log(playerName, "I resign!");
    }
}

function menuSaveEventHandler() {
    const state = game.GameState;
    const str = JSON.stringify(state);
    //   console.log(str);
}

function menuUndo() {

    if (isButtonDisabled("undoBtn")) { return; }

    if (game.GameOver) { return; }

    if (dialogOn) { return; }

    if (promotingMode) { return; }

    if (gameInfo.gameType == "OnlineGame") {
        sendCommand("undo");
        game.undo();
    }
    else if (gameInfo.gameType == "SinglePlayerGame") {

        if (game.Turn == "white") {
            sendCommand("undo");
        }
    }
    else if (gameInfo.gameType == "PracticeGame") {
        game.undo();
    }
}

function menuRedo() {

    if (isButtonDisabled("redoBtn")) { return; }

    if (game.GameOver) { return; }

    if (dialogOn) { return; }

    if (promotingMode) { return; }

    game.redo();
}

/*
function jsInclude(file) {
 
    const module = document.createElement("script");
    module.src = file;
    module.async = true;
    document.head.appendChild(module);
 
}
 
 
*/

async function getServerInfo(path) {

    try {
        const response = await axios.get(path);
        return response.data;

    } catch (error) {
        console.error(error);
    }
}

async function postServerInfo(path, param) {

    try {
        const response = await axios.post(path, param);
        return response.data;

    } catch (error) {
        console.error(error);
    }

}

async function getGameInfo(isRematch) {
    if (isRematch) {
        return await getServerInfo("/gameInfo?id=" + gameInfo.id);
    }
    const initialIdEl = document.querySelector("[data-initial-game-id]");
    const initialId = initialIdEl ? initialIdEl.getAttribute("data-initial-game-id") : null;
    if (initialId) {
        initialIdEl.removeAttribute("data-initial-game-id");
        return await getServerInfo("/gameInfo?id=" + initialId);
    }
    return await getServerInfo("/gameInfo");
}

async function setRematchGameId(newGameID) {
    const response = await postServerInfo("/rematch", { id: newGameID });
    //   console.log(response);
}

async function getGameMoves() {
    const moves = await getServerInfo("/gameMoves");
    return moves;
}

async function sendMove(moveObj) {
    moveObj.moveTime = currentPlayerIsWhite ? whiteTimer : blackTimer;

    const message = {
        type: "move",
        data: moveObj,
        gameId: gameInfo.id,
        username: gameInfo.username,
        isWhite: currentPlayerIsWhite,
    };

    await sendMessage(message);
}

function timerToText(timer) {
    var d = new Date(1970, 0, 1);
    d.setSeconds(timer);
    var text = d.toLocaleTimeString("eo", { hour12: false });
    return text;
}

function startDisconnectionTimer() {
    const playerDiconnectionTimer = currentPlayerIsWhite ?
        document.getElementById("blackPlayerDiconnectionTimer") :
        document.getElementById("whitePlayerDiconnectionTimer");

    disconnectionTimer = 59;
    playerDiconnectionTimer.classList.toggle("hide");
    disconnectionTimerHandle = setInterval(() => {
        playerDiconnectionTimer.innerText = `(${disconnectionTimer})`;
        if (rejoined) {
            rejoined = false; // for next time
            clearInterval(disconnectionTimerHandle);
            playerDiconnectionTimer.classList.toggle("hide");
        }
        if (game.GameOver) {
            //document.getElementById("rematchBtn").classList.remove("btnDisabled");
            enableButtons(["rematchBtn"]);

            clearInterval(disconnectionTimerHandle);
            playerDiconnectionTimer.classList.toggle("hide");
        }
        if (disconnectionTimer <= 0) {
            clearInterval(disconnectionTimerHandle);
            playerDiconnectionTimer.classList.toggle("hide");
        }
        disconnectionTimer--;
    }, 1000);
}


/// Clocks Handling

function updateTimers(gameInfo) {
    if (gameInfo.whiteTimer) {
        whiteTimer = gameInfo.whiteTimer;
        const whiteClock = document.getElementById("whiteClockTimeText");
        whiteClock.innerText = timerToText(whiteTimer);
    }

    if (gameInfo.blackTimer) {
        blackTimer = gameInfo.blackTimer;
        const blackClock = document.getElementById("blackClockTimeText");
        blackClock.innerText = timerToText(blackTimer);
    }
}

function switchClocks() {

    if (gameInfo.mode == "review") { return; }

    if (game.Turn == "black") {

        const whiteTurnClock = document.getElementById("whiteTurnClock");
        whiteTurnClock.classList.add("unvisible");
        const blackTurnClock = document.getElementById("blackTurnClock");
        blackTurnClock.classList.remove("unvisible");
        if (whiteTimer) { clearInterval(whiteHandle); }

        blackHandle = setInterval(() => {
            blackTimer--;
            const blackClock = document.getElementById("blackClockTimeText");
            blackClock.innerText = timerToText(blackTimer);
            if (game.GameOver) {
                //document.getElementById("rematchBtn").classList.remove("btnDisabled");
                enableButtons(["rematchBtn"]);
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
            }
            if (blackTimer <= 0) {
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
                outOfTime();
            }
        }, 1000);
    }


    if (game.Turn == "white") {

        const whiteTurnClock = document.getElementById("whiteTurnClock");
        whiteTurnClock.classList.remove("unvisible");
        const blackTurnClock = document.getElementById("blackTurnClock");
        blackTurnClock.classList.add("unvisible");
        if (blackTimer) { clearInterval(blackHandle); }

        whiteHandle = setInterval(() => {
            whiteTimer--;
            const whiteClock = document.getElementById("whiteClockTimeText");
            whiteClock.innerText = timerToText(whiteTimer);
            if (game.GameOver) {
                //document.getElementById("rematchBtn").classList.remove("btnDisabled");
                enableButtons(["rematchBtn"]);
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
            }
            if (whiteTimer <= 0) {
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
                outOfTime();
            }
        }, 1000);

    }
}

function outOfTime() {

    displayMessage(`Time's up! ${game.Turn} lost`);
    game.OutOfTime = game.Turn;
    sendOutOfTime(game.Turn);
}


/// Moves Navigations

function generateMoveButtons() {
    const gameNavDiv = document.getElementById("gameNav");
    if (gameNavDiv) {
        gameNavDiv.innerHTML = "";

        const buttons = [
            { id: "moveStart", src: "/images/start.png", height: 20, onclick: moveStart },
            { id: "movePrev", src: "/images/prev.png", height: 20, onclick: movePrev },
            { id: "movePlay", src: "/images/play.png", height: 16, onclick: movePlay },
            { id: "movePause", src: "/images/pause.png", height: 16, onclick: movePause, hidden: true },
            { id: "moveNext", src: "/images/next.png", height: 20, onclick: moveNext },
            { id: "moveEnd", src: "/images/end.png", height: 20, onclick: moveEnd },
            { id: "movesExport", src: "/images/export.png", height: 16, onclick: movesExport }
        ];

        buttons.forEach(addMoveButton);
    }
}

function addMoveButton(buttonConfig) {
    const moveButton = document.createElement("div");
    moveButton.id = buttonConfig.id;
    moveButton.classList.add("reviewButtons");
    if (buttonConfig.hidden) {
        moveButton.classList.add("hide");
    }

    if (buttonConfig.src) {
        const imgElement = document.createElement("img");
        imgElement.src = buttonConfig.src;
        imgElement.height = buttonConfig.height;
        moveButton.appendChild(imgElement);
    }

    if (buttonConfig.onclick) {
        moveButton.onclick = buttonConfig.onclick;
    }

    const gameNavDiv = document.getElementById("gameNav");
    if (gameNavDiv) {
        gameNavDiv.appendChild(moveButton);
    }
}

function showMoveButtons(show) {
    const gameNavDiv = document.getElementById("gameNav");
    if (!show) {
        gameNavDiv.classList.add("hide");
    }
    else {
        gameNavDiv.classList.remove("hide");
    }

}

function moveEnd() {
    if (gameInfo.mode != "review") { return; }
    if (animating) {
        movePause();
    };

    //wait until animation completes
    const temp = setInterval(() => {

        if (!animating) {
            for (let i = 0; i < gameMoves.moves.length; i++) {
                showMoveForReview(gameMoves.moves[moveIndex], false);
                moveIndex++;
                const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
                movesTDList.forEach(td => td.classList.remove("selectedMove"));
                const turnStr = "td_move" + (i + 1);
                const td = document.getElementById(turnStr);
                if (td) {
                    td.classList.toggle("selectedMove");
                    scrollMoveCellIntoView(td);
                }
            }
            clearInterval(temp);
            moveIndex = gameMoves.moves.length;
            console.log("moveIndex:" + moveIndex);
        }
    }, 100);

}

function movePause() {
    if (gameInfo.mode != "review") { return; }
    pause = true;
    const temp = setInterval(() => {
        if (!animating) {
            const movePlay = document.getElementById("movePlay");
            movePlay.classList.remove("hide");
            const movePause = document.getElementById("movePause");
            movePause.classList.add("hide");
            clearInterval(temp);
            console.log("moveIndex:" + moveIndex);
        }
    }, 100);


}

function movePlay() {
    if (gameInfo.mode != "review") { return; }
    if (animating) { return; }
    if (dialogOn) { return; }

    const movePlay = document.getElementById("movePlay");
    movePlay.classList.add("hide");
    const movePause = document.getElementById("movePause");
    movePause.classList.remove("hide");

    moveHandle = setInterval(() => {

        if (pause) {
            pause = false;
            animating = false;
            clearInterval(moveHandle);
            console.log("moveIndex:" + moveIndex);
            return;
        }
        if (moveIndex < gameMoves.moves.length) {
            showMoveForReview(gameMoves.moves[moveIndex], true);
            moveIndex++;
            const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
            movesTDList.forEach(td => td.classList.remove("selectedMove"));
            const turnStr = "td_move" + moveIndex;
            const td = document.getElementById(turnStr);
            if (!td) { clearInterval(moveHandle); return; }
            td.classList.toggle("selectedMove");
            scrollMoveCellIntoView(td);
        }

        else { clearInterval(moveHandle); console.log("moveIndex:" + moveIndex); }
    }, 800);
}

async function moveStart() {

    if (gameInfo.mode != "review") { return; }

    if (animating) {
        movePause();
    }
    const temp = setInterval(() => {

        if (!animating) {
            resetClocks();
            game.startNewGame(currentPlayerIsWhite);
            moveIndex = 0;
            const turnStr = "td_move1";
            const td = document.getElementById(turnStr);
            if (td) { scrollMoveCellIntoView(td); }
            const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
            movesTDList.forEach(td => td.classList.remove("selectedMove"));
            clearInterval(temp);
            console.log("moveIndex:" + moveIndex);
        }

    }, 100);

}

async function moveNext() {
    if (gameInfo.mode != "review") { return; }
    if (animating) { return; }
    if (moveIndex < gameMoves.moves.length) {
        const move = gameMoves.moves[moveIndex];
        if (move && !game.isResultMove(move)) {
            showMoveForReview(move, true);
            moveIndex++;
            const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
            movesTDList.forEach(td => td.classList.remove("selectedMove"));
            const turnStr = "td_move" + moveIndex;
            const td = document.getElementById(turnStr);
            if (td) {
                td.classList.toggle("selectedMove");
                scrollMoveCellIntoView(td);
            }
        }
    }
    console.log("moveIndex:" + moveIndex);
}

async function movePrev() {
    if (gameInfo.mode != "review") { return; }
    if (animating) { return; }
    if (moveIndex > 0) {
        //moveIndex < gameMoves.moves.length 
        const move = gameMoves.moves[moveIndex];
        if (move && !game.isResultMove(move)) {
            game.undo();
        }
        moveIndex--;
        const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
        movesTDList.forEach(td => td.classList.remove("selectedMove"));
        const turnStr = "td_move" + moveIndex;
        const td = document.getElementById(turnStr);
        if (!td) { return; }
        td.classList.toggle("selectedMove");
        scrollMoveCellIntoView(td);
    }
    console.log("moveIndex:" + moveIndex);
}

async function showMoveForReview(move, animnate) {
    // let move = { ...moveToReview };
    if (gameInfo.mode != "review") { return; }
    if (!move) { return; }
    if (game.isResultMove(move)) { return; }

    if (gameMoves.type == "pgn") {
        move = game.convertPGNMove(move);
    }
    else {
        if (!currentPlayerIsWhite) {
            move = game.flipMove(move);
        }
    }


    if (animnate) { await animateMove(move); }

    game.makeMove(move.source, move.target);
    if (move.promotion) {
        game.completePromotion(move);
    }

    const clock = moveIndex % 2 == 0 ?
        document.getElementById("whiteClockTimeText") :
        document.getElementById("blackClockTimeText");
    if (move.moveTime) {
        clock.innerText = timerToText(move.moveTime);
    }
    else {
        clock.innerText = "";
    }

    lastMove = move;
}

function movesExport() {

    const arr = [];
    for (let i = 0; i < gameMoves.moves.length; i++) {
        if (i % 2 == 0) {
            arr.push((i / 2) + 1 + ".");
        }
        arr.push(gameMoves.moves[i].moveStr);
    }


    navigator.clipboard.writeText(arr.join(" ")).then(() => {
        displayMessage("Moves copied to clipboard!");
        // Clear the message after 2 seconds
        setTimeout(() => {
            displayMessage("");
        }, 2000);
    }).catch(err => {
        console.error("Failed to copy moves to clipboard:", err);
        displayMessage("Failed to copy moves");
        setTimeout(() => {
            displayMessage("");
        }, 2000);
    });
}

async function loadMove(e) {
    if (gameInfo.mode != "review") { return; }
    if (animating) { return; }
    if (dialogOn) { return; }
    autoCompletePromotion = true;
    resetClocks();
    game.startNewGame(currentPlayerIsWhite);
    const moves = [...gameMoves.moves];

    moveIndex = 0;
    for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        showMoveForReview(move, false);

        if (e.target.id == "td_move" + (i + 1)) {
            moveIndex = i + 1;
            break;
        }
    }

    const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
    movesTDList.forEach(td => td.classList.remove("selectedMove"));
    const turnStr = "td_move" + moveIndex;
    const td = document.getElementById(turnStr);
    if (!td) { return; }
    td.classList.add("selectedMove");
    scrollMoveCellIntoView(td);
    autoCompletePromotion = false;
}

/// Options Buttons 

async function backToHome() {

    if (isButtonDisabled("homeBtn")) { return; }

    if (game.GameOver || gameInfo.mode == "review") {
        goBackHome();
    } else {
        messageBox("Resign?", goBackHome, () => { });
    }

};

async function goBackHome() {
    await menuResignEventHandler();
    window.location = "/home";
}

function addOptionsButtons() {
    const buttons = [
        { id: "rematchBtn", onclick: menuRematchEventHandler, text: Labels.REMATCH },
        { id: "resignBtn", onclick: menuResignEventHandler, text: Labels.RESIGN },
        { id: "drawBtn", onclick: menuOfferDrawEventHandler, text: Labels.DRAW },
        { id: "undoBtn", onclick: menuUndo, text: Labels.UNDO },
        { id: "redoBtn", onclick: menuRedo, text: Labels.REDO },
        { id: "flipBtn", onclick: flipboard, text: Labels.FLIP },
        { id: "lastMoveBtn", onclick: viewLastMove, text: Labels.LAST_MOVE },
        { id: "homeBtn", onclick: backToHome, text: Labels.HOME },
        { id: "bookmarkBtn", onclick: showBookmarks, text: Labels.BOOKMARKS }
    ];

    const optionsSection = document.getElementById("options");

    if (optionsSection) {
        buttons.forEach(buttonInfo => {
            const buttonElement = document.createElement("button");
            buttonElement.id = buttonInfo.id;
            buttonElement.className = "button";
            buttonElement.innerText = buttonInfo.text;
            buttonElement.onclick = buttonInfo.onclick;
            optionsSection.appendChild(buttonElement);
        });
    }
}


/// Chat ///

function resetChat() {
    const messages = document.getElementById("messages");
    messages.innerHTML = "";
}

function log(logger, message, isChat) {
    const messages = document.getElementById("messages");
    const msgDiv = document.createElement("div");
    msgDiv.innerHTML = `${logger}: ${message}\n`;
    if (isChat) {
        msgDiv.classList.add("chatlog");
    }
    messages.appendChild(msgDiv);
    messages.scrollTop = messages.scrollHeight;
}

/* eslint-disable-next-line no-unused-vars */
function onSendChatButtonClick() {
    const chatlLine = document.getElementById("chatline").value;
    sendChatMessage(chatlLine);
}

async function sendChatMessage(chatMessage) {
    log(gameInfo.username, chatMessage, true);

    if (gameInfo.gameType == "OnlineGame") {
        const message = {
            type: "info",
            info: "chat",
            data: chatMessage,
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite

        };
        await sendMessage(message);
    }

}

///Bookmarks ///


function showBookmarks() {
    const bookmarksPanel = document.getElementById("bookmarksPanel");
    if (bookmarksPanel.style.opacity == "1") {
        closeBookmarkPanel();
    }
    else {
        bookmarksPanel.style.opacity = "1";
        bookmarksPanel.style.width = "350px";
    }
}

/* eslint-disable-next-line no-unused-vars */
async function addBookmark() {

    const bookmarksList = document.getElementById("bookmarksList");
    const div = createNewBookmarkDiv();
    bookmarksList.prepend(div);
    const input = document.getElementById("newBookmarkName");
    input.focus();
}

function formatDate(today) {
    const yyyy = today.getFullYear();
    let mm = today.getMonth() + 1; // Months start at 0!
    let dd = today.getDate();

    if (dd < 10) { dd = "0" + dd; }
    if (mm < 10) { mm = "0" + mm; }

    const formattedToday = dd + "/" + mm + "/" + yyyy;
    const time = today.toLocaleTimeString("eo", { hour12: false });
    return formattedToday + " " + time;
}

function createNewBookmarkDiv() {
    const div = document.createElement("div");
    div.classList.add("bookmark");
    div.classList.add("selected");
    div.setAttribute("id", "newBookmark");

    const header = document.createElement("div");
    header.classList.add("bookmarkHeader");


    const dateDiv = document.createElement("div");
    dateDiv.innerText = formatDate(new Date());
    header.appendChild(dateDiv);

    const gameType = document.createElement("div");
    gameType.innerText = gameInfo.gameType;
    header.appendChild(gameType);

    div.appendChild(header);

    const gameNameInput = document.createElement("input");
    gameNameInput.setAttribute("placeholder", "Insert bookmark name");
    gameNameInput.setAttribute("style", "margin: 10px;");
    gameNameInput.setAttribute("id", "newBookmarkName");
    gameNameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            onBookmarkAdded(bookmarks.length + 1, gameNameInput.value, new Date(), gameInfo.gameType);
        }
    });

    div.appendChild(gameNameInput);
    const operationPanel = document.createElement("div");
    operationPanel.classList.add("operationPanel");
    div.appendChild(operationPanel);
    return div;
}

function createBookmarkDiv(bookmarkId, bookmarkName, bookmarkDate, gameType) {
    const div = document.createElement("div");
    div.classList.add("bookmark");
    div.setAttribute("id", "bookmark" + bookmarkId);
    div.addEventListener("click", loadBookmark);

    const header = document.createElement("div");
    header.classList.add("bookmarkHeader");


    const dateDiv = document.createElement("div");
    dateDiv.innerText = formatDate(new Date(bookmarkDate));
    header.appendChild(dateDiv);

    const gameTypeDiv = document.createElement("div");
    gameTypeDiv.innerText = gameType;
    header.appendChild(gameTypeDiv);

    div.appendChild(header);

    const bookmarkNameDiv = document.createElement("div");
    const bookmarkNameWrapper = document.createElement("div");
    bookmarkNameWrapper.setAttribute("class", "bookmarkNameWrapper");
    const bookmarkNameLink = document.createElement("a");
    bookmarkNameLink.classList.add("bookmarkNameLink");
    bookmarkNameLink.addEventListener("click", enterEditBookmarkMode);
    bookmarkNameDiv.setAttribute("class", "bookmarkName");
    bookmarkNameDiv.setAttribute("id", "bookmarkName");
    bookmarkNameDiv.innerText = bookmarkName;
    bookmarkNameWrapper.appendChild(bookmarkNameLink);
    bookmarkNameLink.appendChild(bookmarkNameDiv);
    div.appendChild(bookmarkNameWrapper);
    const operationPanel = document.createElement("div");
    operationPanel.classList.add("operationPanel");
    const deletelLink = document.createElement("a");
    deletelLink.classList.add("bookmarkFunc");
    const deleteButton = document.createElement("img");
    deleteButton.setAttribute("src", "images/icons8-delete-50.png");
    deleteButton.setAttribute("alt", "save bopokmark");
    deleteButton.addEventListener("click", deleteBookmark);
    deletelLink.appendChild(deleteButton);
    operationPanel.appendChild(deletelLink);
    div.appendChild(operationPanel);


    return div;
}

async function onBookmarkAdded(bookmarkId, name, date, gameType) {
    const bookmarksList = document.getElementById("bookmarksList");
    const newBookmarkCard = document.getElementById("newBookmark");
    const bookmark = createBookmarkDiv(bookmarkId, name, date, gameType);
    bookmarksList.removeChild(newBookmarkCard);
    bookmarksList.prepend(bookmark);

    const state = game.GameState;
    const strMoves = gameMoves.moves.map(m => JSON.stringify(m));
    const response = await postServerInfo("/bookmark", { gameState: state, name, gameType: gameInfo.gameType, moves: strMoves });
    //console.log(response);
    bookmarks = await getBookmarks();
    updateBookmarks(bookmarks);

}

function exitEditBookmarkMode() {

    const bookmarkNameWrapper = currentEditingBookmark.parentElement.parentElement;
    const link = bookmarkNameWrapper.querySelector(".bookmarkNameLink");
    const editBookmarkInput = bookmarkNameWrapper.querySelector("#editBookmarkInput");
    link.classList.remove("hide");
    bookmarkNameWrapper.removeChild(editBookmarkInput);
    currentEditingBookmark = null;
}

function enterEditBookmarkMode(e) {
    if (currentEditingBookmark) { return; }
    currentEditingBookmark = e.srcElement;
    const bookmarkNameLink = currentEditingBookmark.parentElement;
    const bookmarkNameWrapper = bookmarkNameLink.parentElement;
    const gameNameInput = document.createElement("input");
    gameNameInput.setAttribute("placeholder", "Insert bookmark name");
    gameNameInput.setAttribute("id", "editBookmarkInput");
    gameNameInput.setAttribute("value", currentEditingBookmark.innerText);
    gameNameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            renameBookmark(gameNameInput);
        }
    });
    gameNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            exitEditBookmarkMode();
        }
    });

    const link = bookmarkNameWrapper.querySelector(".bookmarkNameLink");
    link.classList.add("hide");
    bookmarkNameWrapper.appendChild(gameNameInput);
    gameNameInput.focus();
    gameNameInput.select();
}

function renameBookmark(renameInputElement) {

    const bookmarkDiv = renameInputElement;
    const bookmarkName = bookmarkDiv.value;
    const id = parseInt(bookmarkDiv.parentElement.parentElement.id.replace("bookmark", ""));
    // console.log(id);
    //console.log(bookmarkName);
    const bookmark = bookmarks.find((o) => o.id == id);
    postServerInfo("/updateBookmark", { id: bookmark._id, name: bookmarkName, gameType: gameInfo.gameType, date: new Date() });
    const newName = renameInputElement.value;
    currentEditingBookmark.innerText = newName;
    exitEditBookmarkMode();
}

async function deleteBookmark(e) {

    if (currentEditingBookmark) {
        return;
    }

    const deleteButton = e.srcElement;
    const deleteLink = deleteButton.parentElement;
    const bookmarkElement = deleteLink.parentElement.parentElement;
    const id = parseInt(bookmarkElement.id.replace("bookmark", ""));
    const bookmark = bookmarks.find((o) => o.id == id);
    bookmarks = bookmarks.filter(item => item.id !== id);
    e.stopPropagation();
    const result = await postServerInfo("/deleteBookmark", { id: bookmark._id });
    if (result == "OK") {

        bookmarkElement.innerHTML = "";
        bookmarkElement.classList.add("bookmarkRemoving");
        bookmarkElement.addEventListener("transitionend", () => {
            bookmarkElement.remove();
        });

    }
}

async function loadBookmark(e) {
    const bookmarkElement = e.currentTarget;
    const id = bookmarkElement.id.replace("bookmark", "");
    const bookmarkObj = bookmarks.find(el => el.id == id);
    if (bookmarkObj) {

        if (gameInfo.gameType == "SinglePlayerGame") {
            const result = await postServerInfo("/applyBookmark", { gameId: gameInfo.id, bookarkId: bookmarkObj._id });
            console.log("Applying bookmark: " + result);
        }
        else if (bookmarkObj.moves && bookmarkObj.moves.length > 0) {
            const moves = bookmarkObj.moves.map(m => JSON.parse(m));
            game.loadMoves(moves);
            updateMovesTable(moves);
        }
        game.loadGame(bookmarkObj.state);

    }
}

function updateBookmarks(bookmarks) {

    let i = 1;
    const bookmarksList = document.getElementById("bookmarksList");
    bookmarksList.innerHTML = "";

    for (const bookmark of bookmarks) {
        bookmark.id = i;
        const bookmarkDiv = createBookmarkDiv(bookmark.id, bookmark.name, bookmark.date, bookmark.gameType);
        bookmarksList.prepend(bookmarkDiv);
        i++;
    }

}

function closeBookmarkPanel() {
    const bookmarksPanel = document.getElementById("bookmarksPanel");
    if (bookmarksPanel.style.opacity == "1") {
        bookmarksPanel.style.opacity = "0";
        bookmarksPanel.style.width = "0px";
    }
}

async function getBookmarks() {
    const bookmarks = await getServerInfo("/bookmark");
    return bookmarks;
}

/// Load Game Panel

/**
 *  Creates the HTML DOM Element that assemblies the Load Game dialog . 
 *
 * @return {HTMLDivElement} The div Element containing the load game dialog
 * @example
 *
 *     createLoadGamePanel()  
 */
function createLoadGamePanel() {
    const loadGamePanel = document.createElement("div");
    loadGamePanel.setAttribute("class", "loadGamePanel");
    loadGamePanel.setAttribute("id", "loadGamePanel");


    const loadGameCaption = document.createElement("div");
    loadGameCaption.innerText = Labels.LOAD_GAME;
    loadGameCaption.setAttribute("class", "loadGameCaption");
    loadGameCaption.setAttribute("id", "loadGameCaption");
    loadGamePanel.appendChild(loadGameCaption);

    const loadGameText = document.createElement("textArea");
    loadGameText.setAttribute("class", "loadGameText");
    loadGameText.setAttribute("id", "loadGameText");
    loadGameText.setAttribute("placeholder", Labels.ENTER_GAME_STATE);

    loadGamePanel.appendChild(loadGameText);

    const buttonsArea = document.createElement("div");
    buttonsArea.setAttribute("class", "loadGameButtons");
    buttonsArea.setAttribute("id", "loadGameButtons");


    const loadGameButton = document.createElement("Button");
    loadGameButton.setAttribute("class", "button");
    loadGameButton.setAttribute("id", "loadGameButton");
    loadGameButton.innerText = Labels.LOAD;
    loadGameButton.addEventListener("click", loadGameButtonEventHandler);
    buttonsArea.appendChild(loadGameButton);


    const cancelLoadGameButton = document.createElement("Button");
    cancelLoadGameButton.setAttribute("class", "button");
    cancelLoadGameButton.setAttribute("id", "cancelLoadGameButton");
    cancelLoadGameButton.innerText = Labels.CANCEL;
    cancelLoadGameButton.addEventListener("click", closeDialogs);
    buttonsArea.appendChild(cancelLoadGameButton);

    loadGamePanel.appendChild(buttonsArea);

    return loadGamePanel;
}


function showLoadGameDialog() {

    const loadGamePanelDiv = document.getElementById("loadGamePanel");
    loadGamePanelDiv.style.visibility = "visible";
    dialogOn = true;
}

function loadGameButtonEventHandler() {

    const textArea = document.getElementById("loadGameText");
    game.loadGame(textArea.value);
    sendCommand("setState", game.GameState);
    const loadGamePanel = document.getElementById("loadGamePanel");
    loadGamePanel.style.visibility = "hidden";
    dialogOn = false;
}