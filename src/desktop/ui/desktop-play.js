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

    function buildToolbar() {
        const bar = $("desktopPlayToolbar");
        if (!bar) {
            return;
        }
        const buttons = [
            { id: "resignBtn", label: "Resign", onClick: onResign },
            { id: "drawBtn", label: "Draw", onClick: onDraw },
            { id: "rematchBtn", label: "New game", onClick: onRematch },
            { id: "homeBtn", label: "Home", onClick: onHome },
        ];
        buttons.forEach(function (b) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.id = b.id;
            btn.className = "desktop-btn desktop-play-toolbar-btn";
            btn.textContent = b.label;
            btn.addEventListener("click", b.onClick);
            bar.appendChild(btn);
        });
        setButtonDisabled("rematchBtn", true);
        setButtonDisabled("drawBtn", true);
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
    }

    async function onGameUpdate(gameState) {
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

        if (game.GameOver) {
            setButtonDisabled("rematchBtn", false);
        }

        if (!game.GameOver) {
            const humanTurn =
                (game.Turn === "white" && currentPlayerIsWhite) ||
                (game.Turn === "black" && !currentPlayerIsWhite);
            const humanHasMoved = currentPlayerIsWhite
                ? game.Moves.length >= 1
                : game.Moves.length >= 2;
            setButtonDisabled("drawBtn", !(humanTurn && humanHasMoved));
        }
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
        setButtonDisabled("resignBtn", true);
        setButtonDisabled("drawBtn", true);
        setButtonDisabled("rematchBtn", false);
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
        setButtonDisabled("resignBtn", true);
        setButtonDisabled("drawBtn", true);
        setButtonDisabled("rematchBtn", false);
    }

    async function onPromotion(turn) {
        const opponentMove =
            (currentPlayerIsWhite && turn === "black") ||
            (!currentPlayerIsWhite && turn === "white");
        if (opponentMove || autoCompletePromotion) {
            return;
        }
        showStatus("Promotion");
        return new Promise(function (resolve) {
            Board.showPromotionDialog(function (selectedPiece) {
                lastMove.selectedPiece = selectedPiece;
                game.completePromotion(lastMove);
                sendMove(lastMove);
                showStatus("");
                resolve();
            });
        });
    }

    async function onHumanMove(executed) {
        lastMove = executed;
        switchClocks();
        await sendMove(executed);
        const moves = await loadMoves();
        updateMovesTable(moves.moves || []);
    }

    function sendWs(message) {
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
            webSocket.send(JSON.stringify(message));
        }
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
                setButtonDisabled("rematchBtn", false);
                setButtonDisabled("resignBtn", true);
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
            setButtonDisabled("resignBtn", true);
            setButtonDisabled("drawBtn", true);
            setButtonDisabled("rematchBtn", false);
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
            setButtonDisabled("drawBtn", true);
        });
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
    }

    document.addEventListener("DOMContentLoaded", function () {
        buildToolbar();
        startSession().catch(function (err) {
            showStatus(err.message || "Could not load game", 0);
            console.error(err);
        });
    });
})();
