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
let disconnectionTimer, disconnectionTimerHandle;
/** @type {ReturnType<typeof setTimeout>|null} */
let opponentDisconnectGraceTimer = null;
/** Auto-dismiss timer for board-centered status flashes (check / checkmate / draw). */
let flashDismissTimerId = null;
/** Default auto-dismiss for mobile board flashes when `displayMessage` is called without `durationMs`. */
const MOBILE_BOARD_FLASH_DEFAULT_MS = 3000;
let moveHandle;
let moveIndex = 0;
const buttonsState = [];
let gameMoves = { moves: [] };
let bookmarks = [];
let autoCompletePromotion = false;
let animating = false;

/**
 * Mobile session adapters read window.game / window.gameInfo. Top-level `let`
 * bindings are not window properties, so publish explicitly after updates.
 */
function publishChessboardGlobals() {
    if (typeof window === "undefined") {
        return;
    }
    window.game = game;
    window.gameInfo = gameInfo;
    window.currentPlayerIsWhite = currentPlayerIsWhite;
    window.gameMoves = gameMoves;
    window.lastMove = lastMove;
    window.gameType = gameType;
    window.whiteTimer = whiteTimer;
    window.blackTimer = blackTimer;
    window.whiteHandle = whiteHandle;
    window.blackHandle = blackHandle;
    window.dialogOn = dialogOn;
    window.animating = animating;
}
let pause = false;
let draggedImage, offsetX, offsetY, chessboard, coordX, coordY, sourcePosition, targetPosition;
let currentEditingBookmark = null;
let clickToMoveSelected = null;
/** Suppress duplicate check alerts if OnUpdate still fires twice with the same checked side (backup guard). */
let lastCheckNotifySide = null;
const BOOKMARK_BRAIN_OPTIONS = [
    { value: "brain43", label: "Brain 4.3" },
    { value: "brain42", label: "Brain 4.2" },
    { value: "brain41", label: "Brain 4.1" },
    { value: "brain4", label: "Brain 4.0" },
];
const BOOKMARK_DEPTH_OPTIONS = [1, 2, 3, 4, 5];
/** Piece score keys in display order; rows are only shown if the key exists in the loaded server config. */
const BRAIN_CONFIG_PIECE_KEYS = ["pawn", "rook", "knight", "bishop", "queen", "king"];

function getBookmarkBrainOptions() {
    if (typeof window !== "undefined" && window.__SHMERLING_DESKTOP__) {
        return BOOKMARK_BRAIN_OPTIONS.filter(function (opt) {
            return opt.value === "brain41" || opt.value === "brain42" || opt.value === "brain43";
        });
    }
    return BOOKMARK_BRAIN_OPTIONS;
}

function normalizeBookmarkEngine(engineName) {
    const options = getBookmarkBrainOptions();
    return options.some(function (opt) { return opt.value === engineName; }) ? engineName : options[0].value;
}

function normalizeBookmarkDepth(depthValue) {
    const parsed = Number(depthValue);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 6 ? parsed : 3;
}

function isResearchScreen() {
    const p = window.location.pathname || "";
    if (p === "/research") {
        return true;
    }
    if (typeof window !== "undefined" && window.__SHMERLING_DESKTOP__ && p === "/app/play") {
        const mainEl = document.getElementById("main");
        return mainEl && mainEl.getAttribute("data-research-mode") === "true";
    }
    return false;
}

function cleanupResearchUiForGameStart() {
    const toolbox = document.getElementById("researchToolbox");
    if (toolbox) {
        toolbox.remove();
    }
    const controlPanel = document.querySelector(".controlPanel");
    if (controlPanel) {
        controlPanel.classList.remove("research-simplified");
    }
    const innerBoardEl = document.getElementById("innerBoard");
    if (innerBoardEl) {
        innerBoardEl.classList.remove("research-no-animate");
    }
    exitBookmarkPositionEditMode();
    const board = document.getElementById("chessBoard");
    if (board) {
        board.style.cursor = "";
    }
    document.body.classList.remove("research-mode");
}

async function executeBookmarkFromResearch(bookmarkObj, bookmarkId) {
    if (!bookmarkObj || !bookmarkObj._id) {
        return;
    }
    const engine = normalizeBookmarkEngine(bookmarkObj.engine);
    const depth = normalizeBookmarkDepth(bookmarkObj.depth);
    const createPath = "/game?gameType=1&newGame=1&private=1&engine="
        + encodeURIComponent(engine)
        + "&difficulty=" + encodeURIComponent(String(depth));
    await getServerInfo(createPath);
    cleanupResearchUiForGameStart();
    researchMode = false;
    await startGame();
    await applyBookmarkAction(bookmarkId);
    setResearchRunningBookmark(bookmarkId);
    syncBrainConfigPanelEngine(engine);
}

function setResearchRunningBookmark(bookmarkId) {
    researchRunningBookmarkId = bookmarkId;
    const list = document.getElementById("bookmarksList");
    if (!list) {
        return;
    }
    list.querySelectorAll(".bookmark.bookmark-running").forEach(function (el) {
        if (el.id !== "bookmark" + String(bookmarkId)) {
            el.classList.remove("bookmark-running");
        }
    });
    const activeBookmarkEl = document.getElementById("bookmark" + String(bookmarkId));
    if (activeBookmarkEl) {
        activeBookmarkEl.classList.add("bookmark-running");
        activeBookmarkEl.classList.add("expanded");
    }
}

function clearOpponentDisconnectGrace() {
    if (opponentDisconnectGraceTimer != null) {
        clearTimeout(opponentDisconnectGraceTimer);
        opponentDisconnectGraceTimer = null;
    }
}

/**
 * @param {HTMLElement|null} el
 * @param {"online"|"disconnected"|"offline"} state
 */
function setPlayerStatusDot(el, state) {
    if (!el) {
        return;
    }
    const map = {
        online: { title: "Online", mod: "friends-status-online" },
        disconnected: { title: "Disconnected", mod: "friends-status-disconnected" },
        offline: { title: "Offline", mod: "friends-status-offline" },
    };
    const row = map[state] || map.offline;
    el.className = "friends-status-dot " + row.mod;
    el.setAttribute("title", row.title);
    el.setAttribute("aria-label", row.title);
}

const DISCONNECT_COUNTDOWN_TOOLTIP = "Waiting for opponent to rejoin";

function formatDisconnectionCountdown(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    if (s === 1) {
        return "Timeout: 1 sec";
    }
    return "Timeout: " + s + " sec";
}

function getOpponentStatusElement() {
    return currentPlayerIsWhite ?
        document.getElementById("blackPlayerStatus") :
        document.getElementById("whitePlayerStatus");
}

/** Status dot for White (true) or Black (false) — for spectators who are not a seated player. */
function watcherPlayerStatusDot(isWhitePlayer) {
    return isWhitePlayer ?
        document.getElementById("whitePlayerStatus") :
        document.getElementById("blackPlayerStatus");
}

/** Display name for disconnect/reconnect messages when `disconnectedWasWhite` / `rejoinedWasWhite` is set. */
function onlinePlayerLabelForSide(isWhitePlayer) {
    if (isWhitePlayer === true) {
        return (gameInfo && gameInfo.whitePlayerName) ? String(gameInfo.whitePlayerName) : "White";
    }
    if (isWhitePlayer === false) {
        return (gameInfo && gameInfo.blackPlayerName) ? String(gameInfo.blackPlayerName) : "Black";
    }
    return "A player";
}

/**
 * Online (non-spectator): enable Draw only after this player has moved, and only while waiting for the opponent
 * (not on your own turn).
 */
/**
 * Opponent moves arrive in coordinates for the default board orientation (white player: WhitePlayerView true;
 * black player: false). After the user flips the board, the engine state is mirrored — flip incoming moves to match.
 * Watchers load as white view (true); their incoming data is server‑canonical, same adjustment when flipped.
 */
function adjustIncomingNetworkMoveForBoardView(move) {
    if (!move || !game) {
        return move;
    }
    const defaultView = gameInfo && gameInfo.watcher ? true : currentPlayerIsWhite;
    if (game.WhitePlayerView === defaultView) {
        return move;
    }
    return game.flipMove(move);
}

/** Local engine move is in flipped view when the board is flipped; server/opponent expect default-view coordinates. */
function adjustOutgoingNetworkMoveForBoardView(move) {
    if (!move || !game) {
        return move;
    }
    if (gameInfo && gameInfo.watcher) {
        return move;
    }
    if (game.WhitePlayerView === currentPlayerIsWhite) {
        return move;
    }
    return game.flipMove(move);
}

function syncOnlineGameDrawButton() {
    if (!gameInfo || gameInfo.gameType !== "OnlineGame" || gameInfo.watcher || !game || game.GameOver || gameInfo.mode === "review") {
        return;
    }
    const humanHasMoved = currentPlayerIsWhite ? game.Moves.length >= 1 : game.Moves.length >= 2;
    const myTurn =
        (game.Turn === "white" && currentPlayerIsWhite) ||
        (game.Turn === "black" && !currentPlayerIsWhite);
    if (humanHasMoved && !myTurn) {
        enableButtons(["drawBtn"]);
    } else {
        disableButtons(["drawBtn"]);
    }
}

function hideDisconnectionCountdown() {
    const el = currentPlayerIsWhite ?
        document.getElementById("blackPlayerDiconnectionTimer") :
        document.getElementById("whitePlayerDiconnectionTimer");
    if (el) {
        el.classList.add("hide");
        el.removeAttribute("title");
        el.removeAttribute("aria-label");
    }
    if (disconnectionTimerHandle) {
        clearInterval(disconnectionTimerHandle);
        disconnectionTimerHandle = null;
    }
}

/**
 * If the reconnect countdown reaches 0 but the WebSocket "Game cancelled" / "Opponent failed to reconnect"
 * message was missed, align UI from /gameInfo + moves (same wall clock as server after 61s disconnect deadline).
 */
async function syncReconnectTimeoutFromServer() {
    if (!gameInfo || gameInfo.gameType !== "OnlineGame" || gameInfo.watcher) {
        return;
    }
    if (!gameInfo.id || game.GameOver) {
        return;
    }
    try {
        const data = await getServerInfo("/gameInfo?id=" + encodeURIComponent(gameInfo.id));
        if (!data || typeof data !== "object" || data.status == null) {
            return;
        }
        const st = data.status;
        if (st === "cancelled") {
            clearOpponentDisconnectGrace();
            hideDisconnectionCountdown();
            const detail = "Reconnect timed out with no moves played.";
            const shown = "Game cancelled — " + detail;
            displayMessage(shown);
            log("System", shown);
            hideMessageBox();
            clearInterval(whiteHandle);
            clearInterval(blackHandle);
            setPlayerStatusDot(getOpponentStatusElement(), "offline");
            disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
            enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
            return;
        }
        if (st !== "game over") {
            return;
        }
        const movesObj = await getMovesForTable();
        const moves = movesObj.moves || [];
        const last = moves[moves.length - 1];
        let loser = null;
        if (last && last.moveStr === "1-0") {
            loser = "Black";
        } else if (last && last.moveStr === "0-1") {
            loser = "White";
        }
        if (!loser || game.GameOver) {
            return;
        }
        const winner = loser === "White" ? "Black" : "White";
        const winnerName = winner === "White" ? gameInfo.whitePlayerName : gameInfo.blackPlayerName;
        const summary = "Game over — opponent failed to reconnect. " + winnerName + " wins.";
        clearOpponentDisconnectGrace();
        hideDisconnectionCountdown();
        displayMessage(summary);
        log("System", summary);
        game.resign(loser);
        setPlayerStatusDot(getOpponentStatusElement(), "offline");
        hideMessageBox();
        clearInterval(whiteHandle);
        clearInterval(blackHandle);
        disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
        enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
        gameMoves = await getMovesForTable();
        updateMovesTable(gameMoves.moves);
    } catch (err) {
        console.error(err);
    }
}

const WhitePawnUrl = "images/white-pawn.png";
const WhiteRookUrl = "images/white-rook.png";
const WhiteBishopUrl = "images/white-bishop.png";
const WhiteKnightUrl = "images/white-knight.png";
const WhiteKingUrl = "images/white-king.png";
const WhiteQueenUrl = "images/white-queen.png";

const BlackPawnUrl = "images/black-pawn.png";
const BlackRookUrl = "images/black-rook.png";
const BlackBishopUrl = "images/black-bishop.png";
const BlackKnightUrl = "images/black-knight.png";
const BlackKingUrl = "images/black-king.png";
const BlackQueenUrl = "images/black-queen.png";

let whitePiecesURL = [WhitePawnUrl, WhiteKingUrl, WhiteKnightUrl, WhiteBishopUrl, WhiteRookUrl, WhiteQueenUrl];
let blackPiecesURL = [BlackPawnUrl, BlackKingUrl, BlackKnightUrl, BlackBishopUrl, BlackRookUrl, BlackQueenUrl];

function syncWebPieceUrlArrays() {
    if (typeof ShmerlingPieceSets !== "undefined" && ShmerlingPieceSets.getActiveUrls) {
        const urls = ShmerlingPieceSets.getActiveUrls();
        whitePiecesURL = urls.white;
        blackPiecesURL = urls.black;
    }
}

syncWebPieceUrlArrays();

document.addEventListener("shmerling-piece-set-changed", function () {
    syncWebPieceUrlArrays();
    const state = typeof chess !== "undefined" && chess && chess.GameState ? chess.GameState : null;
    if (state && state.board) {
        drawBoard(state.board);
    }
});


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
    HOME: "Exit",
    FLIP: "Flip",
    BOOKMARKS: "Bookmarks",
    OK: "OK",
    BOOKMARK_ALERT_TITLE: "Bookmark position",
};

function isPlayGamePage() {
    const p = window.location.pathname || "";
    if (p === "/game" || p === "/mobile-game") {
        return true;
    }
    if (typeof window !== "undefined" && window.__SHMERLING_DESKTOP__ && p === "/app/play") {
        const mainEl = document.getElementById("main");
        return mainEl && mainEl.getAttribute("data-research-mode") === "true";
    }
    return false;
}

function getAppHomePath() {
    if (typeof window !== "undefined" && window.__SHMERLING_DESKTOP__) {
        return "/app/play";
    }
    return "/home";
}

function isMobileGameShell() {
    return typeof document !== "undefined" && document.body &&
        document.body.classList.contains("mobile-game-shell");
}

/** Touch devices need tap-to-move (click on square); mouse-drag uses mousemove which does not track fingers. */
function shouldUseTapToMoveOnTouchShell() {
    if (!isMobileGameShell() || !isPlayGamePage()) {
        return false;
    }
    if (typeof gameInfo === "undefined" || !gameInfo || gameInfo.watcher) {
        return false;
    }
    if (gameInfo.mode === "review") {
        return false;
    }
    return true;
}

window.onload = function () {
    console.log(window.location.pathname);
    //populatePaletteSelctor();
    // overrideFormValidity();
    if (isPlayGamePage() ||
        window.location.pathname == "/watch" ||
        window.location.pathname == "/review" ||
        window.location.pathname == "/mobile-review" ||
        window.location.pathname == "/research") {
        game = new ChessGame();
        publishChessboardGlobals();
        createGUIBoard();
        const mainEl = document.getElementById("main");
        const isResearchMode = mainEl && mainEl.getAttribute("data-research-mode") === "true";
        if (isResearchMode) {
            initResearchMode();
        } else {
            addOptionsButtons();
            generateMoveButtons();
            registerWindowEvents();
            startGame();
        }
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
        if (!researchMode && (bookmarkBtn && !bookmarkBtn.contains(event.target))
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

    const allowDrag = isPlayGamePage() || (
        isResearchScreen() && (!researchMode || researchSelected === "select")
    );
    if (!allowDrag) { return; }

    draggedImage = e.target;
    if (!draggedImage || !draggedImage.classList || !draggedImage.classList.contains("draggable")) {
        return;
    }

    if (!researchMode && gameType != "PracticeGame" &&
        (currentPlayerIsWhite && draggedImage.src.indexOf("black") != -1 ||
        !currentPlayerIsWhite && draggedImage.src.indexOf("white") != -1)) {
        return;
    }

    /* After we know we are dragging our piece: avoid text selection; do not run before early returns
     * or tap-to-move (click) on the same tap is suppressed on mobile. */
    if (e.target.type != "textarea" && e.target.type != "text") {
        if (e.preventDefault) { e.preventDefault(); }
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

    document.querySelectorAll("#innerBoard .square.dragging-source").forEach(function (sq) {
        sq.classList.remove("dragging-source");
    });
    const sourceSquare = draggedImage.closest(".square");
    if (sourceSquare) {
        sourceSquare.classList.add("dragging-source");
    }
    // Above capture-target move dots (z-index 3), but only while this piece is dragged.
    draggedImage.style.zIndex = "10";


    coordX = parseInt(draggedImage.style.left);
    coordY = parseInt(draggedImage.style.top);
    drag = true;
    sourcePosition = findPosition();
    document.onmousemove = onDragging;


    targetPosition = findPosition();

    if (!researchMode && gameInfo.showAvailableMoves !== false) {
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
    }

    document.querySelectorAll("#innerBoard .square.dragging-source").forEach(function (sq) {
        sq.classList.remove("dragging-source");
    });

    if (researchMode && researchSelected === "select") {
        drag = false;
        document.onmousemove = null;
        resetSqaureColor();
        return;
    }

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
        let executed;
        try {
            executed = game.makeMove(sourcePos, targetPos);
        } catch (err) {
            console.error("[chessboard] makeMove failed during tryMove:", err);
            /* Soft-patch may have thrown inside OnUpdate; recover board and continue if move applied. */
            try {
                const state = game.GameState;
                if (state && state.board) {
                    drawBoard(state.board);
                }
            } catch (drawErr) {
                console.error(drawErr);
            }
            executed = game.Moves && game.Moves.length ? game.Moves[game.Moves.length - 1] : null;
            if (!executed) {
                return false;
            }
        }
        lastMove = executed;
        switchClocks();
        await sendMove(executed);
        /* Prefer-Play / mobile LocalEngineMode: reliable after-move hook (sendMove wrap alone is brittle). */
        if (typeof window !== "undefined" && typeof window.__SHMERLING_AFTER_HUMAN_MOVE__ === "function") {
            Promise.resolve().then(function () {
                return window.__SHMERLING_AFTER_HUMAN_MOVE__(executed);
            }).catch(function (hookErr) {
                console.warn("[chessboard] after-human-move hook failed:", hookErr);
            });
        }
        /* Board paint comes from OnUpdate → patchBoardFromState (avoid a second full wipe). */
        gameMoves = await getMovesForTable();
        updateMovesTable(gameMoves.moves);
        moveIndex = gameMoves.moves ? gameMoves.moves.length : 0;
        const turnStr = "td_move" + moveIndex;
        const td = document.getElementById(turnStr);
        if (td) { scrollMoveCellIntoView(td); }
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
    try {
        const gid = (typeof gameInfo !== "undefined" && gameInfo && gameInfo.id) ? String(gameInfo.id) : "";
        document.dispatchEvent(new CustomEvent("shmerlingGameId", { detail: { id: gid } }));
    } catch {
        /* ignore */
    }
}

async function startGame(isRematch) {

    gameInfo = await getGameInfo(isRematch);
    updateDebugGameId();
    //console.log(gameInfo);
    gameType = gameInfo.gameType;
    currentPlayerIsWhite = gameInfo.username == gameInfo.whitePlayerName;
    publishChessboardGlobals();

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
        gameMoves = await getMovesForTable();
        let tableMoves = gameMoves.moves || [];
        if (tableMoves.length > 0) {
            tableMoves = tableMoves.map((m) => (typeof m === "string" ? JSON.parse(m) : m));
            game.loadMoves(tableMoves);
        }
        gameMoves.moves = tableMoves;
        updateMovesTable(tableMoves);
        updateTimers(gameInfo);
        switchClocks();
        console.log("game loaded");
    }
    else {
        game.startNewGame(currentPlayerIsWhite);
        gameMoves = await getMovesForTable();
        updateMovesTable(gameMoves.moves);
        resetClocks();
    }
    if (gameInfo.mode !== "review" && game.GameState && game.GameState.board) {
        syncBoardFromGameStateOnly();
    }
    updateRowOrder();
    updateLegend();
    if (!isMobileGameShell()) {
        bookmarks = await getBookmarks();
        updateBookmarks(bookmarks);
    } else {
        bookmarks = [];
    }

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
        if (isMobileGameShell()) {
            hideButtons(["rematchBtn", "resignBtn", "drawBtn", "undoBtn", "redoBtn"]);
        }
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
                initSinglePlayerGame(gameInfo, currentPlayerIsWhite, isRematch, gameInfo.watcher);
                break;

            default:
                break;
        }
    }
    await applyBookmarkFromUrlIfPresent();
    publishChessboardGlobals();
    try {
        document.dispatchEvent(new CustomEvent("shmerling-chessboard-ready"));
    } catch {
        /* ignore */
    }
}

async function applyBookmarkFromUrlIfPresent() {
    if (isMobileGameShell()) {
        return;
    }
    const params = new URLSearchParams(window.location.search);
    const bookmarkIdParam = params.get("bookmarkId");
    if (!bookmarkIdParam || gameType !== "SinglePlayerGame" || !gameInfo || !gameInfo.id) {return;}
    const list = await getBookmarks();
    const bookmarkObj = list.find(function (b) { return b._id === bookmarkIdParam; });
    if (!bookmarkObj) {return;}
    const stateStr = typeof bookmarkObj.state === "string" ? bookmarkObj.state : JSON.stringify(bookmarkObj.state);
    await postServerInfo("/applyBookmark", { gameId: gameInfo.id, bookarkId: bookmarkObj._id });
    game.loadGame(stateStr);
    const state = game.GameState;
    if (state && state.board) { drawBoard(state.board); }
    gameMoves = await getMovesForTable();
    updateMovesTable(gameMoves.moves);
    params.delete("bookmarkId");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);
}

function initPracticeGame(gameInfo, currentPlayerIsWhite) {
    if (gameInfo.mode != "review") {
        startWebSockets(gameInfo.username, currentPlayerIsWhite);
    }
    const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
    const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
    whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;
    blackPlayerInfoDiv.innerText = gameInfo.blackPlayerName;

    disableButtons(["rematchBtn", "drawBtn"]);
    enableButtons(["resignBtn", "redoBtn", "undoBtn", "lastMoveBtn", "homeBtn"]);
    hideButtons(["drawBtn"]);
    applyMousePreference(gameInfo.mousePreference || "drag");
}

function initOnlineGame(gameInfo, currentPlayerIsWhite, isRematch, isRejoined, isWatcher) {
    const blackNameKnown =
        gameInfo.blackPlayerName && String(gameInfo.blackPlayerName).trim().length > 0;
    const whiteDot = document.getElementById("whitePlayerStatus");
    const blackDot = document.getElementById("blackPlayerStatus");
    if (!isRematch && gameInfo.mode != "review") {
        startWebSockets(gameInfo.username, currentPlayerIsWhite, isWatcher);
        const waitingForAnonymousOpponent = !blackNameKnown;
        if (currentPlayerIsWhite && !isRejoined && !isRematch && !isWatcher && waitingForAnonymousOpponent) {
            putCloak();
        }
    }

    if (currentPlayerIsWhite) {
        const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
        whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;

        const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
        blackPlayerInfoDiv.innerText =
            (isRematch || isRejoined || isWatcher || blackNameKnown) ? gameInfo.blackPlayerName : "looking for opponent...";
        setPlayerStatusDot(whiteDot, "online");
        setPlayerStatusDot(
            blackDot,
            (isRematch || isRejoined || isWatcher || blackNameKnown) ? "online" : "offline"
        );

        disableButtons(["redoBtn", "undoBtn", "rematchBtn", "resignBtn", "drawBtn", "lastMoveBtn"]);
        hideButtons(["undoBtn", "redoBtn"]);
        if (isWatcher) {
            enableButtons(["lastMoveBtn", "homeBtn"]);
        } else if (isRematch || blackNameKnown) {
            /* Rematch or reload with opponent already in the game — same controls as after "opponent joined". */
            enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
            syncOnlineGameDrawButton();
        }
    }
    else {
        const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
        blackPlayerInfoDiv.innerText = gameInfo.username;
        const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
        whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;
        setPlayerStatusDot(blackDot, "online");
        setPlayerStatusDot(whiteDot, "online");

        disableButtons(["redoBtn", "undoBtn", "rematchBtn"]);
        hideButtons(["undoBtn", "redoBtn"]);
        if (isWatcher) {
            enableButtons(["lastMoveBtn", "homeBtn"]);
        } else {
            enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
            syncOnlineGameDrawButton();
        }
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

    if (!isWatcher) {
        applyMousePreference(gameInfo.mousePreference || "drag");
    }
}

let researchMode = false;
let researchSelected = null; // { color, pieceType } or "eraser" or "select"
let researchDraggingFrom = null; // { row, col } when dragging in select mode
let researchEditingBookmarkId = null; // bookmark id when editing position (Edit → Save flow)
let researchRunningBookmarkId = null; // bookmark id currently running from research
const researchBrainConfigState = {
    engine: "brain43",
    saved: null,
    draft: null,
    dirty: false,
};

function updateResearchCursor() {
    if (!researchMode) {return;}
    const innerBoard = document.getElementById("innerBoard");
    if (!innerBoard) {return;}
    if (researchSelected === "eraser") {
        innerBoard.setAttribute("data-research-cursor", "eraser");
    } else if (researchSelected === "select") {
        innerBoard.setAttribute("data-research-cursor", "select");
    } else if (researchSelected && typeof researchSelected === "object") {
        innerBoard.setAttribute("data-research-cursor", "place");
    } else {
        innerBoard.removeAttribute("data-research-cursor");
    }
}

function researchToolSelector() {
    return ".research-toolbox-piece, .research-toolbox-eraser, .research-toolbox-select";
}

function researchSelectTool() {
    researchSelected = "select";
    const panel = document.getElementById("researchToolbox");
    if (panel) {
        panel.querySelectorAll(researchToolSelector()).forEach(function (el) { el.classList.remove("selected"); });
        const selectBtn = panel.querySelector(".research-toolbox-select");
        if (selectBtn) {selectBtn.classList.add("selected");}
    }
    updateResearchCursor();
}

const RESEARCH_LAYOUT_KEYS = {
    toolbox: "researchLayoutToolbox",
    bookmarks: "researchLayoutBookmarks",
    brainConfig: "researchLayoutBrainConfig",
};

function applySavedPanelPosition(panelEl, storageKey, defaultLeft, defaultTop) {
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            const p = JSON.parse(raw);
            if (typeof p.left === "number" && typeof p.top === "number") {
                panelEl.style.left = p.left + "px";
                panelEl.style.top = p.top + "px";
                panelEl.style.right = "auto";
                panelEl.style.bottom = "auto";
                panelEl.style.transform = "none";
                return true;
            }
        }
    } catch { /* ignore */ }
    panelEl.style.left = defaultLeft + "px";
    panelEl.style.top = defaultTop + "px";
    panelEl.style.right = "auto";
    panelEl.style.bottom = "auto";
    panelEl.style.transform = "none";
    return false;
}

function setupDraggablePanel(panelEl, dragHandleEl, storageKey, getDefaultPosition) {
    const main = document.getElementById("main");
    if (!main || !panelEl || !dragHandleEl) {return;}
    function placeDefault() {
        const d = getDefaultPosition();
        applySavedPanelPosition(panelEl, storageKey, d.left, d.top);
    }
    placeDefault();
    requestAnimationFrame(function () { placeDefault(); });
    dragHandleEl.addEventListener("dblclick", function (e) {
        e.preventDefault();
        try {
            localStorage.removeItem(storageKey);
        } catch { /* ignore */ }
        const d = getDefaultPosition();
        applySavedPanelPosition(panelEl, storageKey, d.left, d.top);
    });
    dragHandleEl.addEventListener("mousedown", function (e) {
        if (e.button !== 0) {return;}
        if (e.target.closest("a")) {return;}
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = panelEl.offsetLeft;
        const startTop = panelEl.offsetTop;
        function onMove(ev) {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            let nl = startLeft + dx;
            let nt = startTop + dy;
            const maxL = Math.max(0, main.offsetWidth - panelEl.offsetWidth);
            const maxT = Math.max(0, main.offsetHeight - panelEl.offsetHeight);
            nl = Math.max(0, Math.min(maxL, nl));
            nt = Math.max(0, Math.min(maxT, nt));
            panelEl.style.left = nl + "px";
            panelEl.style.top = nt + "px";
            panelEl.style.right = "auto";
            panelEl.style.bottom = "auto";
            panelEl.style.transform = "none";
        }
        function onUp() {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            try {
                localStorage.setItem(storageKey, JSON.stringify({
                    left: panelEl.offsetLeft,
                    top: panelEl.offsetTop,
                }));
            } catch { /* ignore */ }
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    });
}

function initBookmarksPanelDraggable() {
    const bookmarksPanel = document.getElementById("bookmarksPanel");
    if (!bookmarksPanel) {return;}
    const header = bookmarksPanel.querySelector(".panelHeader");
    if (!header || header.dataset.dragSetup) {return;}
    header.dataset.dragSetup = "1";
    header.classList.add("bookmarksPanel-dragHandle");
    bookmarksPanel.classList.add("bookmarksPanel-draggable");
    setupDraggablePanel(bookmarksPanel, header, RESEARCH_LAYOUT_KEYS.bookmarks, function () {
        const m = document.getElementById("main");
        const board = document.getElementById("chessboard");
        const w = bookmarksPanel.offsetWidth || 260;
        const gap = 20;
        const boardRight = board && m ? (board.offsetLeft || 0) + (board.offsetWidth || 0) : m.offsetWidth;
        const left = m ? Math.min(m.offsetWidth - w - gap, boardRight + gap) : 400;
        return { left: left, top: gap };
    });
}

/**
 * Research: infer king/rook "moved" flags from the current board (home squares depend on `whitePlayerView`,
 * matching ChessGame / #getBoardViewSettings and castling column logic in #performMove).
 */
function researchIsKingOnSquare(board, row, col, color, KING) {
    const p = board[row] && board[row][col];
    return !!(p && p.color === color && p.pieceType === KING);
}
function researchIsRookOnSquare(board, row, col, color, ROOK) {
    const p = board[row] && board[row][col];
    return !!(p && p.color === color && p.pieceType === ROOK);
}
function researchSyncKingRookFlagsFromBoard(state) {
    if (!state || !state.board) {
        return;
    }
    const KING = game.KING;
    const ROOK = game.ROOK;
    const b = state.board;
    const wv = state.whitePlayerView !== false;
    var whiteRow;
    var blackRow;
    var wKingR;
    var wKingC;
    var bKingR;
    var bKingC;
    var ksCol;
    var qsCol;
    if (wv) {
        whiteRow = 7;
        blackRow = 0;
        wKingR = 7; wKingC = 4;
        bKingR = 0; bKingC = 4;
        ksCol = 7;
        qsCol = 0;
    } else {
        whiteRow = 0;
        blackRow = 7;
        wKingR = 0; wKingC = 3;
        bKingR = 7; bKingC = 3;
        ksCol = 0;
        qsCol = 7;
    }
    state.whiteKingMoved = !researchIsKingOnSquare(b, wKingR, wKingC, "white", KING);
    state.blackKingMoved = !researchIsKingOnSquare(b, bKingR, bKingC, "black", KING);
    state.kingsideWhiteRookMoved = !researchIsRookOnSquare(b, whiteRow, ksCol, "white", ROOK);
    state.queensideWhiteRookMoved = !researchIsRookOnSquare(b, whiteRow, qsCol, "white", ROOK);
    state.kingsideBlackRookMoved = !researchIsRookOnSquare(b, blackRow, ksCol, "black", ROOK);
    state.queensideBlackRookMoved = !researchIsRookOnSquare(b, blackRow, qsCol, "black", ROOK);
}

function initResearchMode() {
    researchMode = true;
    document.body.classList.add("research-mode");
    gameInfo = { gameType: "Research", username: "", id: null };
    currentPlayerIsWhite = true;
    gameType = "Research";
    registerGameEvents();
    resetSqaureColor();
    game.startNewGame(true);
    const state = JSON.parse(JSON.stringify(game.GameState));
    state.board = Array.from({ length: game.BOARD_ROWS }, () => Array(game.BOARD_COLUMNS).fill(null));
    researchSyncKingRookFlagsFromBoard(state);
    game.loadGame(JSON.stringify(state));
    const innerBoardEl = document.getElementById("innerBoard");
    if (innerBoardEl) {innerBoardEl.classList.add("research-no-animate");}
    createResearchToolbox();
    createResearchBrainConfigPanel();
    loadResearchBrainConfig("brain43");
    registerResearchBoardClick();
    addOptionsButtons();
    const bookmarkBtnEl = document.getElementById("bookmarkBtn");
    if (bookmarkBtnEl) {bookmarkBtnEl.remove();}
    generateMoveButtons();
    registerWindowEvents();
    disableButtons(["rematchBtn", "resignBtn", "drawBtn", "undoBtn", "redoBtn", "lastMoveBtn"]);
    hideButtons(["undoBtn", "redoBtn", "lastMoveBtn"]);
    enableButtons(["homeBtn"]);
    getBookmarks().then(function (list) {
        bookmarks = list;
        updateBookmarks(bookmarks);
        applyResearchBookmarkFromUrlIfPresent();
    });
    const controlPanel = document.querySelector(".controlPanel");
    if (controlPanel) {controlPanel.classList.add("research-simplified");}
    const bookmarksPanel = document.getElementById("bookmarksPanel");
    if (bookmarksPanel) {
        bookmarksPanel.style.opacity = "1";
        bookmarksPanel.style.width = "260px";
        requestAnimationFrame(function () { initBookmarksPanelDraggable(); });
    }
}

function applyResearchBookmarkFromUrlIfPresent() {
    const params = new URLSearchParams(window.location.search);
    const bookmarkIdParam = params.get("bookmarkId");
    if (!bookmarkIdParam) {return;}
    const bookmarkObj = bookmarks.find(function (b) { return b._id === bookmarkIdParam; });
    if (!bookmarkObj) {return;}
    const stateStr = typeof bookmarkObj.state === "string" ? bookmarkObj.state : JSON.stringify(bookmarkObj.state);
    const loaded = JSON.parse(stateStr);
    researchSyncKingRookFlagsFromBoard(loaded);
    game.loadGame(JSON.stringify(loaded));
    const state = game.GameState;
    if (state && state.board) { drawBoard(state.board); }
    const div = document.getElementById("bookmark" + bookmarkObj.id);
    if (div) {
        exitBookmarkPositionEditMode();
        researchEditingBookmarkId = bookmarkObj.id;
        div.classList.add("bookmark-editing");
        const editBtnEl = div.querySelector(".bookmark-edit-save-btn");
        if (editBtnEl) {
            editBtnEl.disabled = true;
        }
        disableButtons(["addBookmarkBtn"]);
        researchSelectTool();
    }
    params.delete("bookmarkId");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);
}

function createResearchToolbox() {
    const panel = document.createElement("div");
    panel.id = "researchToolbox";
    panel.className = "research-toolbox";
    const titleBar = document.createElement("div");
    titleBar.className = "research-toolbox-titlebar";
    titleBar.textContent = "Toolbox";
    panel.appendChild(titleBar);
    const pieceOrder = [game.KING, game.QUEEN, game.ROOK, game.BISHOP, game.KNIGHT, game.PAWN];
    const whiteCol = document.createElement("div");
    whiteCol.className = "research-toolbox-column";
    pieceOrder.forEach(function (pieceType) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "research-toolbox-piece";
        btn.setAttribute("data-color", "white");
        btn.setAttribute("data-piece", String(pieceType));
        const img = document.createElement("img");
        img.src = whitePiecesURL[pieceType];
        img.alt = "White piece";
        btn.appendChild(img);
        btn.onclick = function () { researchSelected = { color: "white", pieceType: pieceType }; panel.querySelectorAll(researchToolSelector()).forEach(function (el) { el.classList.remove("selected"); }); btn.classList.add("selected"); updateResearchCursor(); };
        whiteCol.appendChild(btn);
    });
    const blackCol = document.createElement("div");
    blackCol.className = "research-toolbox-column";
    pieceOrder.forEach(function (pieceType) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "research-toolbox-piece";
        btn.setAttribute("data-color", "black");
        btn.setAttribute("data-piece", String(pieceType));
        const img = document.createElement("img");
        img.src = blackPiecesURL[pieceType];
        img.alt = "Black piece";
        btn.appendChild(img);
        btn.onclick = function () { researchSelected = { color: "black", pieceType: pieceType }; panel.querySelectorAll(researchToolSelector()).forEach(function (el) { el.classList.remove("selected"); }); btn.classList.add("selected"); updateResearchCursor(); };
        blackCol.appendChild(btn);
    });
    const columnsWrap = document.createElement("div");
    columnsWrap.className = "research-toolbox-columns";
    columnsWrap.appendChild(whiteCol);
    columnsWrap.appendChild(blackCol);
    panel.appendChild(columnsWrap);
    const toolsRow = document.createElement("div");
    toolsRow.className = "research-toolbox-tools";
    const eraserBtn = document.createElement("button");
    eraserBtn.type = "button";
    eraserBtn.className = "research-toolbox-eraser";
    eraserBtn.setAttribute("title", "Eraser");
    eraserBtn.setAttribute("aria-label", "Eraser – remove piece from square");
    eraserBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21\"/><path d=\"M22 21H7\"/><path d=\"m5 11 9 9\"/></svg>";
    eraserBtn.onclick = function () { researchSelected = "eraser"; panel.querySelectorAll(researchToolSelector()).forEach(function (el) { el.classList.remove("selected"); }); eraserBtn.classList.add("selected"); updateResearchCursor(); };
    toolsRow.appendChild(eraserBtn);
    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "research-toolbox-select";
    selectBtn.setAttribute("title", "Select");
    selectBtn.setAttribute("aria-label", "Select – drag pieces to move them");
    selectBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0\"/><path d=\"M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2\"/><path d=\"M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8\"/><path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\"/></svg>";
    selectBtn.onclick = function () { researchSelected = "select"; panel.querySelectorAll(researchToolSelector()).forEach(function (el) { el.classList.remove("selected"); }); selectBtn.classList.add("selected"); updateResearchCursor(); };
    toolsRow.appendChild(selectBtn);
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "research-toolbox-reset";
    resetBtn.setAttribute("title", "Reset");
    resetBtn.setAttribute("aria-label", "Reset – clear all pieces");
    resetBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/></svg>";
    resetBtn.onclick = function () {
        const state = JSON.parse(JSON.stringify(game.GameState));
        state.board = Array.from({ length: game.BOARD_ROWS }, () => Array(game.BOARD_COLUMNS).fill(null));
        researchSyncKingRookFlagsFromBoard(state);
        game.loadGame(JSON.stringify(state));
        researchSelected = { color: "white", pieceType: game.PAWN };
        panel.querySelectorAll(researchToolSelector()).forEach(function (el) { el.classList.remove("selected"); });
        const whitePawnBtn = panel.querySelector(".research-toolbox-piece[data-color=\"white\"][data-piece=\"" + game.PAWN + "\"]");
        if (whitePawnBtn) {whitePawnBtn.classList.add("selected");}
        updateResearchCursor();
    };
    toolsRow.appendChild(resetBtn);
    const defaultPosBtn = document.createElement("button");
    defaultPosBtn.type = "button";
    defaultPosBtn.className = "research-toolbox-default";
    defaultPosBtn.setAttribute("title", "Default position");
    defaultPosBtn.setAttribute("aria-label", "Default position – set up standard starting position");
    defaultPosBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\"/></svg>";
    defaultPosBtn.onclick = function () {
        const whitePlayerView = game.GameState && game.GameState.whitePlayerView !== false;
        game.startNewGame(whitePlayerView);
        researchSelected = "eraser";
        panel.querySelectorAll(researchToolSelector()).forEach(function (el) { el.classList.remove("selected"); });
        eraserBtn.classList.add("selected");
        updateResearchCursor();
    };
    toolsRow.appendChild(defaultPosBtn);
    panel.appendChild(toolsRow);
    const main = document.getElementById("main");
    if (main) {main.insertBefore(panel, main.firstChild);}
    setupDraggablePanel(panel, titleBar, RESEARCH_LAYOUT_KEYS.toolbox, function () {
        const m = document.getElementById("main");
        const board = document.getElementById("chessboard");
        const w = panel.offsetWidth || 120;
        const h = panel.offsetHeight || 200;
        const gap = 20;
        const left = board && m ? Math.max(gap, (board.offsetLeft || 0) - w - gap) : gap;
        const top = m ? Math.max(gap, (m.offsetHeight - h) / 2) : 80;
        return { left: left, top: top };
    });
}

function getResearchConfigEngineLabel(engineName) {
    const match = getBookmarkBrainOptions().find(function (opt) { return opt.value === engineName; });
    return match ? match.label : engineName;
}

function getResearchActiveEngine() {
    if (researchRunningBookmarkId != null) {
        const runningBookmark = bookmarks.find(function (el) { return el.id == researchRunningBookmarkId; });
        if (runningBookmark && runningBookmark.engine) {
            return normalizeBookmarkEngine(runningBookmark.engine);
        }
    }
    if (gameInfo && gameInfo.engine) {
        return normalizeBookmarkEngine(gameInfo.engine);
    }
    return "brain43";
}

function setResearchConfigDirtyState(dirty) {
    researchBrainConfigState.dirty = !!dirty;
    const panel = document.getElementById("researchBrainConfig");
    if (!panel) {
        return;
    }
    panel.classList.toggle("is-dirty", !!dirty);
    const saveBtn = panel.querySelector(".research-brain-config-save");
    const discardBtn = panel.querySelector(".research-brain-config-discard");
    if (saveBtn) {saveBtn.disabled = !dirty;}
    if (discardBtn) {discardBtn.disabled = !dirty;}
}

/**
 * Build research table rows from the server-loaded config for the selected engine (no client-side defaults).
 * @param {object|null|undefined} config
 * @returns {{ label: string, section: string, key: string }[]}
 */
function getBrainConfigFieldDefsFromConfig(config) {
    const fields = [];
    const cfg = config && typeof config === "object" ? config : {};
    const pieceScores = cfg.pieceScores && typeof cfg.pieceScores === "object" ? cfg.pieceScores : {};
    for (let i = 0; i < BRAIN_CONFIG_PIECE_KEYS.length; i++) {
        const key = BRAIN_CONFIG_PIECE_KEYS[i];
        if (Object.prototype.hasOwnProperty.call(pieceScores, key)) {
            fields.push({ label: key, section: "pieceScores", key: key });
        }
    }
    const se = cfg.specialEvaluations && typeof cfg.specialEvaluations === "object" ? cfg.specialEvaluations : {};
    const specialKeys = Object.keys(se).sort();
    for (let j = 0; j < specialKeys.length; j++) {
        const sk = specialKeys[j];
        fields.push({ label: sk, section: "specialEvaluations", key: sk });
    }
    return fields;
}

function renderResearchBrainConfigTable() {
    const panel = document.getElementById("researchBrainConfig");
    if (!panel) {
        return;
    }
    const tbody = panel.querySelector(".research-brain-config-table tbody");
    if (!tbody) {
        return;
    }
    tbody.innerHTML = "";
    const cfg = researchBrainConfigState.draft || researchBrainConfigState.saved || {};
    const fields = getBrainConfigFieldDefsFromConfig(cfg);

    function makeFieldNameAndValueCells(field) {
        const sectionDraft = researchBrainConfigState.draft && researchBrainConfigState.draft[field.section]
            ? researchBrainConfigState.draft[field.section]
            : {};
        const nameCell = document.createElement("td");
        nameCell.className = "research-brain-config-name";
        nameCell.textContent = field.label;
        const valueCell = document.createElement("td");
        valueCell.className = "research-brain-config-value";
        const input = document.createElement("input");
        input.type = "number";
        input.step = "0.01";
        input.value = String(sectionDraft[field.key] != null ? sectionDraft[field.key] : 0);
        input.setAttribute("data-config-section", field.section);
        input.setAttribute("data-config-key", field.key);
        input.addEventListener("input", function () {
            const parsed = Number(input.value);
            if (!researchBrainConfigState.draft) {
                researchBrainConfigState.draft = {};
            }
            if (!researchBrainConfigState.draft[field.section]) {
                researchBrainConfigState.draft[field.section] = {};
            }
            researchBrainConfigState.draft[field.section][field.key] = Number.isFinite(parsed) ? parsed : 0;
            const isDirty = fields.some(function (f) {
                const draftVal = researchBrainConfigState.draft && researchBrainConfigState.draft[f.section]
                    ? researchBrainConfigState.draft[f.section][f.key]
                    : undefined;
                const savedVal = researchBrainConfigState.saved && researchBrainConfigState.saved[f.section]
                    ? researchBrainConfigState.saved[f.section][f.key]
                    : undefined;
                return Number(draftVal) !== Number(savedVal);
            });
            setResearchConfigDirtyState(isDirty);
        });
        valueCell.appendChild(input);
        return { nameCell: nameCell, valueCell: valueCell };
    }

    for (let i = 0; i < fields.length; i += 2) {
        const row = document.createElement("tr");
        const a = makeFieldNameAndValueCells(fields[i]);
        row.appendChild(a.nameCell);
        row.appendChild(a.valueCell);
        if (i + 1 < fields.length) {
            const b = makeFieldNameAndValueCells(fields[i + 1]);
            row.appendChild(b.nameCell);
            row.appendChild(b.valueCell);
        } else {
            row.appendChild(document.createElement("td"));
            row.appendChild(document.createElement("td"));
        }
        tbody.appendChild(row);
    }
}

async function loadResearchBrainConfig(engineName) {
    const safeEngine = normalizeBookmarkEngine(engineName);
    researchBrainConfigState.engine = safeEngine;
    const panel = document.getElementById("researchBrainConfig");
    if (panel) {
        const statusEl = panel.querySelector(".research-brain-config-status");
        if (statusEl) {
            statusEl.textContent = "Loading...";
        }
    }
    const response = await getServerInfo("/brain-config?engine=" + encodeURIComponent(safeEngine));
    let loadedConfig;
    if (response && response.config != null && typeof response.config === "object") {
        loadedConfig = response.config;
    } else {
        console.error("[Research] /brain-config missing config for engine:", safeEngine, response);
        loadedConfig = { pieceScores: {}, specialEvaluations: {} };
    }
    researchBrainConfigState.saved = JSON.parse(JSON.stringify(loadedConfig));
    researchBrainConfigState.draft = JSON.parse(JSON.stringify(loadedConfig));
    renderResearchBrainConfigTable();
    setResearchConfigDirtyState(false);
    if (panel) {
        const statusEl = panel.querySelector(".research-brain-config-status");
        if (statusEl) {
            statusEl.textContent = getResearchConfigEngineLabel(safeEngine);
        }
    }
}

async function saveResearchBrainConfig() {
    const engine = researchBrainConfigState.engine || getResearchActiveEngine();
    const response = await postServerInfo("/brain-config", {
        engine: engine,
        config: researchBrainConfigState.draft || { pieceScores: {} },
    });
    const savedConfig = response && response.config ? response.config : researchBrainConfigState.draft;
    researchBrainConfigState.saved = JSON.parse(JSON.stringify(savedConfig));
    researchBrainConfigState.draft = JSON.parse(JSON.stringify(savedConfig));
    renderResearchBrainConfigTable();
    setResearchConfigDirtyState(false);
}

function discardResearchBrainConfigChanges() {
    if (!researchBrainConfigState.saved) {
        return;
    }
    researchBrainConfigState.draft = JSON.parse(JSON.stringify(researchBrainConfigState.saved));
    renderResearchBrainConfigTable();
    setResearchConfigDirtyState(false);
}

function syncBrainConfigPanelEngine(engineName) {
    const panel = document.getElementById("researchBrainConfig");
    if (!panel) {
        return;
    }
    const select = panel.querySelector(".research-brain-engine-select");
    const safeEngine = normalizeBookmarkEngine(engineName);
    if (select) {
        select.value = safeEngine;
    }
    loadResearchBrainConfig(safeEngine).catch(function (error) {
        console.error("Failed to sync brain config panel engine:", error);
    });
}

function createResearchBrainConfigPanel() {
    if (document.getElementById("researchBrainConfig")) {
        return;
    }
    const panel = document.createElement("div");
    panel.id = "researchBrainConfig";
    panel.className = "research-brain-config";
    const titleBar = document.createElement("div");
    titleBar.className = "research-brain-config-titlebar";
    titleBar.textContent = "Brain Config";
    panel.appendChild(titleBar);

    const body = document.createElement("div");
    body.className = "research-brain-config-body";

    const topRow = document.createElement("div");
    topRow.className = "research-brain-config-row";
    const engineLabel = document.createElement("label");
    engineLabel.textContent = "Engine";
    engineLabel.setAttribute("for", "researchBrainEngineSelect");
    const engineSelect = document.createElement("select");
    engineSelect.id = "researchBrainEngineSelect";
    engineSelect.className = "research-brain-engine-select";
    getBookmarkBrainOptions().forEach(function (opt) {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        engineSelect.appendChild(option);
    });
    engineSelect.value = getResearchActiveEngine();
    engineSelect.addEventListener("change", function () {
        loadResearchBrainConfig(engineSelect.value).catch(function (error) {
            console.error("Failed to load brain config:", error);
            alertMessageBox("Failed to load brain config.");
        });
    });
    topRow.appendChild(engineLabel);
    topRow.appendChild(engineSelect);
    body.appendChild(topRow);

    const status = document.createElement("div");
    status.className = "research-brain-config-status";
    status.textContent = getResearchConfigEngineLabel(engineSelect.value);
    body.appendChild(status);

    const table = document.createElement("table");
    table.className = "research-brain-config-table";
    table.innerHTML = "<thead><tr><th>Property</th><th>Value</th><th>Property</th><th>Value</th></tr></thead><tbody></tbody>";
    body.appendChild(table);

    const actions = document.createElement("div");
    actions.className = "research-brain-config-actions";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "button research-brain-config-save";
    saveBtn.textContent = "Save";
    saveBtn.disabled = true;
    saveBtn.addEventListener("click", function () {
        saveResearchBrainConfig().catch(function (error) {
            console.error("Failed to save brain config:", error);
            alertMessageBox("Failed to save brain config.");
        });
    });
    const discardBtn = document.createElement("button");
    discardBtn.type = "button";
    discardBtn.className = "button research-brain-config-discard";
    discardBtn.textContent = "Discard";
    discardBtn.disabled = true;
    discardBtn.addEventListener("click", function () {
        discardResearchBrainConfigChanges();
    });
    actions.appendChild(saveBtn);
    actions.appendChild(discardBtn);
    body.appendChild(actions);

    panel.appendChild(body);
    const main = document.getElementById("main");
    if (main) {
        main.insertBefore(panel, main.firstChild);
    }
    setupDraggablePanel(panel, titleBar, RESEARCH_LAYOUT_KEYS.brainConfig, function () {
        const m = document.getElementById("main");
        const board = document.getElementById("chessboard");
        const gap = 20;
        const width = panel.offsetWidth || 260;
        const left = board && m ? Math.max(gap, (board.offsetLeft || 0) - width - gap) : gap;
        return { left: left, top: 20 };
    });
}

function registerResearchBoardClick() {
    const innerBoard = document.getElementById("innerBoard");
    if (!innerBoard) {return;}

    innerBoard.addEventListener("click", function researchBoardClick(ev) {
        if (!researchMode) {return;}
        if (researchSelected === "select") {return;}
        const square = ev.target.closest(".square");
        if (!square) {return;}
        const row = parseInt(square.getAttribute("data-row"), 10);
        const col = parseInt(square.getAttribute("data-col"), 10);
        if (isNaN(row) || isNaN(col)) {return;}
        const state = JSON.parse(JSON.stringify(game.GameState));
        if (researchSelected === "eraser") {
            state.board[row][col] = null;
        } else if (researchSelected && typeof researchSelected === "object") {
            state.board[row][col] = { color: researchSelected.color, pieceType: researchSelected.pieceType };
        } else {return;}
        researchSyncKingRookFlagsFromBoard(state);
        game.loadGame(JSON.stringify(state));
    });

    innerBoard.addEventListener("mousedown", function researchBoardMouseDown(ev) {
        if (!researchMode || researchSelected !== "select") {return;}
        const square = ev.target.closest(".square");
        if (!square) {return;}
        const row = parseInt(square.getAttribute("data-row"), 10);
        const col = parseInt(square.getAttribute("data-col"), 10);
        if (isNaN(row) || isNaN(col)) {return;}
        const state = game.GameState;
        if (!state.board[row][col]) {return;}
        researchDraggingFrom = { row: row, col: col };
        document.body.classList.add("research-dragging");
    });

    document.addEventListener("mouseup", function researchBoardMouseUp(ev) {
        if (!researchDraggingFrom) {return;}
        const inner = document.getElementById("innerBoard");
        if (!inner) { researchDraggingFrom = null; document.body.classList.remove("research-dragging"); return; }
        if (typeof draggedImage !== "undefined" && draggedImage) {
            draggedImage.style.pointerEvents = "none";
        }
        const targetEl = document.elementFromPoint(ev.clientX, ev.clientY);
        if (typeof draggedImage !== "undefined" && draggedImage) {
            draggedImage.style.pointerEvents = "";
        }
        const targetSquare = targetEl && targetEl.closest ? targetEl.closest(".square") : null;
        if (targetSquare && inner.contains(targetSquare)) {
            const targetRow = parseInt(targetSquare.getAttribute("data-row"), 10);
            const targetCol = parseInt(targetSquare.getAttribute("data-col"), 10);
            const sr = researchDraggingFrom.row;
            const sc = researchDraggingFrom.col;
            if (!isNaN(targetRow) && !isNaN(targetCol) && (targetRow !== sr || targetCol !== sc)) {
                const state = JSON.parse(JSON.stringify(game.GameState));
                state.board[targetRow][targetCol] = state.board[sr][sc];
                state.board[sr][sc] = null;
                researchSyncKingRookFlagsFromBoard(state);
                game.loadGame(JSON.stringify(state));
            }
        }
        researchDraggingFrom = null;
        document.body.classList.remove("research-dragging");
    });
}

function initSinglePlayerGame(gameInfo, currentPlayerIsWhite, isRematch, isWatcher) {
    if (!isRematch && gameInfo.mode != "review") {
        startWebSockets(gameInfo.username, currentPlayerIsWhite, isWatcher);
    }

    const whitePlayerInfoDiv = document.getElementById("whitePlayerName");
    whitePlayerInfoDiv.innerText = gameInfo.whitePlayerName;

    const blackPlayerInfoDiv = document.getElementById("blackPlayerName");
    blackPlayerInfoDiv.innerText = gameInfo.blackPlayerName;

    setPlayerStatusDot(document.getElementById("whitePlayerStatus"), "online");
    setPlayerStatusDot(document.getElementById("blackPlayerStatus"), "online");

    disableButtons(["rematchBtn", "redoBtn", "undoBtn", "drawBtn"]);
    if (isWatcher) {
        disableButtons(["resignBtn", "bookmarkBtn"]);
        enableButtons(["lastMoveBtn", "homeBtn"]);
    } else {
        enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
    }
    hideButtons(["undoBtn", "redoBtn"]);

    applyMousePreference(gameInfo.mousePreference);
}

function applyMousePreference(preference) {
    const stored = preference != null ? preference : ((typeof gameInfo !== "undefined" && gameInfo && gameInfo.mousePreference) || "drag");
    const effective = shouldUseTapToMoveOnTouchShell() ? "double" : stored;

    clickToMoveSelected = null;
    const innerBoard = document.getElementById("innerBoard");
    if (!innerBoard) { return; }
    innerBoard.removeEventListener("click", onBoardClickToMove);
    if (effective === "double") {
        innerBoard.classList.add("move-mode-double");
        const pieces = document.querySelectorAll("#innerBoard .square img");
        pieces.forEach(function (img) {
            const isOurPiece = currentPlayerIsWhite && img.src.indexOf("white") !== -1 ||
                !currentPlayerIsWhite && img.src.indexOf("black") !== -1;
            if (isOurPiece) {
                img.setAttribute("class", "nondraggable");
            }
        });
        innerBoard.addEventListener("click", onBoardClickToMove);
    } else {
        innerBoard.classList.remove("move-mode-double");
        document.querySelectorAll("#innerBoard .square img").forEach(function (img) {
            img.setAttribute("class", "draggable");
            if (!researchMode && gameType != "PracticeGame") {
                if (currentPlayerIsWhite && img.src.indexOf("black") != -1 ||
                    !currentPlayerIsWhite && img.src.indexOf("white") != -1) {
                    img.setAttribute("class", "nondraggable");
                }
            }
            if (!researchMode && gameInfo && gameInfo.mode == "review") {
                img.setAttribute("class", "nondraggable");
            }
        });
    }
}

function onBoardClickToMove(e) {
    if (gameInfo.mode === "review" || game.GameOver) { return; }
    if (gameInfo && gameInfo.watcher) { return; }
    /* Listener is only attached in double-click mode; tryMove supports online play. */
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
            square.classList.add("optionSource");
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
        square.classList.add("optionSource");
        if (gameInfo.showAvailableMoves !== false) {
            const options = game.possibleMoves(pos);
            for (const option of options) {
                guiBoard[option.target.row][option.target.col].classList.add("option");
            }
        }
        return;
    }
    tryMove(clickToMoveSelected, pos).then(function () {
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
    game.OnDraw = drawEventHandler;
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
    if (shouldUseTapToMoveOnTouchShell() && typeof gameInfo !== "undefined" && gameInfo) {
        applyMousePreference(gameInfo.mousePreference || "drag");
    }
    applyCheckedKingSquareHighlight();
}

/**
 * True when the square's current <img> already matches `piece` (or both empty).
 * Used to avoid wiping/recreating every piece image on each move (mobile blink).
 * Compares by piece filename so relative vs absolute / themed vs legacy URLs still match.
 */
function pieceMatchesSquareCell(cell, piece) {
    const img = cell && cell.querySelector("img");
    if (!piece) {
        return !img;
    }
    if (!img) {
        return false;
    }
    const url = getImageUrl(piece);
    if (!url) {
        return false;
    }
    const srcAttr = img.getAttribute("src") || "";
    if (srcAttr === url) {
        return true;
    }
    if (img.src && img.src.indexOf(url) !== -1) {
        return true;
    }
    /* Basename match: ".../black-pawn.png" vs "images/black-pawn.png" */
    const wanted = String(url).split("/").pop();
    const have = String(srcAttr || img.src || "").split("/").pop();
    return !!(wanted && have && wanted === have);
}

/**
 * Incremental board paint: only rebuild squares whose piece actually changed.
 */
function patchBoardFromState(board) {
    if (!board || !guiBoard[0] || guiBoard[0][0] == null) {
        return;
    }
    if (typeof syncWebPieceUrlArrays === "function") {
        syncWebPieceUrlArrays();
    }
    let changed = false;
    for (let i = 0; i < game.BOARD_ROWS; i++) {
        for (let j = 0; j < game.BOARD_COLUMNS; j++) {
            const div = findSquareDivElement(i, j);
            if (!div) {
                continue;
            }
            if (pieceMatchesSquareCell(div, board[i][j])) {
                continue;
            }
            changed = true;
            div.innerHTML = "";
            const url = getImageUrl(board[i][j]);
            if (url) {
                placePiece(url, i, j);
            }
        }
    }
    if (changed) {
        if (shouldUseTapToMoveOnTouchShell() && typeof gameInfo !== "undefined" && gameInfo) {
            applyMousePreference(gameInfo.mousePreference || "drag");
        } else if (typeof gameInfo !== "undefined" && gameInfo && gameInfo.mousePreference === "double") {
            applyMousePreference("double");
        }
    }
    applyCheckedKingSquareHighlight();
}

/**
 * After animating a remote/engine move, leave the piece on the target square so
 * the following makeMove soft-patch does not recreate all images.
 */
function settleAnimatedPieceOnTarget(move, img) {
    if (!move || !img || !move.target) {
        return;
    }
    const targetDiv = findSquareDivElement(move.target.row, move.target.col);
    if (!targetDiv) {
        return;
    }
    img.style.position = "relative";
    img.style.marginLeft = "0px";
    img.style.marginTop = "0px";
    img.style.left = "0px";
    img.style.top = "0px";
    img.style.zIndex = "";
    targetDiv.innerHTML = "";
    targetDiv.appendChild(img);
}

/**
 * Highlights the king square of the side to move when that side is in check (including checkmate).
 */
function applyCheckedKingSquareHighlight() {
    if (!game || guiBoard[0][0] == null) {
        return;
    }
    for (let i = 0; i < game.BOARD_ROWS; i++) {
        for (let j = 0; j < game.BOARD_COLUMNS; j++) {
            guiBoard[i][j].classList.remove("king-in-check");
        }
    }
    if (!game.Check) {
        return;
    }
    const stateBoard = game.GameState && game.GameState.board;
    if (!stateBoard) {
        return;
    }
    const kingType = game.KING;
    const turn = game.Turn;
    for (let r = 0; r < game.BOARD_ROWS; r++) {
        for (let c = 0; c < game.BOARD_COLUMNS; c++) {
            const p = stateBoard[r][c];
            if (p && p.pieceType === kingType && p.color === turn) {
                guiBoard[r][c].classList.add("king-in-check");
                return;
            }
        }
    }
}

/**
 * Syncs the board/captured pieces from the current game state without running OnUpdate side effects
 * (check alerts, moves table refresh, etc.). Used after animateMove so forceUpdate does not re-fire
 * check UI for the same position before the incoming makeMove is applied.
 */
function syncBoardFromGameStateOnly() {
    const state = game.GameState;
    if (state && state.board) {
        patchBoardFromState(state.board);
        updateCaptureLists(state.capturedPiecesList || []);
    }
    if (typeof gameInfo !== "undefined" && gameInfo && gameInfo.mousePreference === "double") {
        applyMousePreference("double");
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
    // Native HTML5 image drag would fight our pointer-based dragging (Firefox ignores -webkit-user-drag).
    img.draggable = false;

    if (!researchMode && gameType != "PracticeGame") {
        if (currentPlayerIsWhite && img.src.indexOf("black") != -1 ||
            !currentPlayerIsWhite && img.src.indexOf("white") != -1) {
            img.setAttribute("class", "nondraggable");
        }
    }
    if (!researchMode && gameInfo.mode == "review") { img.setAttribute("class", "nondraggable"); }

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
    if (!divWhite || !divBlack) {
        return;
    }

    divWhite.innerHTML = "";
    divBlack.innerHTML = "";

    const list = Array.isArray(captured) ? captured : [];
    for (let i = 0; i < list.length; i++) {
        const element = list[i];
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
    if (gameInfo?.watcher) {
        disableButtons(["resignBtn"]);
    }
    //document.getElementById("rematchBtn").classList.add("btnDisabled");
}

/** Full clock per side (seconds) from server gameInfo, or default 90 min. */
function initialClockSecondsFromGameInfo() {
    const fallback = 90 * 60;
    if (typeof gameInfo === "undefined" || !gameInfo) {
        return fallback;
    }
    if (typeof gameInfo.whiteTimer === "number" && gameInfo.whiteTimer > 0) {
        return gameInfo.whiteTimer;
    }
    if (typeof gameInfo.gameTimeMinutes === "number" && gameInfo.gameTimeMinutes >= 1) {
        return Math.round(gameInfo.gameTimeMinutes * 60);
    }
    return fallback;
}

function resetClocks() {
    clearInterval(whiteHandle);
    clearInterval(blackHandle);
    whiteHandle = null;
    blackHandle = null;
    whiteTimer = initialClockSecondsFromGameInfo();
    blackTimer =
        typeof gameInfo !== "undefined" && gameInfo && typeof gameInfo.blackTimer === "number" && gameInfo.blackTimer > 0
            ? gameInfo.blackTimer
            : whiteTimer;
    if (typeof game !== "undefined" && game) {
        try {
            game.GameTimeLength = whiteTimer;
        } catch {
            /* ignore if client game has no setter */
        }
    }
    const whiteClock = document.getElementById("whiteClockTimeText");
    const blackClock = document.getElementById("blackClockTimeText");
    if (whiteClock) {
        whiteClock.innerText = timerToText(whiteTimer);
    }
    if (blackClock) {
        blackClock.innerText = timerToText(blackTimer);
    }
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
    applyCheckedKingSquareHighlight();
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
        //menuSaveEventHandler();
        promotingMode = true;
        dialogOn = true;
        showPromotionDialog(turn, (selectedPiece) => {
            lastMove.selectedPiece = selectedPiece;
            game.completePromotion(lastMove);
            if (gameType === "OnlineGame" || gameType === "SinglePlayerGame") {
                sendMove(lastMove);
            }
            if (gameType === "PracticeGame") {
                gameMoves = { moves: game.Moves || [] };
                updateMovesTable(gameMoves.moves);
            }
            console.log("promotion completed:");
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

function showPromotionDialog(promotingColor, callback) {

    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = createCloak();
    const promotionBox = createPromotionBox(promotingColor);
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
function createPromotionBox(promotingColor) {


    const promotionDivSelection = document.createElement("div");
    promotionDivSelection.setAttribute("class", "promotionSelectionBox");
    promotionDivSelection.setAttribute("id", "promotionSelectionBox");
    const pieceUrls = promotingColor === "black" ? blackPiecesURL : whitePiecesURL;
    for (let i = game.KNIGHT; i <= game.QUEEN; i++) {
        const piece = createPiece(pieceUrls[i]);
        piece.setAttribute("class", "promotionPiece");
        piece.setAttribute("alt", i);
        piece.onclick = promotionSelected;
        promotionDivSelection.appendChild(piece);
    }

    // cloakDiv.appendChild(promotionDivSelection);
    return promotionDivSelection;
}

/**
 * Displays a flash message on special events. Empty string clears any visible flash and pending auto-dismiss.
 *
 * @param {string} message - Text to show. On desktop, HTML is supported via `innerHTML` on the top bar only.
 * @param {number} [durationMs] - On **mobile** (`body.mobile-game-shell`), every message uses the board-centered
 *   overlay. If this is a positive number, the message is removed after that many ms; otherwise a default
 *   (see `MOBILE_BOARD_FLASH_DEFAULT_MS`) applies. On desktop, this argument is ignored (legacy top bar + CSS).
 */
function displayMessage(message, durationMs) {
    if (flashDismissTimerId != null) {
        clearTimeout(flashDismissTimerId);
        flashDismissTimerId = null;
    }

    const existing = document.getElementById("flash");
    if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
    }

    if (!message) {
        return;
    }

    const chessboardDiv = document.getElementById("chessboard");
    if (isMobileGameShell() && chessboardDiv) {
        const duration = (typeof durationMs === "number" && durationMs > 0)
            ? durationMs
            : MOBILE_BOARD_FLASH_DEFAULT_MS;
        const div = document.createElement("div");
        div.id = "flash";
        div.className = "board-flash-message";
        div.setAttribute("role", "status");
        div.setAttribute("aria-live", "polite");
        div.textContent = message;
        chessboardDiv.appendChild(div);
        flashDismissTimerId = setTimeout(function () {
            flashDismissTimerId = null;
            const flash = document.getElementById("flash");
            if (flash && flash.classList.contains("board-flash-message")) {
                flash.parentNode.removeChild(flash);
            }
        }, duration);
        return;
    }

    const div = document.createElement("div");
    div.id = "flash";
    div.classList.add("topbarMessages");
    div.classList.add("flash-message");
    div.innerHTML = message;
    document.body.appendChild(div);
}

/// MessageBox

/**
 * Validate research bookmark position (kings + adjacency + insufficient material + piece counts per color).
 * Returns one user-facing error (header + detail) or null if valid.
 * Checks run in order; only the first failure is returned so the user can fix and retry.
 * @param {"add"|"save"} [purpose] "add" when creating a bookmark; "save" when saving position in edit mode.
 */
function getResearchBookmarkPositionValidationMessage(purpose) {
    const header = purpose === "save"
        ? "Cannot save this bookmark:\n\n"
        : "Cannot add this bookmark:\n\n";

    const g = game;
    if (!g || !g.GameState) {
        return header + "Could not read the board. Try again after the board has loaded.";
    }

    /* Snapshot like loadGame/save would see; avoids stale refs. Same dimensions as ChessGame. */
    let board;
    try {
        const snap = JSON.parse(JSON.stringify(g.GameState));
        board = snap && snap.board;
    } catch {
        board = g.GameState.board;
    }
    if (!board || !Array.isArray(board)) {
        return header + "Could not read the board. Try again after the board has loaded.";
    }

    const rows = (typeof g.BOARD_ROWS === "number") ? g.BOARD_ROWS : 8;
    const cols = (typeof g.BOARD_COLUMNS === "number") ? g.BOARD_COLUMNS : 8;

    /* ChessGame piece codes (fixed); match ChessGame.js — do not read only from instance (PAWN=0 is falsy). */
    const PT_PAWN = 0;
    const PT_KING = 1;
    const PT_KNIGHT = 2;
    const PT_BISHOP = 3;
    const PT_ROOK = 4;
    const PT_QUEEN = 5;

    function normalizeBookmarkPieceColor(raw) {
        if (raw == null) {
            return null;
        }
        const s = String(raw).trim().toLowerCase();
        if (s === "white") {
            return "white";
        }
        if (s === "black") {
            return "black";
        }
        return null;
    }

    function cellPieceType(cell) {
        let pt = cell.pieceType;
        if (pt === undefined || pt === null) {
            pt = cell.PieceType;
        }
        const n = Number(pt);
        return Number.isFinite(n) ? n : NaN;
    }

    const fresh = function () {
        return { pawn: 0, rook: 0, knight: 0, bishop: 0, queen: 0, king: 0 };
    };
    const byColor = { white: fresh(), black: fresh() };
    let whiteKingPos = null;
    let blackKingPos = null;
    let whiteBishopSquare = null;
    let blackBishopSquare = null;

    for (let r = 0; r < rows; r++) {
        const row = board[r];
        if (!row || !Array.isArray(row)) {
            continue;
        }
        const rowLen = Math.min(cols, row.length);
        for (let c = 0; c < rowLen; c++) {
            const cell = row[c];
            if (!cell || typeof cell !== "object") {
                continue;
            }
            const col = normalizeBookmarkPieceColor(cell.color);
            if (!col) {
                continue;
            }
            const t = cellPieceType(cell);
            if (!Number.isFinite(t)) {
                continue;
            }
            const bucket = byColor[col];
            if (t === PT_PAWN) {bucket.pawn++;}
            else if (t === PT_ROOK) {bucket.rook++;}
            else if (t === PT_KNIGHT) {bucket.knight++;}
            else if (t === PT_BISHOP) {
                bucket.bishop++;
                if (col === "white") {
                    whiteBishopSquare = { row: r, col: c };
                } else {
                    blackBishopSquare = { row: r, col: c };
                }
            } else if (t === PT_QUEEN) {bucket.queen++;}
            else if (t === PT_KING) {
                bucket.king++;
                if (col === "white") {
                    whiteKingPos = { row: r, col: c };
                } else {
                    blackKingPos = { row: r, col: c };
                }
            }
        }
    }

    const wk = byColor.white.king;
    if (wk !== 1) {
        if (wk === 0) {return header + "There must be exactly one white king on the board. None was found.";}
        return header + "There must be exactly one white king on the board. Found " + wk + " white kings.";
    }
    const bk = byColor.black.king;
    if (bk !== 1) {
        if (bk === 0) {return header + "There must be exactly one black king on the board. None was found.";}
        return header + "There must be exactly one black king on the board. Found " + bk + " black kings.";
    }

    if (whiteKingPos && blackKingPos) {
        const dr = Math.abs(whiteKingPos.row - blackKingPos.row);
        const dc = Math.abs(whiteKingPos.col - blackKingPos.col);
        if (dr <= 1 && dc <= 1) {
            return header + "The two kings cannot be on adjacent squares (including diagonally).";
        }
    }

    const W = byColor.white;
    const B = byColor.black;
    const nonKingWhite = W.pawn + W.rook + W.knight + W.bishop + W.queen;
    const nonKingBlack = B.pawn + B.rook + B.knight + B.bishop + B.queen;
    const totalPieces = 2 + nonKingWhite + nonKingBlack;
    const minorsTotal = W.bishop + W.knight + B.bishop + B.knight;
    const heavyOrPawnTotal = W.pawn + W.rook + W.queen + B.pawn + B.rook + B.queen;

    /* Automatic insufficient material (common FIDE-style cases), from piece counts only (+ bishop squares for KB vs KB). */
    if (nonKingWhite === 0 && nonKingBlack === 0) {
        return header + "This position is a draw by insufficient material (king versus king). Add pieces so checkmate remains possible.";
    }
    if (totalPieces === 3 && heavyOrPawnTotal === 0 && minorsTotal === 1) {
        return header + "This position is a draw by insufficient material (king and bishop or knight versus lone king). Add pieces so checkmate remains possible.";
    }
    if (totalPieces === 4 && W.bishop === 1 && B.bishop === 1 && W.knight + W.queen + W.rook + W.pawn === 0 && B.knight + B.queen + B.rook + B.pawn === 0) {
        if (whiteBishopSquare && blackBishopSquare) {
            const wSum = whiteBishopSquare.row + whiteBishopSquare.col;
            const bSum = blackBishopSquare.row + blackBishopSquare.col;
            if (wSum % 2 === bSum % 2) {
                return header + "This position is a draw by insufficient material (bishop versus bishop on the same square color). Add pieces so checkmate remains possible.";
            }
        }
    }

    if (byColor.white.queen > 9) {
        return header + "White has " + byColor.white.queen + " queens; the maximum is 9 per color.";
    }
    if (byColor.black.queen > 9) {
        return header + "Black has " + byColor.black.queen + " queens; the maximum is 9 per color.";
    }
    if (byColor.white.rook > 10) {
        return header + "White has " + byColor.white.rook + " rooks; the maximum is 10 per color.";
    }
    if (byColor.black.rook > 10) {
        return header + "Black has " + byColor.black.rook + " rooks; the maximum is 10 per color.";
    }
    if (byColor.white.bishop > 10) {
        return header + "White has " + byColor.white.bishop + " bishops; the maximum is 10 per color.";
    }
    if (byColor.black.bishop > 10) {
        return header + "Black has " + byColor.black.bishop + " bishops; the maximum is 10 per color.";
    }
    if (byColor.white.knight > 10) {
        return header + "White has " + byColor.white.knight + " knights; the maximum is 10 per color.";
    }
    if (byColor.black.knight > 10) {
        return header + "Black has " + byColor.black.knight + " knights; the maximum is 10 per color.";
    }
    if (byColor.white.pawn > 8) {
        return header + "White has " + byColor.white.pawn + " pawns; the maximum is 8 per color.";
    }
    if (byColor.black.pawn > 8) {
        return header + "Black has " + byColor.black.pawn + " pawns; the maximum is 8 per color.";
    }

    return null;
}

function createAlertMessageBox(text) {
    const raw = String(text);
    const idx = raw.indexOf("\n\n");
    let titleText = Labels.BOOKMARK_ALERT_TITLE;
    let bodyText = raw;
    if (idx !== -1) {
        titleText = raw.slice(0, idx).trim().replace(/:\s*$/, "");
        bodyText = raw.slice(idx + 2).trim();
    }

    const messageBoxPanel = document.createElement("div");
    messageBoxPanel.setAttribute("class", "messageBoxPanel messageBoxPanel--alert chessboard-alert-dialog");
    messageBoxPanel.setAttribute("id", "messageBoxPanel");
    messageBoxPanel.setAttribute("role", "alertdialog");
    messageBoxPanel.setAttribute("aria-modal", "true");
    messageBoxPanel.setAttribute("aria-labelledby", "chessboardAlertTitle");

    const titleEl = document.createElement("h3");
    titleEl.setAttribute("id", "chessboardAlertTitle");
    titleEl.className = "chessboard-alert-title";
    titleEl.textContent = titleText;
    messageBoxPanel.appendChild(titleEl);

    const messageEl = document.createElement("p");
    messageEl.className = "chessboard-alert-message";
    messageEl.setAttribute("id", "messageBoxText");
    messageEl.textContent = bodyText;
    messageBoxPanel.appendChild(messageEl);

    const buttonsArea = document.createElement("div");
    buttonsArea.setAttribute("class", "chessboard-alert-actions loadGameButtons");
    buttonsArea.setAttribute("id", "loadGameButtons");

    const okButton = document.createElement("button");
    okButton.type = "button";
    okButton.setAttribute("class", "button chessboard-alert-ok");
    okButton.setAttribute("id", "alertOkButton");
    okButton.innerText = Labels.OK;
    okButton.addEventListener("click", () => { hideMessageBox(); }, { once: true });
    buttonsArea.appendChild(okButton);
    messageBoxPanel.appendChild(buttonsArea);
    return messageBoxPanel;
}

function alertMessageBox(text) {
    dialogOn = true;
    const chessboardDiv = document.getElementById("chessboard");
    if (!chessboardDiv) {return;}
    const cloakDiv = createCloak();
    cloakDiv.classList.add("cloak--alert");
    chessboardDiv.appendChild(cloakDiv);
    cloakDiv.style.visibility = "visible";
    cloakDiv.style.opacity = "1";
    /* Dialog inside cloak so it does not become a second flex item on #chessboard (which broke the board layout). */
    cloakDiv.appendChild(createAlertMessageBox(text));
    registerButtonEvents();
    saveButtonsState();
    disableButtons(["rematchBtn", "resignBtn", "drawBtn", "redoBtn", "undoBtn", "lastMoveBtn", "homeBtn", "bookmarkBtn", "addBookmarkBtn"]);
}

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
        }
        if (messageBoxPanel.parentNode === chessboardDiv) {
            chessboardDiv.removeChild(messageBoxPanel);
        }
        // enableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
        restoreButtonsState();


        dialogOn = false;
    }
}

function messageBox(text, yesCallback, noCallback) {
    closeMobileMovesListPanel();

    dialogOn = true;
    const chessboardDiv = document.getElementById("chessboard");
    const cloakDiv = createCloak();
    chessboardDiv.appendChild(cloakDiv);
    cloakDiv.style.visibility = "visible";
    cloakDiv.style.opacity = "1";
    chessboardDiv.appendChild(createMessageBox(text, yesCallback, noCallback));
    registerButtonEvents();
    saveButtonsState();
    disableButtons(["rematchBtn", "resignBtn", "drawBtn", "redoBtn", "undoBtn", "lastMoveBtn", "homeBtn", "bookmarkBtn", "addBookmarkBtn"]);
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
    try {
        const board = gameState && gameState.board;
        const capturedPiecesList = gameState && gameState.capturedPiecesList;
        if (board) {
            patchBoardFromState(board);
        }
        updateCaptureLists(capturedPiecesList);
    } catch (paintErr) {
        console.error("[chessboard] soft board patch failed; falling back to drawBoard:", paintErr);
        try {
            if (gameState && gameState.board) {
                drawBoard(gameState.board);
                updateCaptureLists(gameState.capturedPiecesList);
            }
        } catch (drawErr) {
            console.error("[chessboard] drawBoard fallback failed:", drawErr);
        }
    }

    if (gameInfo.mode != "review") {
        gameMoves = await getMovesForTable();
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
        lastCheckNotifySide = null;
        await checkmateEventHandler(game.Turn);
    } else if (gameState.check === true) {
        if (lastCheckNotifySide !== game.Turn) {
            await checkEventHandler(game.Turn);
            lastCheckNotifySide = game.Turn;
        }
    } else {
        lastCheckNotifySide = null;
    }

    // Draw is handled via game.OnDraw (drawEventHandler), including draw-offer accepted.

    //we were in check but not anymore
    if (alertMode && !gameState.check && !gameState.checkmate && !gameState.draw) {

        alertMode = false;
        lastCheckNotifySide = null;
        resetAlerts();
        displayMessage("");
    }
    if (game.GameOver) {
        //document.getElementById("rematchBtn").classList.remove("btnDisabled");
        enableButtons(["rematchBtn"]);
        gameMoves = await getMovesForTable();
        updateMovesTable(gameMoves.moves);
    }

    if (gameInfo.gameType === "SinglePlayerGame" && !game.GameOver) {
        const humanTurn = (game.Turn === "white" && currentPlayerIsWhite) || (game.Turn === "black" && !currentPlayerIsWhite);
        const humanHasMoved = currentPlayerIsWhite ? game.Moves.length >= 1 : game.Moves.length >= 2;
        if (humanTurn && humanHasMoved) {
            enableButtons(["drawBtn"]);
        } else {
            disableButtons(["drawBtn"]);
        }
    }
    if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher && !game.GameOver) {
        syncOnlineGameDrawButton();
    }
}

function checkEventHandler(turn) {
    alertMode = true;
    console.log(`Check! ${game.colorName(turn)} under attack`);
    displayMessage("Check", 2000);
    const playerName = turn === "black" ? gameInfo.blackPlayerName : gameInfo.whitePlayerName;
    log(playerName, "Check!");
    const frame = document.getElementsByClassName("frame");
    for (const el of frame) { el.classList.add("checkAlert"); }
}

async function checkmateEventHandler(turn) {
    alertMode = true;
    displayMessage(`Checkmate! ${game.colorName(turn)} wins!`, 5000);
    const playerName = game.colorName(turn) === "White" ? gameInfo.whitePlayerName : gameInfo.blackPlayerName;
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
    gameMoves = await getMovesForTable();
    updateMovesTable(gameMoves.moves);
}

async function drawEventHandler(reason) {
    clearInterval(whiteHandle);
    clearInterval(blackHandle);
    alertMode = true;
    displayMessage(`Draw! ${reason}`, 5000);
    log("System", "Draw");
    log("System", reason);
    const frame = document.getElementsByClassName("frame");
    for (const el of frame) { el.classList.add("drawAlert"); }
    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
    //document.getElementById("rematchBtn").classList.remove("btnDisabled");
    enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
    gameMoves = await getMovesForTable();
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

    if(!moves){
        return;
    }
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

async function animateMove(move, options) {
    const opts = options || {};
    const skipFinalSync = opts.skipFinalSync === true;

    return new Promise((resolve, reject) => {
        animating = true;
        const speed = 20;

        function finishOk() {
            animating = false;
            resolve();
        }

        function finishFail(err) {
            animating = false;
            reject(err);
        }

        if (move) {
            clearArrows();

            const divMoveTarget = findSquareDivElement(move.source.row, move.source.col);
            const img = divMoveTarget && divMoveTarget.querySelector
                ? divMoveTarget.querySelector("img")
                : (divMoveTarget && divMoveTarget.childNodes[0]);
            if (!img) {
                /*
                 * With skipFinalSync the caller applies makeMove next; resolve so the
                 * engine/opponent move is not dropped when the img node is missing.
                 */
                if (skipFinalSync) {
                    finishOk();
                } else {
                    syncBoardFromGameStateOnly();
                    finishFail();
                }
                return;

            }
            const squareWidth = divMoveTarget.offsetWidth || 0;
            const squareHeight = divMoveTarget.offsetWidth || 0;
            const horizontalDistance = (move.target.col - move.source.col) * squareWidth;
            const verticallDistance = (move.target.row - move.source.row) * squareHeight;
            const verticalSteps = verticallDistance / speed;
            const horizontalSteps = horizontalDistance / speed;

            let left = 0;
            let top = 0;

            img.style.zIndex = "2";
            img.style.position = "absolute";

            /* Zero-size board or null move: skip tween and settle/sync immediately. */
            if (!squareWidth || (horizontalDistance === 0 && verticallDistance === 0)) {
                if (skipFinalSync) {
                    settleAnimatedPieceOnTarget(move, img);
                } else {
                    img.style.position = "relative";
                    img.style.marginLeft = "0px";
                    img.style.marginTop = "0px";
                    syncBoardFromGameStateOnly();
                }
                finishOk();
                return;
            }

            let ticks = 0;
            const maxTicks = 120;
            const interval = setInterval(() => {
                ticks += 1;
                left += horizontalSteps;
                top += verticalSteps;
                img.style.marginLeft = left + "px";
                img.style.marginTop = top + "px";

                const reached =
                    Math.abs(left - horizontalDistance * 2) < 1 &&
                    Math.abs(top - verticallDistance * 2) < 1;
                if (reached || ticks >= maxTicks) {
                    clearInterval(interval);
                    if (skipFinalSync) {
                        settleAnimatedPieceOnTarget(move, img);
                    } else {
                        img.style.position = "relative";
                        img.style.marginLeft = "0px";
                        img.style.marginTop = "0px";
                        syncBoardFromGameStateOnly();
                    }
                    finishOk();
                }
            }
                , 2);
        }
        else {
            finishFail("error");
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
    let lastMove = null;
    for (let i = moves.length - 1; i >= 0; i--) {
        const m = moves[i];
        if (m && m.source && m.target && m.source.row != null && m.target.row != null) {
            lastMove = m;
            break;
        }
    }
    if (!lastMove) {
        return;
    }

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
    /*
     * Phase 8: on mobile OnlineGame (participant or watcher), session OnlineMode
     * owns /ws. SinglePlayer keeps the classic socket (clientEngineMove + human moves).
     */
    if (
        typeof window !== "undefined" &&
        document.body &&
        document.body.classList.contains("mobile-game-shell") &&
        typeof gameInfo !== "undefined" &&
        gameInfo &&
        gameInfo.gameType === "OnlineGame" &&
        window.ShmerlingMobileSessionOnline
    ) {
        window.__SHMERLING_PENDING_MOBILE_ONLINE__ = {
            username: username,
            isWhite: isWhite,
            isWatcher: !!(isWatcher || gameInfo.watcher),
        };
        console.log("[chessboard] classic WS deferred to mobile OnlineMode");
        return;
    }

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
                gameMoves = await getMovesForTable();
                updateMovesTable(gameMoves.moves);
                return;
            }
            const move = adjustIncomingNetworkMoveForBoardView(message.data);
            let moveObj;


            if (move.promotion) {
                if (!move.selectedPiece) {
                    return;
                }
                else {
                    try {
                        await animateMove(move, { skipFinalSync: true });
                    } catch (animErr) { /* apply below */ }
                    moveObj = game.makeMove(move.source, move.target);
                    game.completePromotion(move);
                }
            }
            else {
                try {
                    await animateMove(move, { skipFinalSync: true });
                } catch (animErr) { /* apply below */ }
                moveObj = game.makeMove(move.source, move.target);
            }

            lastMove = moveObj;
            moveAccepted(move);
            if (move.moveTime != null && typeof move.moveTime === "number") {
                if (message.isWhite) {
                    whiteTimer = move.moveTime;
                    if (whiteHandle) { clearInterval(whiteHandle); whiteHandle = null; }
                    const whiteClock = document.getElementById("whiteClockTimeText");
                    if (whiteClock) {whiteClock.innerText = timerToText(whiteTimer);}
                } else {
                    blackTimer = move.moveTime;
                    if (blackHandle) { clearInterval(blackHandle); blackHandle = null; }
                    const blackClock = document.getElementById("blackClockTimeText");
                    if (blackClock) {blackClock.innerText = timerToText(blackTimer);}
                }
            }
            switchClocks();
            gameMoves = await getMovesForTable();
            updateMovesTable(gameMoves.moves);
            moveIndex = gameMoves.moves ? gameMoves.moves.length : 0;
            const turnStr = "td_move" + moveIndex;
            const td = document.getElementById(turnStr);
            if (td) {
                scrollMoveCellIntoView(td);
            }
            if (gameInfo.gameType === "SinglePlayerGame" && !gameInfo.watcher) {
                sendMessage({ type: "info", info: "clockSync", gameId: gameInfo.id, whiteTimer: whiteTimer, blackTimer: blackTimer });
            }
            if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher && !game.GameOver) {
                syncOnlineGameDrawButton();
            }
        };

        if (message.type == "clockSync") {
            if (typeof message.whiteTimer === "number" && typeof message.blackTimer === "number") {
                whiteTimer = message.whiteTimer;
                blackTimer = message.blackTimer;
                if (whiteHandle) { clearInterval(whiteHandle); whiteHandle = null; }
                if (blackHandle) { clearInterval(blackHandle); blackHandle = null; }
                const whiteClock = document.getElementById("whiteClockTimeText");
                const blackClock = document.getElementById("blackClockTimeText");
                if (whiteClock) {whiteClock.innerText = timerToText(whiteTimer);}
                if (blackClock) {blackClock.innerText = timerToText(blackTimer);}
                switchClocks();
            }
        }

        if (message.type == "info") {
            const info = message.info;
            if (info == "game over") {
                clearOpponentDisconnectGrace();
                //displayMessage("Game Over");
                enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
                disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                gameMoves = await getMovesForTable();
                updateMovesTable(gameMoves.moves);
                log("System", "Game over.");
            }

            if (info == "Opponenet left the game") {
                const player = currentPlayerIsWhite ? "White" : "Black";
                //displayMessage(`The opponent left,  ${player} wins`);
                game.resign(player);
                hideMessageBox();
                clearInterval(whiteHandle);
                clearInterval(blackHandle);
            }

            if (info == "Game cancelled") {
                clearOpponentDisconnectGrace();
                hideDisconnectionCountdown();
                const detail = message.data && String(message.data).trim() ? String(message.data).trim() : "";
                const shown = detail ? "Game cancelled — " + detail : "Game cancelled";
                displayMessage(shown);
                log("System", shown);
                if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher) {
                    hideMessageBox();
                    clearInterval(whiteHandle);
                    clearInterval(blackHandle);
                    setPlayerStatusDot(getOpponentStatusElement(), "offline");
                    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                    enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
                }
            }

            if (info == "Opponent disconnected") {
                clearOpponentDisconnectGrace();
                opponentDisconnectGraceTimer = setTimeout(() => {
                    opponentDisconnectGraceTimer = null;
                    if (gameInfo.watcher && gameInfo.gameType === "OnlineGame") {
                        const dw = message.disconnectedWasWhite;
                        if (dw === true) {
                            setPlayerStatusDot(watcherPlayerStatusDot(true), "disconnected");
                            log("System", onlinePlayerLabelForSide(true) + " disconnected");
                        } else if (dw === false) {
                            setPlayerStatusDot(watcherPlayerStatusDot(false), "disconnected");
                            log("System", onlinePlayerLabelForSide(false) + " disconnected");
                        } else {
                            log("System", "A player disconnected");
                        }
                        return;
                    }
                    if (!gameInfo.watcher) {
                        displayMessage("The opponent disconnected");
                        log("System", "The opponent disconnected");
                        setPlayerStatusDot(getOpponentStatusElement(), "disconnected");
                        hideMessageBox();
                        clearInterval(whiteHandle);
                        clearInterval(blackHandle);
                        startDisconnectionTimer();
                    }
                }, 1000);
            }

            if (info == "Opponent failed to reconnect") {
                clearOpponentDisconnectGrace();
                hideDisconnectionCountdown();
                const loser =
                    message.disconnectedWasWhite === true ? "White" :
                        message.disconnectedWasWhite === false ? "Black" :
                            (currentPlayerIsWhite ? "Black" : "White");
                const winner = loser === "White" ? "Black" : "White";
                const winnerName = winner === "White" ? gameInfo.whitePlayerName : gameInfo.blackPlayerName;
                const summary =
                    "Game over — opponent failed to reconnect. " + winnerName + " wins.";
                displayMessage(summary);
                log("System", summary);
                game.resign(loser);
                if (gameInfo.watcher && gameInfo.gameType === "OnlineGame") {
                    const dw = message.disconnectedWasWhite;
                    if (dw === true) {
                        setPlayerStatusDot(watcherPlayerStatusDot(true), "offline");
                    } else if (dw === false) {
                        setPlayerStatusDot(watcherPlayerStatusDot(false), "offline");
                    }
                    hideMessageBox();
                    clearInterval(whiteHandle);
                    clearInterval(blackHandle);
                } else if (!gameInfo.watcher) {
                    setPlayerStatusDot(getOpponentStatusElement(), "offline");
                    hideMessageBox();
                    clearInterval(whiteHandle);
                    clearInterval(blackHandle);
                    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                    enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
                }
                gameMoves = await getMovesForTable();
                updateMovesTable(gameMoves.moves);
            }


            if (info == "Opponent resigned") {
                const resignedPlayer = (message.isWhite === true) ? "White" : "Black";
                const winner = resignedPlayer === "White" ? "Black" : "White";
                displayMessage(`The opponent resigned, ${winner} wins `);
                const playerName = resignedPlayer === "White" ? gameInfo.whitePlayerName : gameInfo.blackPlayerName;
                log(playerName, "I resign!");
                hideMessageBox();
                game.resign(resignedPlayer);
                disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
                gameMoves = await getMovesForTable();
                updateMovesTable(gameMoves.moves);
                log("System", "Game over.");
            }

            if (info == "move validated successfully") {
                gameMoves = await getMovesForTable();
                updateMovesTable(gameMoves.moves);
                moveIndex = gameMoves.moves ? gameMoves.moves.length : 0;
                const turnStr = "td_move" + moveIndex;
                const td = document.getElementById(turnStr);
                if (td) {
                    scrollMoveCellIntoView(td);
                }
                if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher && !game.GameOver) {
                    syncOnlineGameDrawButton();
                }
            }

            if (info == "move validation failed") {
                const player = currentPlayerIsWhite ? "White" : "Black";
                displayMessage("Something went wrong");
                log("Server", "Something went wrong");
                hideMessageBox();
                game.resign(player);
                disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
                enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
                gameMoves = await getMovesForTable();
                updateMovesTable(gameMoves.moves);
            }

            if (info == "opponent joined") {
                //displayMessage(`An opponent joined`);
                setPlayerStatusDot(getOpponentStatusElement(), "online");

                const opponentName = currentPlayerIsWhite ?
                    document.getElementById("blackPlayerName") :
                    document.getElementById("whitePlayerName");
                opponentName.innerText = message.data;

                removeCloak();
                enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
                syncOnlineGameDrawButton();

            }

            if (info == "opponent rejoined") {
                /* If reconnect happens before the 1s post-disconnect grace, treat as a flicker (e.g. refresh) — no toast. */
                const quickRejoin = opponentDisconnectGraceTimer != null;
                clearOpponentDisconnectGrace();
                hideDisconnectionCountdown();
                switchClocks();
                if (gameInfo.watcher && gameInfo.gameType === "OnlineGame") {
                    const rw = message.rejoinedWasWhite;
                    if (rw === true) {
                        setPlayerStatusDot(watcherPlayerStatusDot(true), "online");
                    } else if (rw === false) {
                        setPlayerStatusDot(watcherPlayerStatusDot(false), "online");
                    } else {
                        setPlayerStatusDot(document.getElementById("whitePlayerStatus"), "online");
                        setPlayerStatusDot(document.getElementById("blackPlayerStatus"), "online");
                    }
                    if (!quickRejoin) {
                        if (rw === true || rw === false) {
                            const name = onlinePlayerLabelForSide(rw);
                            displayMessage(name + " rejoined");
                            log("System", name + " rejoined");
                        } else {
                            displayMessage("A player rejoined");
                            log("System", "A player rejoined");
                        }
                    }
                } else {
                    setPlayerStatusDot(getOpponentStatusElement(), "online");
                    if (!quickRejoin) {
                        displayMessage("The opponent rejoined");
                        log("System", "The opponent rejoined");
                    }
                    if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher && !game.GameOver) {
                        syncOnlineGameDrawButton();
                    }
                }
            }

            if (info == "offer rematch") {
                if (gameInfo.watcher) {
                    const label = onlinePlayerLabelForSide(
                        message.isWhite === true ? true : message.isWhite === false ? false : undefined
                    );
                    log("System", label + " offered a rematch");
                } else {
                    displayMessage("");
                    if (gameInfo.gameType == "OnlineGame") {
                        messageBox("Opponenet offer a rematch, agree?", acceptRematch, declineRematch);
                    } else if (gameInfo.gameType == "SinglePlayerGame") {
                        if (typeof gameInfo !== "undefined" && gameInfo) {
                            window.__LAST_GAME_OPTIONS__ = {
                                color: currentPlayerIsWhite ? "white" : "black",
                                engine: gameInfo.engine || "brain43",
                                difficulty: gameInfo.difficulty != null ? gameInfo.difficulty : 3,
                                mouse: gameInfo.mousePreference || "drag",
                                showAvailableMoves: gameInfo.showAvailableMoves !== false,
                                timeMinutes: gameInfo.gameTimeMinutes != null ? gameInfo.gameTimeMinutes : 90,
                                isPrivate: gameInfo.isPrivate === true,
                            };
                        }
                        if (typeof window !== "undefined" && typeof window.openPlayNowModal === "function") {
                            window.openPlayNowModal();
                        }
                    }
                }
            }

            if (info == "spectator rematch new game") {
                if (gameInfo && gameInfo.watcher) {
                    const text =
                        message.data && String(message.data).trim()
                            ? String(message.data).trim()
                            : "New game started — go to Home to watch.";
                    displayMessage(text);
                    log("System", text);
                }
            }

            if (info == "rematch accepted") {


                // Online
                if (gameInfo.gameType == "OnlineGame") {
                    displayMessage("Rematch offer accepted");
                    log("System", "Rematch offer accepted");
                    enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
                    disableButtons(["rematchBtn"]);
                    syncOnlineGameDrawButton();
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
                if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher) {
                    syncOnlineGameDrawButton();
                }
            }

            if (info == "offer draw") {
                if (gameInfo.watcher) {
                    const label = onlinePlayerLabelForSide(
                        message.isWhite === true ? true : message.isWhite === false ? false : undefined
                    );
                    log("System", label + " offered a draw");
                } else if (gameInfo.gameType != "SinglePlayerGame") {
                    displayMessage("");
                    messageBox("Opponent sent a draw offer, accept?", acceptDraw, declineDraw);
                } else if (gameInfo.gameType === "SinglePlayerGame") {
                    const side = message.isWhite ? "White" : "Black";
                    displayMessage(side + " offers draw");
                    log("System", side + " offers draw");
                }
            }

            if (info == "draw accepted") {
                const offerBy = message.isWhite ? "black" : "white";
                game.drawOfferAccepted(offerBy);
            }

            if (info == "draw declined") {
                displayMessage("Draw offer declined");
                log("System", "Draw offer declined");
                if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher) {
                    enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
                    syncOnlineGameDrawButton();
                } else {
                    enableButtons(["resignBtn", "drawBtn", "lastMoveBtn", "homeBtn"]);
                }
            }

            if (info == "new watcher") {
                const watcherName = message.data;
                displayMessage(watcherName + " is watching the game");
            }

            if (info == "chat") {
                log(message.username, message.data, true);
            }
        }

        if (message.type == "cmd") {
            const info = message.data;
            if (info == "undo") {
                game.undo();
                if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher && !game.GameOver) {
                    syncOnlineGameDrawButton();
                }
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
    if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher) {
        enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
        syncOnlineGameDrawButton();
    } else {
        enableButtons(["resignBtn", "drawBtn", "lastMoveBtn", "homeBtn"]);
    }

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
        disableButtons(["drawBtn"]);
        /* Time-out / synthetic moves may omit moveStr; undefined is dropped by JSON.stringify and breaks server Joi. */
        const moveStr =
            move && move.moveStr != null && move.moveStr !== undefined ? move.moveStr : "";
        const message = {
            type: "info",
            info: "move accepted",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite,
            moveTime: currentPlayerIsWhite ? whiteTimer : blackTimer,
            moveStr,
            whiteTimer: whiteTimer,
            blackTimer: blackTimer,
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
        enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
        disableButtons(["rematchBtn"]);
        syncOnlineGameDrawButton();
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
    game.drawOfferAccepted(offerBy);
}

async function offerDraw() {
    if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher) {
        const humanHasMoved = currentPlayerIsWhite ? game.Moves.length >= 1 : game.Moves.length >= 2;
        const myTurn =
            (game.Turn === "white" && currentPlayerIsWhite) ||
            (game.Turn === "black" && !currentPlayerIsWhite);
        if (!humanHasMoved || myTurn) {
            return;
        }
    }
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
    if (gameInfo && gameInfo.gameType === "OnlineGame" && !gameInfo.watcher) {
        enableButtons(["resignBtn", "lastMoveBtn", "homeBtn"]);
        syncOnlineGameDrawButton();
    } else {
        enableButtons(["resignBtn", "drawBtn", "lastMoveBtn", "homeBtn"]);
    }
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
    const el = document.getElementById(button);
    if (!el) { return true; }
    if (el.disabled) { return true; }
    if (el.classList.contains("btnDisabled")) { return true; }
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

    if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher) {
        const humanHasMoved = currentPlayerIsWhite ? game.Moves.length >= 1 : game.Moves.length >= 2;
        const myTurn =
            (game.Turn === "white" && currentPlayerIsWhite) ||
            (game.Turn === "black" && !currentPlayerIsWhite);
        if (!humanHasMoved || myTurn) {
            return;
        }
    }

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
                engine: gameInfo.engine || "brain43",
                difficulty: gameInfo.difficulty != null ? gameInfo.difficulty : 3,
                mouse: gameInfo.mousePreference || "drag",
                showAvailableMoves: gameInfo.showAvailableMoves !== false,
                timeMinutes: gameInfo.gameTimeMinutes != null ? gameInfo.gameTimeMinutes : 90,
                isPrivate: gameInfo.isPrivate === true,
            };
        }
        if (typeof window !== "undefined" && typeof window.openPlayNowModal === "function") {
            window.openPlayNowModal();
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
        if (btnName === "rematchBtn" && gameInfo?.watcher) { continue; }
        if (btnName === "resignBtn" && gameInfo?.watcher) { continue; }
        const button = document.getElementById(btnName);
        if (button) {
            button.disabled = false;
            //button.classList.remove("btnDisabled");
        }
    }
}

async function menuResignEventHandler() {
    if (gameInfo?.watcher) { return; }

    if (isButtonDisabled("resignBtn")) { return; }

    if (game.GameOver) { return; }

    disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
    enableButtons(["rematchBtn"]);

    const player = currentPlayerIsWhite ? "White" : "Black";
    if (gameInfo.gameType == "PracticeGame") {
        displayMessage("Game Over");
        game.resign(player);
        log("System", "Game over.");
        const message = {
            type: "info",
            info: "resign",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite,
            moveTime: currentPlayerIsWhite ? whiteTimer : blackTimer,
            whiteTimer,
            blackTimer,
        };
        await sendMessage(message);
        const playerName = currentPlayerIsWhite ? gameInfo.whitePlayerName : gameInfo.blackPlayerName;
        log(playerName, "I resign!");
    }
    else {
        const anyMovePlayed = game.Moves.length >= 1;
        if (gameInfo.gameType === "OnlineGame" && !anyMovePlayed) {
            await postServerInfo("/cancel-before-move", { gameId: gameInfo.id });
            displayMessage("Game cancelled");
            log("System", "Game cancelled");
            hideMessageBox();
            clearInterval(whiteHandle);
            clearInterval(blackHandle);
            disableButtons(["resignBtn", "redoBtn", "undoBtn", "drawBtn"]);
            enableButtons(["rematchBtn", "lastMoveBtn", "homeBtn"]);
            return;
        }
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
            whiteTimer,
            blackTimer,
        };
        await sendMessage(message);
        gameMoves = await getMovesForTable();
        const showResignResult = gameInfo.gameType === "OnlineGame" ? anyMovePlayed : humanHasMoved;
        if (showResignResult && gameMoves.moves && game.ResultMove) {
            const last = gameMoves.moves[gameMoves.moves.length - 1];
            if (!last || last.moveStr !== game.ResultMove.moveStr) {
                gameMoves.moves = [...gameMoves.moves, game.ResultMove];
            }
        }
        updateMovesTable(gameMoves.moves);
        if (gameInfo.gameType === "OnlineGame") {
            displayMessage(`You resigned, ${!currentPlayerIsWhite ? "White" : "Black"} wins `);
            log(currentPlayerIsWhite ? gameInfo.whitePlayerName : gameInfo.blackPlayerName, "I resign!");
        } else {
            displayMessage(humanHasMoved ? `You resigned, ${!currentPlayerIsWhite ? "White" : "Black"} wins ` : "Game cancelled");
            log(humanHasMoved ? currentPlayerIsWhite ? gameInfo.whitePlayerName : gameInfo.blackPlayerName : "System", humanHasMoved ? "I resign!" : "Game cancelled");
        }
        if (game.GameOver) {
            log("System", "Game over.");
        }
    }
}

function menuSaveEventHandler() {
    const state = game.GameState;
    const str = JSON.stringify(state);
    console.log(str);
}

function menuUndo() {

    if (isButtonDisabled("undoBtn")) { return; }

    if (game.GameOver) { return; }

    if (dialogOn) { return; }

    if (promotingMode) { return; }

    if (gameInfo.gameType == "OnlineGame") {
        sendCommand("undo");
        game.undo();
        if (!gameInfo.watcher && !game.GameOver) {
            syncOnlineGameDrawButton();
        }
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
    let idFromUrl = null;
    try {
        const p = new URLSearchParams(window.location.search);
        const qId = p.get("id");
        const qJoin = p.get("joinGame");
        if (qId && String(qId).trim()) {
            idFromUrl = String(qId).trim();
        } else if (qJoin && String(qJoin).trim()) {
            idFromUrl = String(qJoin).trim();
        }
    } catch {
        idFromUrl = null;
    }

    const initialIdEl = document.querySelector("[data-initial-game-id]");
    const fromDom = initialIdEl ? initialIdEl.getAttribute("data-initial-game-id") : null;
    const trimmedDom = fromDom && String(fromDom).trim();

    if (idFromUrl) {
        if (initialIdEl) {
            initialIdEl.removeAttribute("data-initial-game-id");
        }
        return await getServerInfo("/gameInfo?id=" + encodeURIComponent(idFromUrl));
    }
    if (trimmedDom) {
        initialIdEl.removeAttribute("data-initial-game-id");
        return await getServerInfo("/gameInfo?id=" + encodeURIComponent(trimmedDom));
    }
    return await getServerInfo("/gameInfo");
}

async function setRematchGameId(newGameID) {
    await postServerInfo("/rematch", { id: newGameID });
}

async function getGameMoves() {
    const moves = await getServerInfo("/gameMoves");
    return moves;
}

/** For practice game, moves stay local; for other games, fetch from server. */
async function getMovesForTable() {
    if (gameType === "PracticeGame") {
        return { moves: game.Moves || [] };
    }
    return await getGameMoves();
}

async function sendMove(moveObj) {
    // Practice: no server interaction; all moves are local only
    if (gameType === "PracticeGame") { return; }
    const isWhite = currentPlayerIsWhite;
    moveObj.moveTime = isWhite ? whiteTimer : blackTimer;
    moveObj.whiteTimer = whiteTimer;
    moveObj.blackTimer = blackTimer;

    let data = moveObj;
    if (gameInfo.gameType === "OnlineGame" && !gameInfo.watcher) {
        data = adjustOutgoingNetworkMoveForBoardView(moveObj);
    }

    const message = {
        type: "move",
        data: data,
        gameId: gameInfo.id,
        username: gameInfo.username,
        isWhite: isWhite,
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
    if (!playerDiconnectionTimer) {
        return;
    }
    if (disconnectionTimerHandle) {
        clearInterval(disconnectionTimerHandle);
        disconnectionTimerHandle = null;
    }

    disconnectionTimer = 60;
    playerDiconnectionTimer.classList.remove("hide");
    playerDiconnectionTimer.setAttribute("title", DISCONNECT_COUNTDOWN_TOOLTIP);
    playerDiconnectionTimer.setAttribute("aria-label", DISCONNECT_COUNTDOWN_TOOLTIP);
    playerDiconnectionTimer.innerText = formatDisconnectionCountdown(disconnectionTimer);
    disconnectionTimerHandle = setInterval(() => {
        if (game.GameOver) {
            enableButtons(["rematchBtn"]);
            clearInterval(disconnectionTimerHandle);
            disconnectionTimerHandle = null;
            playerDiconnectionTimer.classList.add("hide");
            playerDiconnectionTimer.removeAttribute("title");
            playerDiconnectionTimer.removeAttribute("aria-label");
            return;
        }
        disconnectionTimer--;
        if (disconnectionTimer <= 0) {
            clearInterval(disconnectionTimerHandle);
            disconnectionTimerHandle = null;
            playerDiconnectionTimer.classList.add("hide");
            playerDiconnectionTimer.removeAttribute("title");
            playerDiconnectionTimer.removeAttribute("aria-label");
            if (!game.GameOver) {
                void syncReconnectTimeoutFromServer();
            }
            return;
        }
        playerDiconnectionTimer.innerText = formatDisconnectionCountdown(disconnectionTimer);
    }, 1000);
}


/// Clocks Handling

function updateTimers(gameInfo) {
    if (typeof gameInfo.whiteTimer === "number" && gameInfo.whiteTimer >= 0) {
        whiteTimer = gameInfo.whiteTimer;
        const whiteClock = document.getElementById("whiteClockTimeText");
        if (whiteClock) {
            whiteClock.innerText = timerToText(whiteTimer);
        }
    }

    if (typeof gameInfo.blackTimer === "number" && gameInfo.blackTimer >= 0) {
        blackTimer = gameInfo.blackTimer;
        const blackClock = document.getElementById("blackClockTimeText");
        if (blackClock) {
            blackClock.innerText = timerToText(blackTimer);
        }
    }

    if (typeof game !== "undefined" && game && typeof gameInfo.whiteTimer === "number" && gameInfo.whiteTimer > 0) {
        try {
            game.GameTimeLength = gameInfo.whiteTimer;
        } catch {
            /* ignore */
        }
    }
}

function switchClocks() {

    if (gameInfo.mode == "review") { return; }

    /** Always stop both tickers first — otherwise a second call (reconnect, clockSync, …) stacks intervals and time runs at 2×. */
    if (whiteHandle) {
        clearInterval(whiteHandle);
        whiteHandle = null;
    }
    if (blackHandle) {
        clearInterval(blackHandle);
        blackHandle = null;
    }

    if (game.Turn == "black") {

        const whiteTurnClock = document.getElementById("whiteTurnClock");
        whiteTurnClock.classList.add("unvisible");
        const blackTurnClock = document.getElementById("blackTurnClock");
        blackTurnClock.classList.remove("unvisible");

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
    const loser = game.Turn;
    displayMessage(`Time's up! ${loser} lost`);
    log("System", `Time's up — ${loser} ran out of time.`);
    game.OutOfTime = loser;
    sendOutOfTime(loser);
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


/** @param {boolean} isPlay - true: show Play / hide Pause (paused); false: hide Play / show Pause (playing) */
function togglePlayPause(isPlay) {
    const playBtn = document.getElementById("movePlay");
    const pauseBtn = document.getElementById("movePause");
    if (!playBtn || !pauseBtn) { return; }
    if (isPlay) {
        playBtn.classList.remove("hide");
        pauseBtn.classList.add("hide");
    } else {
        playBtn.classList.add("hide");
        pauseBtn.classList.remove("hide");
    }
}

function movePause() {
    if (gameInfo.mode != "review") { return; }
    pause = true;
    const temp = setInterval(() => {
        if (!animating) {
            togglePlayPause(true);
            clearInterval(temp);
            console.log("moveIndex:" + moveIndex);
        }
    }, 100);


}

function movePlay() {
    if (gameInfo.mode != "review") { return; }
    if (animating) { return; }
    if (dialogOn) { return; }

    togglePlayPause(false);

    moveHandle = setInterval(() => {
        
        if (pause) {
            pause = false;
            animating = false;
            clearInterval(moveHandle);
            console.log("moveIndex:" + moveIndex);
            return;
        }
        if (moveIndex < gameMoves.moves.length) {
            showMoveForReview(gameMoves.moves[moveIndex], true, moveIndex);
            moveIndex++;
            const movesTDList = document.querySelectorAll("[id ^= 'td_move']");
            movesTDList.forEach(td => td.classList.remove("selectedMove"));
            const turnStr = "td_move" + moveIndex;
            const td = document.getElementById(turnStr);
            if (!td) { clearInterval(moveHandle); return; }
            td.classList.toggle("selectedMove");
            scrollMoveCellIntoView(td);
        }

        else { 
            clearInterval(moveHandle); 
            togglePlayPause(true);
            //console.log("moveIndex:" + moveIndex); 
        }
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
            togglePlayPause(true);
            //console.log("moveIndex:" + moveIndex);
        }

    }, 100);

}

async function moveNext() {
    if (gameInfo.mode != "review") { return; }
    if (animating) { return; }
    if (moveIndex < gameMoves.moves.length) {
        const move = gameMoves.moves[moveIndex];
        if (move && !game.isResultMove(move)) {
            showMoveForReview(move, true, moveIndex);
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
        const lastApplied = gameMoves.moves[moveIndex - 1];
        if (lastApplied && !game.isResultMove(lastApplied)) {
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
        syncReviewClocksForCurrentPly();
    }
    console.log("moveIndex:" + moveIndex);
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
                showMoveForReview(gameMoves.moves[i], false, i);
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
            togglePlayPause(true);
            //console.log("moveIndex:" + moveIndex);
        }
    }, 100);

}

/** After ply `plyIndexZeroBased`, update both clocks when stored; else legacy single-clock using move.moveTime. */
function applyReviewClockDisplays(move, plyIndexZeroBased) {
    const wEl = document.getElementById("whiteClockTimeText");
    const bEl = document.getElementById("blackClockTimeText");
    if (!wEl || !bEl) {
        return;
    }
    if (
        move &&
        typeof move.whiteTimer === "number" &&
        Number.isFinite(move.whiteTimer) &&
        typeof move.blackTimer === "number" &&
        Number.isFinite(move.blackTimer)
    ) {
        wEl.innerText = timerToText(Math.max(0, Math.round(move.whiteTimer)));
        bEl.innerText = timerToText(Math.max(0, Math.round(move.blackTimer)));
        return;
    }
    if (!move || !Number.isFinite(move.moveTime)) {
        return;
    }
    const parity =
        typeof plyIndexZeroBased === "number"
            ? plyIndexZeroBased
            : (typeof moveIndex !== "undefined" ? moveIndex : 0);
    const clockEl = parity % 2 === 0 ? wEl : bEl;
    clockEl.innerText = timerToText(Math.max(0, Math.round(move.moveTime)));
}

/** Board shows position after `moveIndex` plies; sync clocks to that point. */
function syncReviewClocksForCurrentPly() {
    if (!gameInfo || gameInfo.mode !== "review") {
        return;
    }
    if (moveIndex <= 0) {
        resetClocks();
        return;
    }
    const m = gameMoves.moves[moveIndex - 1];
    if (m) {
        applyReviewClockDisplays(m, moveIndex - 1);
    }
}

async function showMoveForReview(move, animnate, plyIndexZeroBased) {
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


    if (animnate) { await animateMove(move, { skipFinalSync: true }); }

    game.makeMove(move.source, move.target);
    if (move.promotion) {
        game.completePromotion(move);
    }

    applyReviewClockDisplays(move, plyIndexZeroBased);

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
        showMoveForReview(move, false, i);

        if (e.target.id == "td_move" + (i + 1)) {
            moveIndex = i + 1;
            break;
        }
    }

    syncReviewClocksForCurrentPly();

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

    if (researchMode || gameInfo.gameType === "Research") {
        window.location = getAppHomePath();
        return;
    }

    if (game.GameOver || gameInfo.mode == "review" || gameInfo.watcher) {
        goBackHome();
        return;
    }
    const humanHasMoved =
        gameInfo.gameType === "OnlineGame"
            ? game.Moves.length >= 1
            : currentPlayerIsWhite
                ? game.Moves.length >= 1
                : game.Moves.length >= 2;
    if (!humanHasMoved) {
        goBackHome();
        return;
    }
    const confirmText = gameInfo.gameType === "PracticeGame" ? "Are you sure?" : "Resign?";
    messageBox(confirmText, goBackHome, () => { });
};

async function goBackHome() {
    const home = getAppHomePath();
    if (researchMode || gameInfo.gameType === "Research") {
        window.location = home;
        return;
    }
    if (gameInfo.watcher || gameInfo.mode === "review") {
        window.location = home;
        return;
    }
    if (gameInfo.gameType === "OnlineGame" && game.Moves.length === 0) {
        await postServerInfo("/cancel-before-move", { gameId: gameInfo.id });
        window.location = home;
        return;
    }
    await menuResignEventHandler();
    window.location = home;
}

/** Flat SVG icons for mobile bottom bar (currentColor). */
const MOBILE_OPTION_ICONS = {
    /* Clear X — resign */
    resign: "<svg class=\"mobile-opt-svg\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.35\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 7l10 10M17 7L7 17\"/></svg>",
    /* Asterisk — new game / rematch */
    rematch: "<svg class=\"mobile-opt-svg\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.25\" stroke-linecap=\"round\">"
        + "<g transform=\"translate(12,12)\"><line x1=\"0\" y1=\"-7\" x2=\"0\" y2=\"7\"/>"
        + "<line x1=\"-6.06\" y1=\"-3.5\" x2=\"6.06\" y2=\"3.5\"/><line x1=\"6.06\" y1=\"-3.5\" x2=\"-6.06\" y2=\"3.5\"/></g></svg>",
    /* Draw score style: 1/2 – 1/2 */
    draw: "<svg class=\"mobile-opt-svg mobile-opt-svg--text\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"currentColor\">"
        + "<text x=\"12\" y=\"15.2\" text-anchor=\"middle\" font-size=\"6.75\" font-weight=\"700\" font-family=\"ui-monospace,Menlo,Consolas,monospace\" letter-spacing=\"-0.04em\">1/2–1/2</text></svg>",
    flip: "<svg class=\"mobile-opt-svg\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M16 17.01V11h-2v7.01h-3L15 22l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z\"/></svg>",
    /* Question mark — last move hint */
    lastMove: "<svg class=\"mobile-opt-svg\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"currentColor\">"
        + "<path d=\"M11.2 16.2V15c0-1.35.45-2.1 1.65-2.85 1-.65 1.55-1.45 1.55-2.55 0-1.45-1.15-2.5-2.9-2.5-1.55 0-2.75 1-2.9 2.45H7.1C7.25 7.55 9.15 6 11.5 6c2.65 0 4.6 1.65 4.6 4.05 0 1.65-.75 2.75-2.15 3.55-.9.55-1.25 1.05-1.25 2.05v.55h-1.5z\"/>"
        + "<circle cx=\"11.25\" cy=\"19.2\" r=\"1.35\"/></svg>",
    movesList: "<svg class=\"mobile-opt-svg\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h11v2H4v-2z\"/></svg>",
};

let mobileMovesPanelScrollLockPrev = "";

/** Short label under the icon (mobile toolbar). */
const MOBILE_OPT_CAPTION = {
    resign: "Resign",
    rematch: "Rematch",
    draw: "Draw",
    flip: "Flip",
    lastMove: "Last",
    movesList: "Moves",
};

function createMobileIconButton(id, onclick, ariaLabel, iconHtml, captionKey) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = id;
    btn.className = "button mobile-opt-icon-btn";
    btn.setAttribute("aria-label", ariaLabel);
    btn.title = ariaLabel;
    const stack = document.createElement("span");
    stack.className = "mobile-opt-stack";
    const iconSlot = document.createElement("span");
    iconSlot.className = "mobile-opt-icon-slot";
    iconSlot.innerHTML = iconHtml;
    const cap = document.createElement("span");
    cap.className = "mobile-opt-caption";
    cap.textContent = MOBILE_OPT_CAPTION[captionKey] || captionKey;
    stack.appendChild(iconSlot);
    stack.appendChild(cap);
    btn.appendChild(stack);
    btn.onclick = onclick;
    return btn;
}

function openMobileMovesListPanel() {
    const panel = document.getElementById("mobileMovesPanel");
    if (!panel) {
        return;
    }
    panel.classList.add("mobile-moves-panel--open");
    panel.setAttribute("aria-hidden", "false");
    mobileMovesPanelScrollLockPrev = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
    const movesDiv = document.getElementById("movesDiv");
    if (movesDiv) {
        movesDiv.scrollTop = movesDiv.scrollHeight;
    }
}

function closeMobileMovesListPanel() {
    const panel = document.getElementById("mobileMovesPanel");
    if (!panel) {
        return;
    }
    panel.classList.remove("mobile-moves-panel--open");
    panel.setAttribute("aria-hidden", "true");
    document.body.style.overflow = mobileMovesPanelScrollLockPrev;
}

window.openMobileMovesListPanel = openMobileMovesListPanel;
window.closeMobileMovesListPanel = closeMobileMovesListPanel;

function addMobileOptionsButtons(optionsSection) {
    const ghostHost = document.createElement("div");
    ghostHost.className = "mobile-options-ghost-host";
    ghostHost.setAttribute("aria-hidden", "true");

    const ghostButtons = [
        { id: "homeBtn", onclick: backToHome, text: Labels.HOME },
        { id: "undoBtn", onclick: menuUndo, text: Labels.UNDO },
        { id: "redoBtn", onclick: menuRedo, text: Labels.REDO },
    ];
    ghostButtons.forEach((b) => {
        const el = document.createElement("button");
        el.type = "button";
        el.id = b.id;
        el.className = "button";
        el.innerText = b.text;
        el.onclick = b.onclick;
        ghostHost.appendChild(el);
    });

    const row = document.createElement("div");
    row.className = "mobile-options-bar-row";

    const dual = document.createElement("div");
    dual.className = "mobile-options-dual";

    const resignBtn = createMobileIconButton(
        "resignBtn",
        menuResignEventHandler,
        Labels.RESIGN,
        MOBILE_OPTION_ICONS.resign,
        "resign"
    );
    const rematchBtn = createMobileIconButton(
        "rematchBtn",
        menuRematchEventHandler,
        Labels.REMATCH,
        MOBILE_OPTION_ICONS.rematch,
        "rematch"
    );
    dual.appendChild(resignBtn);
    dual.appendChild(rematchBtn);
    row.appendChild(dual);

    row.appendChild(createMobileIconButton(
        "drawBtn",
        menuOfferDrawEventHandler,
        Labels.DRAW,
        MOBILE_OPTION_ICONS.draw,
        "draw"
    ));
    row.appendChild(createMobileIconButton(
        "flipBtn",
        flipboard,
        Labels.FLIP,
        MOBILE_OPTION_ICONS.flip,
        "flip"
    ));
    row.appendChild(createMobileIconButton(
        "lastMoveBtn",
        viewLastMove,
        Labels.LAST_MOVE,
        MOBILE_OPTION_ICONS.lastMove,
        "lastMove"
    ));

    row.appendChild(createMobileIconButton(
        "mobileMovesListBtn",
        openMobileMovesListPanel,
        "Moves list",
        MOBILE_OPTION_ICONS.movesList,
        "movesList"
    ));

    optionsSection.appendChild(row);
    optionsSection.appendChild(ghostHost);
}

function addOptionsButtons() {
    const optionsSection = document.getElementById("options");

    if (optionsSection && isMobileGameShell()) {
        addMobileOptionsButtons(optionsSection);
        return;
    }

    const buttons = [
        { id: "rematchBtn", onclick: menuRematchEventHandler, text: Labels.REMATCH },
        { id: "resignBtn", onclick: menuResignEventHandler, text: Labels.RESIGN },
        { id: "drawBtn", onclick: menuOfferDrawEventHandler, text: Labels.DRAW },
        { id: "undoBtn", onclick: menuUndo, text: Labels.UNDO },
        { id: "redoBtn", onclick: menuRedo, text: Labels.REDO },
        { id: "flipBtn", onclick: flipboard, text: Labels.FLIP },
        { id: "lastMoveBtn", onclick: viewLastMove, text: Labels.LAST_MOVE },
        { id: "homeBtn", onclick: backToHome, text: Labels.HOME },
        { id: "bookmarkBtn", onclick: showBookmarks, text: Labels.BOOKMARKS },
    ];

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
    if (gameInfo.mode === "review") {
        return;
    }
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
    const chatInput = document.getElementById("chatline");
    if (chatInput) { chatInput.value = ""; }
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
    if (isMobileGameShell()) {
        return;
    }
    const bookmarksPanel = document.getElementById("bookmarksPanel");
    if (!bookmarksPanel) {
        return;
    }
    if (bookmarksPanel.style.opacity == "1") {
        closeBookmarkPanel();
    }
    else {
        bookmarksPanel.style.opacity = "1";
        bookmarksPanel.style.width = "260px";
        requestAnimationFrame(function () { initBookmarksPanelDraggable(); });
    }
}

/* eslint-disable-next-line no-unused-vars */
async function addBookmark() {
    if (isMobileGameShell()) {
        return;
    }
    if (dialogOn) {return;}
    const bookmarksListEarly = document.getElementById("bookmarksList");
    if (!bookmarksListEarly) {
        return;
    }
    if (researchMode) {
        const positionErr = getResearchBookmarkPositionValidationMessage();
        if (positionErr) {
            alertMessageBox(positionErr);
            return;
        }
    }

    const bookmarksList = bookmarksListEarly;
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

    const row = document.createElement("div");
    row.classList.add("bookmark-row");
    const gameNameInput = document.createElement("input");
    gameNameInput.setAttribute("placeholder", "Insert bookmark name");
    gameNameInput.setAttribute("id", "newBookmarkName");
    gameNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            onBookmarkAdded(bookmarks.length + 1, gameNameInput.value, new Date(), gameInfo.gameType);
        } else if (e.key === "Escape") {
            e.preventDefault();
            div.remove();
        }
    });
    row.appendChild(gameNameInput);
    div.appendChild(row);
    return div;
}

function toggleBookmarkAccordion(e) {
    const row = e.target.closest(".bookmark-row");
    if (!row) {return;}
    const bookmarkEl = row.closest(".bookmark");
    if (!bookmarkEl) {return;}
    if (e.target.closest(".bookmark-actions") || e.target.closest("input")) {return;}
    if (researchEditingBookmarkId != null) {
        const clickedId = parseInt(bookmarkEl.id.replace("bookmark", ""), 10);
        if (clickedId !== researchEditingBookmarkId) {return;}
    }
    const list = document.getElementById("bookmarksList");
    if (list) {
        list.querySelectorAll(".bookmark.expanded").forEach(function (el) {
            if (el !== bookmarkEl) {el.classList.remove("expanded");}
        });
    }
    const wasExpanded = bookmarkEl.classList.contains("expanded");
    bookmarkEl.classList.toggle("expanded");
    if (!wasExpanded) {
        const bookmarkId = parseInt(bookmarkEl.id.replace("bookmark", ""), 10);
        if (!isNaN(bookmarkId) && (researchEditingBookmarkId == null || researchEditingBookmarkId !== bookmarkId)) {
            applyBookmarkAction(bookmarkId);
        }
    }
}

function createBookmarkDiv(bookmarkId, bookmarkName, bookmarkDate) {
    const div = document.createElement("div");
    div.classList.add("bookmark");
    div.setAttribute("id", "bookmark" + bookmarkId);

    const row = document.createElement("div");
    row.classList.add("bookmark-row");
    row.addEventListener("click", toggleBookmarkAccordion);

    const bookmarkNameWrapper = document.createElement("div");
    bookmarkNameWrapper.setAttribute("class", "bookmarkNameWrapper");
    const nameSpan = document.createElement("span");
    nameSpan.classList.add("bookmarkName");
    nameSpan.setAttribute("id", "bookmarkName");
    nameSpan.innerText = bookmarkName;
    bookmarkNameWrapper.appendChild(nameSpan);
    const nameOuter = document.createElement("span");
    nameOuter.classList.add("bookmark-name");
    nameOuter.appendChild(bookmarkNameWrapper);
    row.appendChild(nameOuter);
    const editModeLabel = document.createElement("span");
    editModeLabel.classList.add("bookmark-edit-mode-label");
    editModeLabel.textContent = "edit mode";
    row.appendChild(editModeLabel);
    const runModeLabel = document.createElement("span");
    runModeLabel.classList.add("bookmark-run-mode-label");
    runModeLabel.textContent = "Run";
    row.appendChild(runModeLabel);
    div.appendChild(row);

    const details = document.createElement("div");
    details.classList.add("bookmark-details");

    const meta = document.createElement("div");
    meta.classList.add("bookmark-meta");
    meta.innerText = formatDate(new Date(bookmarkDate));
    details.appendChild(meta);

    const actions = document.createElement("div");
    actions.classList.add("bookmark-actions");

    const actionsLeft = document.createElement("div");
    actionsLeft.classList.add("bookmark-actions-left");

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "button bookmark-action-btn bookmark-icon-btn";
    deleteBtn.setAttribute("title", "Delete bookmark");
    deleteBtn.setAttribute("aria-label", "Delete bookmark");
    deleteBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/><line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"/><line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"/></svg>";
    deleteBtn.addEventListener("click", function (ev) { ev.stopPropagation(); deleteBookmark(ev); });
    actionsLeft.appendChild(deleteBtn);

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "button bookmark-action-btn bookmark-icon-btn";
    renameBtn.setAttribute("title", "Rename bookmark");
    renameBtn.setAttribute("aria-label", "Rename bookmark");
    renameBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z\"/></svg>";
    renameBtn.addEventListener("click", function (ev) { ev.stopPropagation(); enterEditBookmarkMode({ srcElement: nameSpan }); });
    actionsLeft.appendChild(renameBtn);

    // Editing a bookmark position is only offered in-place; the new Play UI owns position setup elsewhere.
    if (researchMode) {
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "button bookmark-action-btn bookmark-icon-btn bookmark-edit-save-btn";
        editBtn.setAttribute("data-mode", "edit");
        editBtn.setAttribute("title", "Edit – enter edit mode to change position on board");
        editBtn.setAttribute("aria-label", "Edit – enter edit mode to change position on board");
        editBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/><path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/></svg>";
        editBtn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            if (editBtn.disabled) {return;}
            exitBookmarkPositionEditMode();
            researchEditingBookmarkId = bookmarkId;
            div.classList.add("bookmark-editing");
            editBtn.disabled = true;
            disableButtons(["addBookmarkBtn"]);
            researchSelectTool();
        });
        actionsLeft.appendChild(editBtn);
    }

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "button bookmark-action-btn bookmark-icon-btn bookmark-save-position-btn";
    saveBtn.setAttribute("title", "Save – save current position to this bookmark");
    saveBtn.setAttribute("aria-label", "Save – save current position to this bookmark");
    saveBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><path d=\"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z\"/><polyline points=\"17 21 17 13 7 13 7 21\"/><polyline points=\"7 3 7 8 15 8\"/></svg>";
    saveBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (div.classList.contains("bookmark-editing")) {
            saveBookmarkPosition(bookmarkId, null, div);
        }
    });
    actionsLeft.appendChild(saveBtn);

    const discardBtn = document.createElement("button");
    discardBtn.type = "button";
    discardBtn.className = "button bookmark-action-btn bookmark-icon-btn bookmark-discard-btn";
    discardBtn.setAttribute("title", "Discard – exit edit without saving");
    discardBtn.setAttribute("aria-label", "Discard – exit edit without saving");
    discardBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"15\" y1=\"9\" x2=\"9\" y2=\"15\"/><line x1=\"9\" y1=\"9\" x2=\"15\" y2=\"15\"/></svg>";
    discardBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        exitBookmarkPositionEditMode();
    });
    actionsLeft.appendChild(discardBtn);

    actions.appendChild(actionsLeft);

    const actionsRight = document.createElement("div");
    actionsRight.classList.add("bookmark-actions-right");

    if (isResearchScreen()) {
        const bookmarkObj = bookmarks.find(function (el) { return el.id == bookmarkId; });
        const selectedEngine = normalizeBookmarkEngine(bookmarkObj && bookmarkObj.engine);
        const selectedDepth = normalizeBookmarkDepth(bookmarkObj && bookmarkObj.depth);
        const engineSelect = document.createElement("select");
        engineSelect.className = "bookmark-engine-select";
        engineSelect.setAttribute("title", "Brain version");
        engineSelect.setAttribute("aria-label", "Brain version");
        getBookmarkBrainOptions().forEach(function (opt) {
            const optionEl = document.createElement("option");
            optionEl.value = opt.value;
            optionEl.textContent = opt.label;
            if (opt.value === selectedEngine) {
                optionEl.selected = true;
            }
            engineSelect.appendChild(optionEl);
        });
        engineSelect.addEventListener("click", function (ev) {
            ev.stopPropagation();
        });
        engineSelect.addEventListener("change", async function (ev) {
            ev.stopPropagation();
            if (!bookmarkObj || !bookmarkObj._id) {
                return;
            }
            const previousEngine = normalizeBookmarkEngine(bookmarkObj.engine);
            const updatedEngine = normalizeBookmarkEngine(engineSelect.value);
            bookmarkObj.engine = updatedEngine;
            try {
                await postServerInfo("/updateBookmark", { id: bookmarkObj._id, engine: updatedEngine });
                if (researchRunningBookmarkId === bookmarkId) {
                    syncBrainConfigPanelEngine(updatedEngine);
                }
            } catch (error) {
                console.error("Failed to update bookmark brain version:", error);
                bookmarkObj.engine = previousEngine;
                engineSelect.value = previousEngine;
            }
        });
        actionsRight.appendChild(engineSelect);

        const depthSelect = document.createElement("select");
        depthSelect.className = "bookmark-depth-select";
        depthSelect.setAttribute("title", "Depth limit");
        depthSelect.setAttribute("aria-label", "Depth limit");
        BOOKMARK_DEPTH_OPTIONS.forEach(function (depth) {
            const optionEl = document.createElement("option");
            optionEl.value = String(depth);
            optionEl.textContent = "D" + String(depth);
            if (depth === selectedDepth) {
                optionEl.selected = true;
            }
            depthSelect.appendChild(optionEl);
        });
        depthSelect.addEventListener("click", function (ev) {
            ev.stopPropagation();
        });
        depthSelect.addEventListener("change", async function (ev) {
            ev.stopPropagation();
            if (!bookmarkObj || !bookmarkObj._id) {
                return;
            }
            const previousDepth = normalizeBookmarkDepth(bookmarkObj.depth);
            const updatedDepth = normalizeBookmarkDepth(depthSelect.value);
            bookmarkObj.depth = updatedDepth;
            try {
                await postServerInfo("/updateBookmark", { id: bookmarkObj._id, depth: updatedDepth });
            } catch (error) {
                console.error("Failed to update bookmark depth:", error);
                bookmarkObj.depth = previousDepth;
                depthSelect.value = String(previousDepth);
            }
        });
        actionsRight.appendChild(depthSelect);
    }

    const executeBtn = document.createElement("button");
    executeBtn.type = "button";
    executeBtn.className = "button bookmark-action-btn bookmark-icon-btn bookmark-execute-btn";
    executeBtn.setAttribute("title", "Execute – go to game and load this bookmark");
    executeBtn.setAttribute("aria-label", "Execute – go to game and load this bookmark");
    executeBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg>";
    executeBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (isResearchScreen()) {
            const bookmarkObj = bookmarks.find(el => el.id == bookmarkId);
            if (bookmarkObj) {
                executeBtn.disabled = true;
                executeBookmarkFromResearch(bookmarkObj, bookmarkId)
                    .catch(function (error) {
                        console.error("Failed to execute bookmark from research:", error);
                        alertMessageBox("Failed to start game from bookmark.");
                    })
                    .finally(function () {
                        executeBtn.disabled = false;
                    });
            }
        } else {
            applyBookmarkAction(bookmarkId);
        }
    });
    actionsRight.appendChild(executeBtn);

    actions.appendChild(actionsRight);

    details.appendChild(actions);
    div.appendChild(details);
    if (isResearchScreen() && researchRunningBookmarkId != null && researchRunningBookmarkId === bookmarkId) {
        div.classList.add("bookmark-running");
        div.classList.add("expanded");
    }

    return div;
}

function exitBookmarkPositionEditMode() {
    if (researchEditingBookmarkId == null) {return;}
    const list = document.getElementById("bookmarksList");
    if (list) {
        list.querySelectorAll(".bookmark-editing").forEach(function (el) {
            const editBtnEl = el.querySelector(".bookmark-edit-save-btn");
            if (editBtnEl) {editBtnEl.disabled = false;}
            el.classList.remove("bookmark-editing");
        });
    }
    researchEditingBookmarkId = null;
    enableButtons(["addBookmarkBtn"]);
}

async function saveBookmarkPosition(bookmarkId, editBtn, bookmarkDiv) {
    if (researchMode) {
        const positionErr = getResearchBookmarkPositionValidationMessage("save");
        if (positionErr) {
            alertMessageBox(positionErr);
            return;
        }
    }
    const bookmarkObj = bookmarks.find(el => el.id == bookmarkId);
    if (!bookmarkObj) {return;}
    const stateRaw = game.GameState;
    const state = JSON.parse(JSON.stringify(stateRaw));
    const moves = researchMode ? [] : (gameMoves && gameMoves.moves ? gameMoves.moves.map(m => JSON.stringify(m)) : []);
    await postServerInfo("/updateBookmark", {
        id: bookmarkObj._id,
        name: bookmarkObj.name,
        gameType: bookmarkObj.gameType || gameInfo.gameType,
        date: new Date(),
        gameState: state,
        moves: moves
    });
    bookmarkObj.state = state;
    exitBookmarkPositionEditMode();
    bookmarkDiv.classList.remove("bookmark-editing");
}

/** Load bookmark state onto the board only (no redirect). Used when clicking the bookmark name/row in research. */
function loadBookmarkOnBoard(bookmarkId) {
    const bookmarkObj = bookmarks.find(el => el.id == bookmarkId);
    if (!bookmarkObj) {return;}
    const stateStr = typeof bookmarkObj.state === "string" ? bookmarkObj.state : JSON.stringify(bookmarkObj.state);
    const loaded = JSON.parse(stateStr);
    researchSyncKingRookFlagsFromBoard(loaded);
    game.loadGame(JSON.stringify(loaded));
    const state = game.GameState;
    if (state && state.board) { drawBoard(state.board); }
}

/** Apply bookmark: in research, load on board only; in game, apply to server and load. Execute button in research redirects to game instead of calling this. */
async function applyBookmarkAction(bookmarkId) {
    if (isMobileGameShell()) {
        return;
    }
    const bookmarkObj = bookmarks.find(el => el.id == bookmarkId);
    if (!bookmarkObj) {return;}
    const stateStr = typeof bookmarkObj.state === "string" ? bookmarkObj.state : JSON.stringify(bookmarkObj.state);
    if (researchMode) {
        loadBookmarkOnBoard(bookmarkId);
        return;
    }
    if (gameInfo.gameType === "SinglePlayerGame" && gameInfo.id) {
        await postServerInfo("/applyBookmark", { gameId: gameInfo.id, bookarkId: bookmarkObj._id });
    }
    game.loadGame(stateStr);
    const state = game.GameState;
    if (state && state.board) { drawBoard(state.board); }
}

async function onBookmarkAdded(bookmarkId, name, date, gameType) {
    if (isMobileGameShell()) {
        return;
    }
    if (researchMode) {
        const positionErr = getResearchBookmarkPositionValidationMessage("add");
        if (positionErr) {
            alertMessageBox(positionErr);
            return;
        }
    }
    const bookmarksList = document.getElementById("bookmarksList");
    if (!bookmarksList) {
        return;
    }
    const newBookmarkCard = document.getElementById("newBookmark");
    const bookmark = createBookmarkDiv(bookmarkId, name, date);
    bookmarksList.removeChild(newBookmarkCard);
    bookmarksList.prepend(bookmark);

    const state = game.GameState;
    const strMoves = researchMode ? [] : (gameMoves && gameMoves.moves ? gameMoves.moves.map(m => JSON.stringify(m)) : []);
    await postServerInfo("/bookmark", {
        gameState: state,
        name,
        gameType: gameInfo.gameType || gameType,
        moves: strMoves,
        engine: normalizeBookmarkEngine((gameInfo && gameInfo.engine) ? gameInfo.engine : "brain43"),
        depth: 3,
    });
    bookmarks = await getBookmarks();
    updateBookmarks(bookmarks);

}

function exitEditBookmarkMode() {
    const bookmarkNameWrapper = currentEditingBookmark.parentElement;
    const editBookmarkInput = bookmarkNameWrapper.querySelector("#editBookmarkInput");
    if (editBookmarkInput) {bookmarkNameWrapper.removeChild(editBookmarkInput);}
    const nameEl = bookmarkNameWrapper.querySelector(".bookmarkName");
    const renameBtnEl = bookmarkNameWrapper.querySelector(".bookmark-rename-btn");
    if (nameEl) {nameEl.classList.remove("hide");}
    if (renameBtnEl) {renameBtnEl.classList.remove("hide");}
    currentEditingBookmark = null;
}

function enterEditBookmarkMode(e) {
    if (currentEditingBookmark) { return; }
    currentEditingBookmark = e.srcElement;
    const bookmarkNameWrapper = currentEditingBookmark.parentElement;
    const gameNameInput = document.createElement("input");
    gameNameInput.setAttribute("placeholder", "Insert bookmark name");
    gameNameInput.setAttribute("id", "editBookmarkInput");
    gameNameInput.setAttribute("value", currentEditingBookmark.innerText);
    gameNameInput.addEventListener("keypress", (ev) => {
        if (ev.key === "Enter") {
            renameBookmark(gameNameInput);
        }
    });
    gameNameInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
            exitEditBookmarkMode();
        }
    });

    currentEditingBookmark.classList.add("hide");
    const renameBtnEl = bookmarkNameWrapper.querySelector(".bookmark-rename-btn");
    if (renameBtnEl) {renameBtnEl.classList.add("hide");}
    bookmarkNameWrapper.appendChild(gameNameInput);
    gameNameInput.focus();
    gameNameInput.select();
}

function renameBookmark(renameInputElement) {
    const bookmarkEl = renameInputElement.closest ? renameInputElement.closest(".bookmark") : renameInputElement.parentElement.parentElement.parentElement;
    const bookmarkName = renameInputElement.value;
    const id = parseInt((bookmarkEl ? bookmarkEl.id : "").replace("bookmark", "") || "0", 10);
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
    const bookmarkElement = (e.target && e.target.closest ? e.target.closest(".bookmark") : null) || (e.srcElement && e.srcElement.parentElement && e.srcElement.parentElement.parentElement ? e.srcElement.parentElement.parentElement.parentElement : null);
    if (!bookmarkElement || !bookmarkElement.id) {return;}
    const id = parseInt(bookmarkElement.id.replace("bookmark", ""), 10);
    const bookmark = bookmarks.find((o) => o.id == id);
    bookmarks = bookmarks.filter(item => item.id !== id);
    e.stopPropagation();
    const result = await postServerInfo("/deleteBookmark", { id: bookmark._id });
    const success = result && (result === "OK" || result.status === "OK");
    if (success) {
        bookmarkElement.innerHTML = "";
        bookmarkElement.classList.add("bookmarkRemoving");
        bookmarkElement.addEventListener("transitionend", () => {
            bookmarkElement.remove();
        });
    }
}

function updateBookmarks(bookmarks) {

    let i = 1;
    const bookmarksList = document.getElementById("bookmarksList");
    if (!bookmarksList) {
        return;
    }
    bookmarksList.innerHTML = "";

    for (const bookmark of bookmarks) {
        bookmark.id = i;
        const bookmarkDiv = createBookmarkDiv(bookmark.id, bookmark.name, bookmark.date);
        bookmarksList.prepend(bookmarkDiv);
        i++;
    }

}

function closeBookmarkPanel() {
    if (researchMode) {return;}
    const bookmarksPanel = document.getElementById("bookmarksPanel");
    if (!bookmarksPanel) {
        return;
    }
    if (bookmarksPanel.style.opacity == "1") {
        bookmarksPanel.style.opacity = "0";
        bookmarksPanel.style.width = "0px";
        const list = document.getElementById("bookmarksList");
        if (list) {list.querySelectorAll(".bookmark.expanded").forEach(function (el) { el.classList.remove("expanded"); });}
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
    if (researchMode) {
        const loaded = JSON.parse(textArea.value);
        researchSyncKingRookFlagsFromBoard(loaded);
        game.loadGame(JSON.stringify(loaded));
    } else {
        game.loadGame(textArea.value);
    }
    sendCommand("setState", game.GameState);
    const loadGamePanel = document.getElementById("loadGamePanel");
    loadGamePanel.style.visibility = "hidden";
    dialogOn = false;
}