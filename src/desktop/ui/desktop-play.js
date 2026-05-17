/**
 * Desktop single-player chess session (decoupled from chessboard.js).
 */
(function () {
    "use strict";

    const Api = window.DesktopApi;
    const Board = window.DesktopBoard;

    let game = null;
    let gameInfo = null;
    let currentPlayerIsWhite = true;
    let webSocket = null;
    let whiteTimer = 0;
    let blackTimer = 0;
    let whiteHandle = null;
    let blackHandle = null;
    let lastMove = null;
    let autoCompletePromotion = false;
    let dialogOn = false;
    let lastCheckNotifySide = null;
    let alertMode = false;
    let animating = false;
    let redoPairAvailable = false;
    let allowUndo = true;
    let batchUndoRedo = false;

    const ACTION_ICONS = {
        resign:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V12M10 20V4M16 20v-6M22 20V9"/></svg>',
        draw:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
        undo:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14H4V9l1.4 1.4 5.6-5.6 1.4 1.4-5.6 5.6H15v2H9z"/></svg>',
        redo:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 14h5V9l-1.4 1.4-5.6-5.6-1.4 1.4 5.6 5.6H9v2h6z"/></svg>',
        lastMove:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l7-7 7 7M12 5v14"/></svg>',
        flip:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v3l4-4.5L17 1v3H5v6h2V7zm10 10H7v-3l-4 4.5L7 23v-3h12v-6h-2v4z"/></svg>',
        newGame:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
        exit:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3H5a2 2 0 00-2 2v14a2 2 0 002 2h5M14 8l5 4-5 4M11 12h8"/></svg>',
    };

    function $(id) {
        return document.getElementById(id);
    }

    function timerToText(timer) {
        const d = new Date(1970, 0, 1);
        d.setSeconds(timer);
        return d.toLocaleTimeString("eo", { hour12: false });
    }

    function initialClockSeconds() {
        if (typeof gameInfo.gameTimeMinutes === "number" && gameInfo.gameTimeMinutes >= 1) {
            return Math.round(gameInfo.gameTimeMinutes * 60);
        }
        return 90 * 60;
    }

    function resetClocks() {
        if (whiteHandle) {
            clearInterval(whiteHandle);
            whiteHandle = null;
        }
        if (blackHandle) {
            clearInterval(blackHandle);
            blackHandle = null;
        }
        whiteTimer = initialClockSeconds();
        blackTimer =
            typeof gameInfo.blackTimer === "number" && gameInfo.blackTimer > 0
                ? gameInfo.blackTimer
                : whiteTimer;
        const whiteClock = $("whiteClockTimeText");
        const blackClock = $("blackClockTimeText");
        if (whiteClock) {
            whiteClock.textContent = timerToText(whiteTimer);
        }
        if (blackClock) {
            blackClock.textContent = timerToText(blackTimer);
        }
    }

    function updateTimersFromInfo(info) {
        if (typeof info.whiteTimer === "number" && info.whiteTimer >= 0) {
            whiteTimer = info.whiteTimer;
            const el = $("whiteClockTimeText");
            if (el) {
                el.textContent = timerToText(whiteTimer);
            }
        }
        if (typeof info.blackTimer === "number" && info.blackTimer >= 0) {
            blackTimer = info.blackTimer;
            const el = $("blackClockTimeText");
            if (el) {
                el.textContent = timerToText(blackTimer);
            }
        }
    }

    function switchClocks() {
        if (whiteHandle) {
            clearInterval(whiteHandle);
            whiteHandle = null;
        }
        if (blackHandle) {
            clearInterval(blackHandle);
            blackHandle = null;
        }
        const whiteTurnClock = $("whiteTurnClock");
        const blackTurnClock = $("blackTurnClock");
        if (game.Turn === "black") {
            if (whiteTurnClock) {
                whiteTurnClock.classList.add("unvisible");
            }
            if (blackTurnClock) {
                blackTurnClock.classList.remove("unvisible");
            }
            blackHandle = setInterval(function () {
                blackTimer--;
                const el = $("blackClockTimeText");
                if (el) {
                    el.textContent = timerToText(blackTimer);
                }
                if (game.GameOver || blackTimer <= 0) {
                    clearInterval(blackHandle);
                    blackHandle = null;
                    if (blackTimer <= 0 && !game.GameOver) {
                        outOfTime();
                    }
                }
            }, 1000);
        }
        if (game.Turn === "white") {
            if (blackTurnClock) {
                blackTurnClock.classList.add("unvisible");
            }
            if (whiteTurnClock) {
                whiteTurnClock.classList.remove("unvisible");
            }
            whiteHandle = setInterval(function () {
                whiteTimer--;
                const el = $("whiteClockTimeText");
                if (el) {
                    el.textContent = timerToText(whiteTimer);
                }
                if (game.GameOver || whiteTimer <= 0) {
                    clearInterval(whiteHandle);
                    whiteHandle = null;
                    if (whiteTimer <= 0 && !game.GameOver) {
                        outOfTime();
                    }
                }
            }, 1000);
        }
    }

    function outOfTime() {
        const loser = game.Turn;
        showStatus("Time's up! " + loser + " lost", 5000);
        game.OutOfTime = loser;
        sendWs({
            type: "info",
            info: "outOfTime",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite,
            loser: loser,
        });
    }

    function showStatus(message, durationMs) {
        const el = $("desktopPlayStatus");
        if (!el) {
            return;
        }
        el.textContent = message || "";
        el.hidden = !message;
        if (message && durationMs) {
            setTimeout(function () {
                if (el.textContent === message) {
                    el.hidden = true;
                    el.textContent = "";
                }
            }, durationMs);
        }
    }

    function setButtonDisabled(id, disabled) {
        const btn = $(id);
        if (btn) {
            btn.disabled = !!disabled;
        }
    }

    function resolveAllowUndo(info) {
        if (info && info.allowUndo === true) {
            return true;
        }
        if (info && info.allowUndo === false) {
            return false;
        }
        try {
            const raw = localStorage.getItem("shmerling.desktop.lastGameOptions");
            if (raw) {
                const last = JSON.parse(raw);
                if (last.allowUndo === true) {
                    return true;
                }
                if (last.allowUndo === false) {
                    return false;
                }
            }
        } catch (e) {
            /* ignore */
        }
        return false;
    }

    function buildActionRail() {
        const rail = $("desktopPlayActions");
        if (!rail) {
            return;
        }
        const items = [
            { id: "resignBtn", label: "Resign", icon: "resign", onClick: onResign },
            { id: "drawBtn", label: "Draw", icon: "draw", onClick: onDraw },
            { type: "spacer" },
            { id: "undoBtn", label: "Undo", icon: "undo", onClick: onUndo },
            { id: "redoBtn", label: "Redo", icon: "redo", onClick: onRedo },
            { id: "lastMoveBtn", label: "Last move", icon: "lastMove", onClick: onLastMove },
            { id: "flipBtn", label: "Flip", icon: "flip", onClick: onFlip },
            { type: "spacer" },
            {
                id: "rematchBtn",
                label: "New game",
                icon: "newGame",
                onClick: onRematch,
                accent: true,
            },
            { id: "homeBtn", label: "Exit", icon: "exit", onClick: onHome },
        ];
        items.forEach(function (item) {
            if (item.type === "spacer") {
                const spacer = document.createElement("div");
                spacer.className = "desktop-play-actions-spacer";
                rail.appendChild(spacer);
                return;
            }
            const btn = document.createElement("button");
            btn.type = "button";
            btn.id = item.id;
            btn.className =
                "desktop-play-action" + (item.accent ? " desktop-play-action--accent" : "");
            btn.title = item.label;
            const iconWrap = document.createElement("span");
            iconWrap.className = "desktop-play-action-icon";
            iconWrap.innerHTML = ACTION_ICONS[item.icon] || "";
            const label = document.createElement("span");
            label.className = "desktop-play-action-label";
            label.textContent = item.label;
            btn.appendChild(iconWrap);
            btn.appendChild(label);
            btn.addEventListener("click", item.onClick);
            rail.appendChild(btn);
        });
        updateActionButtons();
    }

    function isHumanTurn() {
        return (
            (game.Turn === "white" && currentPlayerIsWhite) ||
            (game.Turn === "black" && !currentPlayerIsWhite)
        );
    }

    function canUndoMovePair() {
        if (!allowUndo || !game || game.GameOver || animating || dialogOn) {
            return false;
        }
        const moveCount = game.Moves ? game.Moves.length : 0;
        return isHumanTurn() && moveCount >= 2;
    }

    function tableMovesFromGame() {
        if (!game || !game.Moves) {
            return [];
        }
        return game.Moves.map(function (m) {
            return typeof m === "string" ? JSON.parse(m) : m;
        });
    }

    function syncBoardFromGame() {
        const state = game.GameState;
        if (state) {
            Board.drawBoard(state.board);
            Board.updateCaptureLists(state.capturedPiecesList || []);
        } else {
            Board.syncFromGameState();
        }
    }

    function updateActionButtons() {
        if (!game) {
            return;
        }
        const over = game.GameOver;
        const hasMoves = game.Moves && game.Moves.length > 0;
        const humanTurn = isHumanTurn();
        const humanHasMoved = currentPlayerIsWhite
            ? game.Moves.length >= 1
            : game.Moves.length >= 2;

        setButtonDisabled("resignBtn", over || animating);
        setButtonDisabled("drawBtn", over || animating || !(humanTurn && humanHasMoved));
        const undoRedoDisabled = !allowUndo || over || animating || dialogOn;
        setButtonDisabled("undoBtn", undoRedoDisabled || !canUndoMovePair());
        setButtonDisabled("redoBtn", undoRedoDisabled || !redoPairAvailable);
        setButtonDisabled("lastMoveBtn", !hasMoves);
        setButtonDisabled("flipBtn", animating);
        setButtonDisabled("rematchBtn", !over);
    }

    function updateMovesTable(moves) {
        const movesDiv = $("movesDiv");
        if (!movesDiv || !moves) {
            return;
        }
        movesDiv.innerHTML = "";
        const table = document.createElement("table");
        table.className = "movesTable";
        for (let i = 0; i < moves.length; i += 2) {
            const whiteMove = moves[i];
            const blackMove = i + 1 < moves.length ? moves[i + 1] : { moveStr: "" };
            const tr = document.createElement("tr");
            const tdNum = document.createElement("td");
            tdNum.textContent = String(i / 2 + 1);
            tdNum.className = "tdNum";
            const tdWhite = document.createElement("td");
            tdWhite.textContent = whiteMove.moveStr || "";
            tdWhite.className = "tdMove";
            const tdBlack = document.createElement("td");
            tdBlack.textContent = blackMove.moveStr || "";
            tdBlack.className = "tdMove";
            tr.appendChild(tdNum);
            tr.appendChild(tdWhite);
            tr.appendChild(tdBlack);
            table.appendChild(tr);
        }
        movesDiv.appendChild(table);
        movesDiv.scrollTop = movesDiv.scrollHeight;
    }

    async function loadGameInfo() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        if (!id) {
            throw new Error("No game id");
        }
        return Api.get("/gameInfo?id=" + encodeURIComponent(id));
    }

    async function loadMoves() {
        return Api.get("/gameMoves");
    }

    function registerGameEvents() {
        game.OnUpdate = onGameUpdate;
        game.OnPromotion = onPromotion;
        game.OnDraw = onDraw;
        game.OnUndo = onUndoEvent;
    }

    async function onUndoEvent(moves) {
        if (batchUndoRedo) {
            return;
        }
        animating = true;
        const move = moves && moves.length ? moves[moves.length - 1] : null;
        if (move) {
            Board.clearArrows();
            await Board.animateUndoMove(move);
        } else {
            Board.syncFromGameState();
        }
        animating = false;
        redoPairAvailable = true;
        updateMovesTable(tableMovesFromGame());
        updateActionButtons();
    }

    async function onGameUpdate(gameState) {
        if (batchUndoRedo) {
            return;
        }
        Board.drawBoard(gameState.board);
        Board.updateCaptureLists(gameState.capturedPiecesList || []);
        const moves = await loadMoves();
        updateMovesTable(moves.moves || []);

        if (gameState.checkmate) {
            lastCheckNotifySide = null;
            onCheckmate(game.Turn);
        } else if (gameState.check === true) {
            if (lastCheckNotifySide !== game.Turn) {
                onCheck(game.Turn);
                lastCheckNotifySide = game.Turn;
            }
        } else if (alertMode && !gameState.check && !gameState.checkmate && !gameState.draw) {
            alertMode = false;
            lastCheckNotifySide = null;
            showStatus("");
        }

        updateActionButtons();
    }

    function onCheck(turn) {
        alertMode = true;
        showStatus("Check", 2000);
        document.querySelectorAll(".frame").forEach(function (el) {
            el.classList.add("checkAlert");
        });
    }

    function onCheckmate(turn) {
        alertMode = true;
        showStatus("Checkmate! " + game.opponent(game.colorName(turn)) + " wins!", 5000);
        document.querySelectorAll(".frame").forEach(function (el) {
            el.classList.remove("checkAlert");
            el.classList.add("checkmateAlert");
        });
        if (whiteHandle) {
            clearInterval(whiteHandle);
        }
        if (blackHandle) {
            clearInterval(blackHandle);
        }
        updateActionButtons();
    }

    function onDraw(reason) {
        alertMode = true;
        showStatus("Draw! " + reason, 5000);
        if (whiteHandle) {
            clearInterval(whiteHandle);
        }
        if (blackHandle) {
            clearInterval(blackHandle);
        }
        updateActionButtons();
    }

    async function onPromotion(turn) {
        const opponentMove =
            (currentPlayerIsWhite && turn === "black") ||
            (!currentPlayerIsWhite && turn === "white");
        if (opponentMove || autoCompletePromotion) {
            return;
        }
        lastMove = game.LastMove;
        dialogOn = true;
        showStatus("Choose promotion piece");
        return new Promise(function (resolve) {
            Board.showPromotionDialog(async function (selectedPiece) {
                if (!lastMove) {
                    dialogOn = false;
                    showStatus("");
                    resolve();
                    return;
                }
                lastMove.selectedPiece = selectedPiece;
                game.completePromotion(lastMove);
                dialogOn = false;
                Board.syncFromGameState();
                syncBoardFromGame();
                redoPairAvailable = false;
                await sendMove(lastMove);
                switchClocks();
                updateMovesTable(tableMovesFromGame());
                updateActionButtons();
                showStatus("");
                resolve();
            });
        });
    }

    async function onHumanMove(executed) {
        lastMove = executed;
        redoPairAvailable = false;
        Board.clearArrows();
        switchClocks();
        await sendMove(executed);
        const moves = await loadMoves();
        updateMovesTable(moves.moves || []);
        updateActionButtons();
    }

    function sendWs(message) {
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
            webSocket.send(JSON.stringify(message));
        }
    }

    function movesForServerSync() {
        return tableMovesFromGame().map(function (m) {
            const copy = Object.assign({}, m);
            if (typeof copy.moveTime !== "number") {
                copy.moveTime = copy.turn === "white" ? whiteTimer : blackTimer;
            }
            if (typeof copy.whiteTimer !== "number") {
                copy.whiteTimer = whiteTimer;
            }
            if (typeof copy.blackTimer !== "number") {
                copy.blackTimer = blackTimer;
            }
            return copy;
        });
    }

    function syncServerGameState() {
        if (!game || !gameInfo || !Api.post) {
            return Promise.resolve();
        }
        return Api.post("/app/api/game/sync-state", {
            state: game.GameState,
            moves: movesForServerSync(),
            turn: game.Turn,
        }).catch(function (err) {
            console.error("Failed to sync game state after undo/redo:", err);
        });
    }

    async function sendMove(moveObj) {
        moveObj.moveTime = currentPlayerIsWhite ? whiteTimer : blackTimer;
        moveObj.whiteTimer = whiteTimer;
        moveObj.blackTimer = blackTimer;
        sendWs({
            type: "move",
            data: moveObj,
            gameId: gameInfo.id,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite,
        });
    }

    async function moveAccepted(move) {
        const moveStr = move && move.moveStr != null ? move.moveStr : "";
        sendWs({
            type: "info",
            info: "move accepted",
            gameId: gameInfo.id,
            userId: gameInfo.userId,
            username: gameInfo.username,
            isWhite: currentPlayerIsWhite,
            moveTime: currentPlayerIsWhite ? whiteTimer : blackTimer,
            moveStr: moveStr,
            whiteTimer: whiteTimer,
            blackTimer: blackTimer,
        });
    }

    function startWebSocket() {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        webSocket = new WebSocket(protocol + "//" + window.location.host + "/ws", "protocolOne");
        webSocket.onopen = function () {
            sendWs({
                type: "connection",
                data: {
                    username: gameInfo.username,
                    isWhite: currentPlayerIsWhite,
                    gameId: gameInfo.id,
                    creatorId: gameInfo.creatorId,
                    userId: gameInfo.userId,
                },
            });
        };
        webSocket.onmessage = async function (event) {
            const message = JSON.parse(event.data);
            if (message.type === "move") {
                if (game.GameOver) {
                    const moves = await loadMoves();
                    updateMovesTable(moves.moves || []);
                    return;
                }
                const move = message.data;
                if (move.promotion && !move.selectedPiece) {
                    return;
                }
                if (move.promotion) {
                    await Board.animateMove(move);
                    game.makeMove(move.source, move.target);
                    game.completePromotion(move);
                } else {
                    await Board.animateMove(move);
                    game.makeMove(move.source, move.target);
                }
                lastMove = { source: move.source, target: move.target };
                redoPairAvailable = false;
                await moveAccepted(move);
                if (typeof message.isWhite === "boolean" && typeof move.moveTime === "number") {
                    if (message.isWhite) {
                        whiteTimer = move.moveTime;
                    } else {
                        blackTimer = move.moveTime;
                    }
                    updateTimersFromInfo({ whiteTimer: whiteTimer, blackTimer: blackTimer });
                }
                switchClocks();
                const moves = await loadMoves();
                updateMovesTable(moves.moves || []);
                updateActionButtons();
                sendWs({
                    type: "info",
                    info: "clockSync",
                    gameId: gameInfo.id,
                    whiteTimer: whiteTimer,
                    blackTimer: blackTimer,
                });
            }
            if (message.type === "clockSync") {
                if (
                    typeof message.whiteTimer === "number" &&
                    typeof message.blackTimer === "number"
                ) {
                    whiteTimer = message.whiteTimer;
                    blackTimer = message.blackTimer;
                    updateTimersFromInfo(message);
                    switchClocks();
                }
            }
            if (message.type === "info" && message.info === "game over") {
                updateActionButtons();
            }
        };
    }

    function confirmDialog(text, onYes) {
        if (dialogOn) {
            return;
        }
        dialogOn = true;
        const overlay = document.createElement("div");
        overlay.className = "desktop-play-dialog-overlay";
        const panel = document.createElement("div");
        panel.className = "desktop-play-dialog";
        const p = document.createElement("p");
        p.textContent = text;
        panel.appendChild(p);
        const actions = document.createElement("div");
        actions.className = "desktop-play-dialog-actions";
        const yes = document.createElement("button");
        yes.type = "button";
        yes.className = "desktop-btn desktop-btn-primary";
        yes.textContent = "Yes";
        const no = document.createElement("button");
        no.type = "button";
        no.className = "desktop-btn";
        no.textContent = "No";
        yes.addEventListener("click", function () {
            overlay.remove();
            dialogOn = false;
            onYes();
        });
        no.addEventListener("click", function () {
            overlay.remove();
            dialogOn = false;
        });
        actions.appendChild(yes);
        actions.appendChild(no);
        panel.appendChild(actions);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    }

    function onResign() {
        if (game.GameOver) {
            return;
        }
        confirmDialog("Resign this game?", async function () {
            const player = currentPlayerIsWhite ? "White" : "Black";
            game.resign(player);
            sendWs({
                type: "info",
                info: "resign",
                gameId: gameInfo.id,
                userId: gameInfo.userId,
                username: gameInfo.username,
                isWhite: currentPlayerIsWhite,
                moveTime: currentPlayerIsWhite ? whiteTimer : blackTimer,
                whiteTimer: whiteTimer,
                blackTimer: blackTimer,
            });
            updateActionButtons();
        });
    }

    function onDraw() {
        if (game.GameOver || $("drawBtn").disabled) {
            return;
        }
        confirmDialog("Offer a draw?", function () {
            sendWs({
                type: "info",
                info: "offer draw",
                gameId: gameInfo.id,
                userId: gameInfo.userId,
                username: gameInfo.username,
                isWhite: currentPlayerIsWhite,
            });
            showStatus("Draw offer sent");
            updateActionButtons();
        });
    }

    async function onUndo() {
        if (!canUndoMovePair() || $("undoBtn").disabled) {
            return;
        }
        animating = true;
        batchUndoRedo = true;
        game.undo();
        game.undo();
        batchUndoRedo = false;
        Board.clearArrows();
        syncBoardFromGame();
        animating = false;
        redoPairAvailable = true;
        updateMovesTable(tableMovesFromGame());
        await syncServerGameState();
        updateActionButtons();
    }

    async function onRedo() {
        if (!allowUndo || !redoPairAvailable || $("redoBtn").disabled || game.GameOver || dialogOn || animating) {
            return;
        }
        animating = true;
        batchUndoRedo = true;
        game.redo();
        game.redo();
        batchUndoRedo = false;
        Board.clearArrows();
        syncBoardFromGame();
        animating = false;
        redoPairAvailable = false;
        updateMovesTable(tableMovesFromGame());
        await syncServerGameState();
        updateActionButtons();
    }

    function onLastMove() {
        if ($("lastMoveBtn").disabled) {
            return;
        }
        Board.toggleLastMoveArrow();
    }

    function onFlip() {
        if ($("flipBtn").disabled) {
            return;
        }
        Board.flipBoard();
    }

    function onRematch() {
        if (!game.GameOver) {
            return;
        }
        window.location.href = "/app/new-game";
    }

    function onHome() {
        if (game.GameOver) {
            window.location.href = "/app/";
            return;
        }
        const humanHasMoved = currentPlayerIsWhite
            ? game.Moves.length >= 1
            : game.Moves.length >= 2;
        if (!humanHasMoved) {
            window.location.href = "/app/";
            return;
        }
        confirmDialog("Leave and resign?", function () {
            const player = currentPlayerIsWhite ? "White" : "Black";
            game.resign(player);
            sendWs({
                type: "info",
                info: "resign",
                gameId: gameInfo.id,
                userId: gameInfo.userId,
                username: gameInfo.username,
                isWhite: currentPlayerIsWhite,
                moveTime: currentPlayerIsWhite ? whiteTimer : blackTimer,
                whiteTimer: whiteTimer,
                blackTimer: blackTimer,
            });
            window.location.href = "/app/";
        });
    }

    async function startSession() {
        gameInfo = await loadGameInfo();
        if (gameInfo.gameType !== "SinglePlayerGame") {
            throw new Error("Desktop play supports single-player games only");
        }

        allowUndo = resolveAllowUndo(gameInfo);
        currentPlayerIsWhite = gameInfo.username === gameInfo.whitePlayerName;
        const opponentName = currentPlayerIsWhite
            ? gameInfo.blackPlayerName
            : gameInfo.whitePlayerName;
        const selfName = currentPlayerIsWhite
            ? gameInfo.whitePlayerName
            : gameInfo.blackPlayerName;
        const oppNameEl = document.querySelector(".desktop-play-player--opponent .desktop-play-player-name");
        const selfNameEl = document.querySelector(".desktop-play-player--you .desktop-play-player-name");
        if (oppNameEl) {
            oppNameEl.textContent = opponentName || "Opponent";
        }
        if (selfNameEl) {
            selfNameEl.textContent = selfName || "You";
        }

        game = new ChessGame();
        Board.setGame(game);
        Board.setPlayerView(currentPlayerIsWhite);
        Board.setPreferences({
            mouse: gameInfo.mousePreference || "drag",
            showAvailableMoves: gameInfo.showAvailableMoves !== false,
        });
        Board.setHumanMoveHandler(onHumanMove);
        Board.mount("chessboard");
        Board.registerInput();
        registerGameEvents();

        if (gameInfo.gameState) {
            game.loadGame(JSON.stringify(gameInfo.gameState));
            const movesData = await loadMoves();
            let tableMoves = movesData.moves || [];
            if (tableMoves.length > 0) {
                tableMoves = tableMoves.map(function (m) {
                    return typeof m === "string" ? JSON.parse(m) : m;
                });
                game.loadMoves(tableMoves);
            }
            updateMovesTable(tableMoves);
            updateTimersFromInfo(gameInfo);
            switchClocks();
        } else {
            game.startNewGame(currentPlayerIsWhite);
            const movesData = await loadMoves();
            updateMovesTable(movesData.moves || []);
            resetClocks();
        }

        Board.syncFromGameState();
        startWebSocket();
        updateActionButtons();
    }

    document.addEventListener("DOMContentLoaded", function () {
        buildActionRail();
        startSession().catch(function (err) {
            showStatus(err.message || "Could not load game", 0);
            console.error(err);
        });
    });
})();
