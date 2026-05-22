/**
 * Desktop single-player chess — local ChessGame + in-process brain (Electron IPC).
 * No WebSocket or server-side game session.
 */
(function () {
    "use strict";

    const Api = window.DesktopApi;
    const Board = window.DesktopBoard;
    const Setup = window.DesktopPositionSetup;
    const GameRun = window.DesktopGameRun;
    const PositionValidation = window.DesktopPositionValidation;

    let game = null;
    const Settings = window.DesktopGameSettings;
    const Engine = window.DesktopEngine;
    const Dialog = window.DesktopDialog;
    const NewGameDialog = window.DesktopNewGameDialog;

    let session = null;
    let gameActive = false;
    let currentPlayerIsWhite = true;
    let whiteTimer = 0;
    let blackTimer = 0;
    let whiteHandle = null;
    let blackHandle = null;
    let lastMove = null;
    let autoCompletePromotion = false;
    let dialogOn = false;
    let lastCheckNotifySide = null;
    let alertMode = false;
    let headerEventMessage = null;
    let headerEventKind = null;
    let headerEventTimer = null;
    let animating = false;
    let redoPairAvailable = false;
    let allowUndo = true;
    let batchUndoRedo = false;
    let savedGames = [];
    let expandedSavedGameId = null;
    let lastLoadedSavedGameId = null;
    let renamingSavedGameId = null;
    let positionSetupMode = false;
    let positionSetupSnapshot = null;
    let positionSetupPanelMounted = false;
    let gameRunPanelMounted = false;
    let currentGameId = null;

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
        save:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
        positionSetup:
            '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    };

    function $(id) {
        return document.getElementById(id);
    }

    function generateGameId() {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        return (
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).slice(2, 10)
        );
    }

    function assignNewGameId() {
        currentGameId = generateGameId();
        updateGameIdLabel();
    }

    function setCurrentGameId(id) {
        currentGameId = id ? String(id) : null;
        updateGameIdLabel();
    }

    function updateGameIdLabel() {
        const el = $("desktopPlayGameId");
        if (!el) {
            return;
        }
        if (currentGameId) {
            el.textContent = currentGameId;
            el.hidden = false;
        } else {
            el.textContent = "";
            el.hidden = true;
        }
    }

    /** Let the browser paint (clear move highlights) before heavy work. */
    function yieldForPaint() {
        return new Promise(function (resolve) {
            requestAnimationFrame(function () {
                requestAnimationFrame(resolve);
            });
        });
    }

    function timerToText(timer) {
        const d = new Date(1970, 0, 1);
        d.setSeconds(timer);
        return d.toLocaleTimeString("eo", { hour12: false });
    }

    function initialClockSeconds() {
        if (session && typeof session.gameTimeMinutes === "number" && session.gameTimeMinutes >= 1) {
            return Math.round(session.gameTimeMinutes * 60);
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
            session &&
            typeof session.blackTimer === "number" &&
            session.blackTimer > 0
                ? session.blackTimer
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

    const STATUS_BAR_CLASSES = [
        "desktop-play-status-bar--event",
        "desktop-play-status-bar--check",
        "desktop-play-status-bar--checkmate",
        "desktop-play-status-bar--draw",
        "desktop-play-status-bar--promotion",
        "desktop-play-status-bar--info",
        "desktop-play-status-bar--timeout",
        "desktop-play-status-bar--error",
    ];

    function updateHeaderClockHighlight() {
        const headerBlack = $("desktopPlayHeaderBlack");
        const headerWhite = $("desktopPlayHeaderWhite");
        if (!game) {
            return;
        }
        const active = !game.GameOver && !headerEventMessage;
        if (headerBlack) {
            headerBlack.classList.toggle("desktop-play-header-clock--active", active && game.Turn === "black");
        }
        if (headerWhite) {
            headerWhite.classList.toggle("desktop-play-header-clock--active", active && game.Turn === "white");
        }
    }

    function clearHeaderEvent() {
        if (headerEventTimer) {
            clearTimeout(headerEventTimer);
            headerEventTimer = null;
        }
        headerEventMessage = null;
        headerEventKind = null;
        refreshStatusBar();
    }

    function defaultStatusText() {
        if (!game) {
            return "";
        }
        if (!gameActive && !positionSetupMode) {
            if (boardHasPieces()) {
                return "Set next move and computer color in the header, then press Play";
            }
            return "Choose New game or Position setup from the sidebar";
        }
        if (game.GameOver) {
            return "Game over";
        }
        return "Game in progress";
    }

    function refreshStatusBar() {
        const statusEl = $("desktopPlayStatusBar");
        if (!statusEl) {
            return;
        }
        STATUS_BAR_CLASSES.forEach(function (cls) {
            statusEl.classList.remove(cls);
        });
        updateHeaderClockHighlight();
        if (headerEventMessage) {
            statusEl.textContent = headerEventMessage;
            statusEl.classList.add("desktop-play-status-bar--event");
            if (headerEventKind) {
                statusEl.classList.add("desktop-play-status-bar--" + headerEventKind);
            }
            return;
        }
        statusEl.textContent = defaultStatusText();
    }

    function updateHeaderTurn() {
        refreshStatusBar();
    }

    function formatSessionTypeLabel() {
        if (positionSetupMode) {
            return "Position Setup";
        }
        return "Game Mode";
    }

    function updateMatchHeader() {
        const titleEl = $("desktopPlayMatchTitle");
        if (titleEl) {
            titleEl.textContent = formatSessionTypeLabel();
        }
        if (!session) {
            return;
        }
        const whiteName = session.whitePlayerName || "White";
        const blackName = session.blackPlayerName || "Black";
        const whiteNameEl = $("desktopPlayWhiteName");
        const blackNameEl = $("desktopPlayBlackName");
        if (whiteNameEl) {
            whiteNameEl.textContent = whiteName;
        }
        if (blackNameEl) {
            blackNameEl.textContent = blackName;
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
        updateHeaderTurn();
        if (game.Turn === "black") {
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
        showStatus("Time's up! " + loser + " lost", 5000, "timeout");
        game.OutOfTime = loser;
        updateActionButtons();
    }

    /**
     * Show a game event in the bottom status bar.
     * @param {string} message
     * @param {number} [durationMs] Auto-clear after ms; omit to keep until cleared.
     * @param {string} [kind] check | checkmate | draw | promotion | info | timeout | error
     */
    function showStatus(message, durationMs, kind) {
        if (!message) {
            clearHeaderEvent();
            return;
        }
        if (headerEventTimer) {
            clearTimeout(headerEventTimer);
            headerEventTimer = null;
        }
        headerEventMessage = message;
        headerEventKind = kind || "info";
        alertMode = headerEventKind !== "info";
        refreshStatusBar();
        if (durationMs) {
            headerEventTimer = setTimeout(function () {
                if (headerEventMessage === message) {
                    clearHeaderEvent();
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

    function pauseClocksForSetup() {
        if (whiteHandle) {
            clearInterval(whiteHandle);
            whiteHandle = null;
        }
        if (blackHandle) {
            clearInterval(blackHandle);
            blackHandle = null;
        }
    }

    function capturePositionSetupSnapshot() {
        return {
            stateStr: JSON.stringify(game.GameState),
            moves: tableMovesFromGame(),
            whiteTimer: whiteTimer,
            blackTimer: blackTimer,
            clocksWereRunning: !!(whiteHandle || blackHandle),
            currentPlayerIsWhite: currentPlayerIsWhite,
            whitePlayerView: game.WhitePlayerView,
        };
    }

    function restorePositionSetupSnapshot() {
        if (!positionSetupSnapshot) {
            return;
        }
        game.loadGame(positionSetupSnapshot.stateStr);
        game.loadMoves(positionSetupSnapshot.moves);
        whiteTimer = positionSetupSnapshot.whiteTimer;
        blackTimer = positionSetupSnapshot.blackTimer;
        if (typeof positionSetupSnapshot.currentPlayerIsWhite === "boolean") {
            currentPlayerIsWhite = positionSetupSnapshot.currentPlayerIsWhite;
            if (Board.setHumanColor) {
                Board.setHumanColor(currentPlayerIsWhite);
            }
        }
        if (typeof positionSetupSnapshot.whitePlayerView === "boolean") {
            game.WhitePlayerView = positionSetupSnapshot.whitePlayerView;
            Board.setPlayerView(positionSetupSnapshot.whitePlayerView);
        }
        updateTimersFromInfo({ whiteTimer: whiteTimer, blackTimer: blackTimer });
        Board.syncFromGameState();
        updateMovesTable(positionSetupSnapshot.moves);
        updateHeaderTurn();
        if (positionSetupSnapshot.clocksWereRunning && !game.GameOver) {
            switchClocks();
        }
        positionSetupSnapshot = null;
    }

    function applySetupTurn(turn) {
        if (!game || !game.GameState) {
            return;
        }
        const next = turn === "black" ? "black" : "white";
        if (positionSetupMode) {
            Board.mutateSetupBoard(function (state) {
                state.turn = next;
            });
        } else if (!gameActive && boardHasPieces()) {
            const state = JSON.parse(JSON.stringify(game.GameState));
            state.turn = next;
            game.loadGame(JSON.stringify(state));
            Board.syncFromGameState();
        }
        updateHeaderTurn();
    }

    function applySetupComputerColor(isComputerWhite) {
        currentPlayerIsWhite = !isComputerWhite;
        if (Board.setHumanColor) {
            Board.setHumanColor(currentPlayerIsWhite);
        }
        updateMatchHeader();
        updateActionButtons();
    }

    function clearSetupBoard() {
        Board.mutateSetupBoard(function (state) {
            state.board = Array.from({ length: game.BOARD_ROWS }, function () {
                return Array(game.BOARD_COLUMNS).fill(null);
            });
            state.capturedPiecesList = [];
        });
    }

    function syncEmptyBoard() {
        if (!game) {
            return;
        }
        const whiteView = game.WhitePlayerView !== false;
        if (!game.GameState) {
            game.startNewGame(whiteView);
        }
        Board.mutateSetupBoard(function (state) {
            state.board = Array.from({ length: game.BOARD_ROWS }, function () {
                return Array(game.BOARD_COLUMNS).fill(null);
            });
            state.capturedPiecesList = [];
            state.gameOver = false;
            state.promoting = false;
            state.check = false;
            state.checkmate = false;
            state.draw = false;
        });
        game.loadMoves([]);
        Board.syncFromGameState();
        if (Board.updateCaptureLists) {
            Board.updateCaptureLists([]);
        }
        if (Board.clearKingHighlights) {
            Board.clearKingHighlights();
        }
    }

    function loadDefaultSetupBoard() {
        const wv = game.GameState && game.GameState.whitePlayerView !== false;
        game.startNewGame(wv);
        Board.syncFromGameState();
    }

    function updateSetupCursor() {
        if (!Setup || !Setup.applySetupCursor) {
            return;
        }
        Setup.applySetupCursor(document.getElementById("innerBoard"), Setup.getSelection());
    }

    function setPositionSetupUi(active) {
        positionSetupMode = !!active;
        const btn = $("positionSetupBtn");
        if (btn) {
            btn.classList.toggle("desktop-play-action--active", positionSetupMode);
        }
        const sidebar = $("desktopPlaySidebarMoves");
        if (sidebar) {
            sidebar.classList.toggle("desktop-play-sidebar--position-setup", positionSetupMode);
        }
        updateMatchHeader();
    }

    function expandMovesSidebar() {
        const sidebar = $("desktopPlaySidebarMoves");
        if (!sidebar) {
            return;
        }
        if (window.DesktopDockPanels && DesktopDockPanels.setSidebarCollapsed) {
            DesktopDockPanels.setSidebarCollapsed(sidebar, false);
            return;
        }
        sidebar.classList.remove("desktop-play-sidebar--collapsed");
        const expandTab = sidebar.querySelector(".desktop-play-sidebar-tab--expand");
        if (expandTab) {
            expandTab.hidden = true;
        }
        sidebar.querySelectorAll(".desktop-play-dock-toggle--collapse").forEach(function (btn) {
            btn.hidden = false;
        });
        if (window.DesktopBoardScale && typeof window.DesktopBoardScale.refresh === "function") {
            window.DesktopBoardScale.refresh();
        }
    }

    function ensureGameRunPanel() {
        if (gameRunPanelMounted || !GameRun) {
            return;
        }
        const panel = $("desktopPlayGameRun");
        if (!panel) {
            return;
        }
        GameRun.mount(panel, {
            initialTurn: game && game.Turn ? game.Turn : "white",
            initialComputerIsWhite: !currentPlayerIsWhite,
            onPlay: runGameFromPanel,
            onTurnChange: applySetupTurn,
            onComputerColorChange: applySetupComputerColor,
        });
        gameRunPanelMounted = true;
    }

    function syncGameRunPanelOptions() {
        if (!GameRun || !GameRun.syncOptions) {
            return;
        }
        const turn =
            game && (game.Turn || (game.GameState && game.GameState.turn))
                ? game.Turn || game.GameState.turn
                : "white";
        GameRun.syncOptions({
            turn: turn,
            computerIsWhite: !currentPlayerIsWhite,
        });
    }

    function boardHasPieces() {
        if (!game || !game.GameState || !game.GameState.board) {
            return false;
        }
        const board = game.GameState.board;
        for (let r = 0; r < board.length; r++) {
            const row = board[r];
            if (!row) {
                continue;
            }
            for (let c = 0; c < row.length; c++) {
                if (row[c]) {
                    return true;
                }
            }
        }
        return false;
    }

    async function runGameFromPanel() {
        if (positionSetupMode) {
            await applyPositionSetup();
            return;
        }
        if (!boardHasPieces()) {
            showStatus(
                "Select a saved game or set up a position on the board first",
                3000,
                "info",
            );
            return;
        }
        if (gameActive) {
            showStatus("A game is already in progress", 2500, "info");
            return;
        }
        await startGameFromLoadedPosition();
    }

    async function startGameFromLoadedPosition() {
        if (!game || !game.GameState) {
            return;
        }
        if (!validatePositionSetup("play")) {
            return;
        }
        const setupOpts =
            GameRun && GameRun.getOptions
                ? GameRun.getOptions()
                : { turn: "white", humanIsWhite: currentPlayerIsWhite };
        const state = JSON.parse(JSON.stringify(game.GameState));
        state.turn = setupOpts.turn === "black" ? "black" : "white";
        state.gameOver = false;
        state.promoting = false;
        state.capturedPiecesList = state.capturedPiecesList || [];
        game.loadGame(JSON.stringify(state));
        game.loadMoves([]);
        currentPlayerIsWhite = setupOpts.humanIsWhite !== false;
        if (Board.setHumanColor) {
            Board.setHumanColor(currentPlayerIsWhite);
        }
        assignNewGameId();
        whiteTimer = initialClockSeconds();
        blackTimer = initialClockSeconds();
        updateTimersFromInfo({ whiteTimer: whiteTimer, blackTimer: blackTimer });
        redoPairAvailable = false;
        lastCheckNotifySide = null;
        alertMode = false;
        Board.syncFromGameState();
        if (Board.updateCaptureLists && game.GameState.capturedPiecesList) {
            Board.updateCaptureLists(game.GameState.capturedPiecesList);
        }
        updateMovesTable([]);
        updateMatchHeader();
        updateHeaderTurn();
        gameActive = true;
        document.body.classList.add("desktop-play-has-active-game");
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(true);
        }
        updateActionButtons();
        if (!game.GameOver && isHumanTurn()) {
            switchClocks();
            showStatus("Your move", 2000, "info");
        } else if (!game.GameOver && isAiTurn()) {
            showStatus("Engine to move…", 0, "info");
            await runEngineMove();
        }
    }

    function ensurePositionSetupPanel() {
        if (positionSetupPanelMounted || !Setup) {
            return;
        }
        const panel = $("desktopPlaySetupPanel");
        if (!panel) {
            return;
        }
        Setup.mountPanel(panel, {
            game: game,
            initialTurn: game.Turn || (game.GameState && game.GameState.turn) || "white",
            initialHumanIsWhite: currentPlayerIsWhite,
            onClearBoard: clearSetupBoard,
            onDefaultBoard: loadDefaultSetupBoard,
            onSavePosition: saveSetupPosition,
            onValidatePosition: validateSetupPosition,
            onSelectTool: updateSetupCursor,
        });
        positionSetupPanelMounted = true;
    }

    function enterPositionSetupMode() {
        setCurrentGameId(null);
        positionSetupSnapshot = capturePositionSetupSnapshot();
        pauseClocksForSetup();
        Board.clearArrows();
        expandMovesSidebar();
        setPositionSetupUi(true);
        ensurePositionSetupPanel();
        Board.setSetupMode(true, {
            getSelection: function () {
                return Setup ? Setup.getSelection() : null;
            },
            onCursorUpdate: updateSetupCursor,
        });
        if (Setup && Setup.resetDefaultSelection) {
            Setup.resetDefaultSelection();
        } else {
            updateSetupCursor();
        }
        const moveCount = game.Moves ? game.Moves.length : 0;
        if (moveCount === 0 && !game.GameOver) {
            clearSetupBoard();
        } else {
            Board.syncFromGameState();
        }
        syncGameRunPanelOptions();
        if (Setup && Setup.refreshFlagCheckboxes) {
            Setup.refreshFlagCheckboxes();
        }
        showStatus("Position setup — place pieces on the board", 0, "info");
        updateActionButtons();
    }

    function exitPositionSetupMode(restore) {
        Board.setSetupMode(false);
        setPositionSetupUi(false);
        showStatus("");
        if (restore && positionSetupSnapshot) {
            restorePositionSetupSnapshot();
        } else {
            positionSetupSnapshot = null;
        }
        updateActionButtons();
    }

    function validateSetupPosition() {
        if (!game || !game.GameState) {
            return;
        }
        if (validatePositionSetup("play")) {
            showStatus("Position is valid", 2500, "info");
        }
    }

    async function applyPositionSetup() {
        if (!game || !game.GameState) {
            return;
        }
        if (!validatePositionSetup("play")) {
            return;
        }
        assignNewGameId();
        const setupOpts =
            GameRun && GameRun.getOptions
                ? GameRun.getOptions()
                : { turn: "white", humanIsWhite: currentPlayerIsWhite };
        const state = JSON.parse(JSON.stringify(game.GameState));
        state.turn = setupOpts.turn === "black" ? "black" : "white";
        state.gameOver = false;
        state.promoting = false;
        state.capturedPiecesList = state.capturedPiecesList || [];
        game.loadGame(JSON.stringify(state));
        game.loadMoves([]);
        currentPlayerIsWhite = setupOpts.humanIsWhite !== false;
        if (Board.setHumanColor) {
            Board.setHumanColor(currentPlayerIsWhite);
        }
        whiteTimer = initialClockSeconds();
        blackTimer = initialClockSeconds();
        updateTimersFromInfo({ whiteTimer: whiteTimer, blackTimer: blackTimer });
        redoPairAvailable = false;
        positionSetupSnapshot = null;
        exitPositionSetupMode(false);
        Board.syncFromGameState();
        updateMatchHeader();
        updateMovesTable([]);
        updateHeaderTurn();
        if (!game.GameOver) {
            if (isHumanTurn()) {
                switchClocks();
            } else {
                showStatus("Engine to move…", 0, "info");
            }
        }
        gameActive = true;
        document.body.classList.add("desktop-play-has-active-game");
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(true);
        }
        updateActionButtons();
        if (isHumanTurn()) {
            showStatus("Playing from custom position", 3000, "info");
            if (!game.GameOver) {
                switchClocks();
            }
        } else {
            await runEngineMove();
        }
    }

    function canUsePositionSetup() {
        if (!game) {
            return false;
        }
        if (game.GameOver) {
            return true;
        }
        const moveCount = game.Moves ? game.Moves.length : 0;
        return moveCount === 0;
    }

    function onPositionSetupToggle() {
        const btn = $("positionSetupBtn");
        if (btn && btn.disabled) {
            return;
        }
        if (positionSetupMode) {
            exitPositionSetupMode(true);
            return;
        }
        if (!gameActive && !positionSetupMode) {
            beginPositionSetupFromMenu();
            return;
        }
        if (!canUsePositionSetup()) {
            return;
        }
        enterPositionSetupMode();
    }

    function buildActionRail() {
        const rail = $("desktopPlayActions");
        if (!rail) {
            return;
        }
        const items = [
            {
                id: "rematchBtn",
                label: "New game",
                icon: "newGame",
                onClick: onRematch,
                accent: true,
            },
            { type: "spacer" },
            { id: "resignBtn", label: "Resign", icon: "resign", onClick: onResign },
            { id: "drawBtn", label: "Draw", icon: "draw", onClick: onDraw },
            { type: "spacer" },
            { id: "undoBtn", label: "Undo", icon: "undo", onClick: onUndo },
            { id: "redoBtn", label: "Redo", icon: "redo", onClick: onRedo },
            { id: "lastMoveBtn", label: "Last move", icon: "lastMove", onClick: onLastMove },
            {
                id: "positionSetupBtn",
                label: "Position setup",
                icon: "positionSetup",
                onClick: onPositionSetupToggle,
            },
            { id: "flipBtn", label: "Flip", icon: "flip", onClick: onFlip },
            { id: "saveBtn", label: "Save", icon: "save", onClick: onSaveGame },
            { type: "spacer" },
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

    function isAiTurn() {
        return game && !game.GameOver && !isHumanTurn();
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
        if (!gameActive && !positionSetupMode) {
            setButtonDisabled("resignBtn", true);
            setButtonDisabled("drawBtn", true);
            setButtonDisabled("undoBtn", true);
            setButtonDisabled("redoBtn", true);
            setButtonDisabled("lastMoveBtn", true);
            setButtonDisabled("saveBtn", true);
            setButtonDisabled("rematchBtn", animating || dialogOn);
            setButtonDisabled("positionSetupBtn", animating || dialogOn);
            setButtonDisabled("flipBtn", true);
            return;
        }
        const over = game.GameOver;
        const hasMoves = game.Moves && game.Moves.length > 0;
        const humanTurn = isHumanTurn();

        setButtonDisabled(
            "positionSetupBtn",
            animating || dialogOn || (!positionSetupMode && !canUsePositionSetup()),
        );
        if (positionSetupMode) {
            setButtonDisabled("resignBtn", true);
            setButtonDisabled("drawBtn", true);
            setButtonDisabled("undoBtn", true);
            setButtonDisabled("redoBtn", true);
            setButtonDisabled("lastMoveBtn", true);
            setButtonDisabled("saveBtn", true);
            setButtonDisabled("rematchBtn", true);
            setButtonDisabled("flipBtn", animating);
            return;
        }
        setButtonDisabled("resignBtn", over || animating);
        setButtonDisabled("drawBtn", over || animating || !humanTurn);
        const undoRedoDisabled = !allowUndo || over || animating || dialogOn;
        setButtonDisabled("undoBtn", undoRedoDisabled || !canUndoMovePair());
        setButtonDisabled("redoBtn", undoRedoDisabled || !redoPairAvailable);
        setButtonDisabled("lastMoveBtn", !hasMoves);
        setButtonDisabled("flipBtn", animating);
        setButtonDisabled("saveBtn", !game || animating || dialogOn);
        setButtonDisabled("rematchBtn", animating || dialogOn);
    }

    function formatSaveGameName() {
        const now = new Date();
        const stamp = now.toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
        });
        return formatSessionTypeLabel() + " — " + stamp;
    }

    function formatPositionSetupSaveName() {
        const now = new Date();
        const stamp = now.toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
        });
        return "Position — " + stamp;
    }

    function showPositionSaveNameDialog(onSave) {
        if (dialogOn) {
            return;
        }
        Dialog.prompt({
            title: "Save position",
            label: "Position name",
            defaultValue: formatPositionSetupSaveName(),
            confirmLabel: "Save",
            onSubmit: onSave,
        });
    }

    async function saveSetupPositionWithName(name) {
        if (!game || !session || !Api.post) {
            return;
        }
        const state = game.GameState;
        if (!state) {
            showStatus("Nothing to save", 2000, "error");
            return;
        }
        try {
            const bookmark = await Api.post("/bookmark", {
                gameState: state,
                name: name,
                gameType: "SinglePlayerGame",
                moves: [],
                engine: session.engine || "brain42",
                depth:
                    typeof session.difficulty === "number" && session.difficulty >= 1
                        ? session.difficulty
                        : 3,
            });
            if (bookmark && bookmark._id) {
                savedGames = savedGames.filter(function (b) {
                    return String(b._id) !== String(bookmark._id);
                });
                savedGames.unshift(bookmark);
            } else {
                await loadSavedGames();
            }
            renderSavedGamesList();
            showStatus("Position saved", 2500, "info");
        } catch (err) {
            showStatus(err.message || "Could not save position", 0, "error");
        }
    }

    function saveSetupPosition() {
        if (!game || !session || !Api.post) {
            return;
        }
        if (!validatePositionSetup("save")) {
            return;
        }
        if (!game.GameState) {
            showStatus("Nothing to save", 2000, "error");
            return;
        }
        showPositionSaveNameDialog(function (name) {
            saveSetupPositionWithName(name);
        });
    }

    function bookmarkMovesPayload() {
        return tableMovesFromGame().map(function (m) {
            return JSON.stringify(m);
        });
    }

    function setCellLabel(td, text) {
        const label = text == null ? "" : String(text);
        td.textContent = label;
        td.title = label;
    }

    function savedGameId(entry) {
        return entry && (entry._id || entry.id) ? String(entry._id || entry.id) : "";
    }

    function moveColorForTable(move) {
        if (!move) {
            return null;
        }
        if (move.turn === "white" || move.turn === "black") {
            return move.turn;
        }
        if (move.piece && (move.piece.color === "white" || move.piece.color === "black")) {
            return move.piece.color;
        }
        return null;
    }

    function buildMoveTableRows(moves) {
        const rows = [];
        if (!moves || !moves.length) {
            return rows;
        }
        for (let i = 0; i < moves.length; ) {
            const move = moves[i];
            const color = moveColorForTable(move);
            if (color === "black") {
                rows.push({ white: "-", black: move.moveStr || "" });
                i += 1;
            } else if (color === "white") {
                const whiteStr = move.moveStr || "";
                const next = i + 1 < moves.length ? moves[i + 1] : null;
                if (next && moveColorForTable(next) === "black") {
                    rows.push({ white: whiteStr, black: next.moveStr || "" });
                    i += 2;
                } else {
                    rows.push({ white: whiteStr, black: "" });
                    i += 1;
                }
            } else {
                const whiteMove = move;
                const blackMove = i + 1 < moves.length ? moves[i + 1] : null;
                rows.push({
                    white: whiteMove.moveStr || "",
                    black: blackMove ? blackMove.moveStr || "" : "",
                });
                i += blackMove ? 2 : 1;
            }
        }
        return rows;
    }

    function movesForMovesTable(moves) {
        return (moves || []).map(function (m) {
            if (typeof m === "string") {
                try {
                    const parsed = JSON.parse(m);
                    return { moveStr: parsed.moveStr || "", turn: parsed.turn };
                } catch {
                    return { moveStr: "" };
                }
            }
            return { moveStr: m.moveStr || "", turn: m.turn };
        });
    }

    function parseSavedGameMoves(entry) {
        if (!entry || !Array.isArray(entry.moves)) {
            return [];
        }
        return entry.moves.map(function (m) {
            return typeof m === "string" ? JSON.parse(m) : m;
        });
    }

    function toggleSavedGameExpanded(bookmarkId) {
        const gamesDiv = $("gamesDiv");
        if (!gamesDiv) {
            return;
        }
        const item = gamesDiv.querySelector(
            '.desktop-play-saved-game[data-bookmark-id="' + bookmarkId + '"]',
        );
        if (!item) {
            return;
        }
        gamesDiv.querySelectorAll(".desktop-play-saved-game.expanded").forEach(function (el) {
            if (el !== item) {
                el.classList.remove("expanded");
            }
        });
        const wasExpanded = item.classList.contains("expanded");
        item.classList.toggle("expanded");
        expandedSavedGameId = !wasExpanded ? bookmarkId : null;
        const row = item.querySelector(".desktop-play-saved-game-row");
        if (row) {
            row.setAttribute("aria-expanded", item.classList.contains("expanded") ? "true" : "false");
        }
        const expandBtn = item.querySelector(".desktop-play-saved-game-expand");
        if (expandBtn) {
            expandBtn.setAttribute(
                "aria-expanded",
                item.classList.contains("expanded") ? "true" : "false",
            );
        }
    }

    function formatSavedGameDate(date) {
        if (!date) {
            return "";
        }
        const d = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(d.getTime())) {
            return "";
        }
        return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    }

    const SAVED_GAME_ACTION_ICONS = {
        delete:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
        rename:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
        load:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
        expand:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>',
    };

    function createSavedGameIconButton(title, iconKey, onClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "desktop-play-saved-game-icon-btn";
        btn.setAttribute("title", title);
        btn.setAttribute("aria-label", title);
        btn.innerHTML = SAVED_GAME_ACTION_ICONS[iconKey] || "";
        btn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            onClick(ev);
        });
        return btn;
    }

    function startRenameSavedGame(bookmarkId) {
        renamingSavedGameId = bookmarkId;
        expandedSavedGameId = bookmarkId;
        renderSavedGamesList();
        const gamesDiv = $("gamesDiv");
        if (!gamesDiv) {
            return;
        }
        const input = gamesDiv.querySelector(
            '.desktop-play-saved-game[data-bookmark-id="' +
                bookmarkId +
                '"] .desktop-play-saved-game-rename-input',
        );
        if (input) {
            input.focus();
            input.select();
        }
    }

    async function commitRenameSavedGame(bookmarkId, newName) {
        const trimmed = (newName || "").trim();
        if (!trimmed) {
            showStatus("Name cannot be empty", 2000, "error");
            return;
        }
        const entry = savedGames.find(function (b) {
            return savedGameId(b) === String(bookmarkId);
        });
        if (!entry || !Api.post) {
            return;
        }
        try {
            await Api.post("/updateBookmark", {
                id: entry._id || entry.id,
                name: trimmed,
                gameType: entry.gameType || "SinglePlayerGame",
                date: entry.date || new Date(),
            });
            entry.name = trimmed;
            renamingSavedGameId = null;
            renderSavedGamesList();
            showStatus("Game renamed", 2000, "info");
        } catch (err) {
            showStatus(err.message || "Could not rename game", 0, "error");
        }
    }

    function cancelRenameSavedGame() {
        renamingSavedGameId = null;
        renderSavedGamesList();
    }

    async function deleteSavedGame(bookmarkId) {
        const entry = savedGames.find(function (b) {
            return savedGameId(b) === String(bookmarkId);
        });
        if (!entry || !Api.post) {
            return;
        }
        try {
            const result = await Api.post("/deleteBookmark", { id: entry._id || entry.id });
            const ok = result && (result.status === "OK" || result === "OK");
            if (!ok) {
                throw new Error("Delete failed");
            }
            savedGames = savedGames.filter(function (b) {
                return savedGameId(b) !== String(bookmarkId);
            });
            if (expandedSavedGameId === String(bookmarkId)) {
                expandedSavedGameId = null;
            }
            if (renamingSavedGameId === String(bookmarkId)) {
                renamingSavedGameId = null;
            }
            renderSavedGamesList();
            showStatus("Game deleted", 2000, "info");
        } catch (err) {
            showStatus(err.message || "Could not delete game", 0, "error");
        }
    }

    async function loadSavedGame(bookmarkId) {
        if (!game || animating || dialogOn) {
            return;
        }
        const entry = savedGames.find(function (b) {
            return savedGameId(b) === String(bookmarkId);
        });
        if (!entry) {
            return;
        }
        animating = true;
        updateActionButtons();
        try {
            if (positionSetupMode) {
                exitPositionSetupMode(false);
            }
            const baseOpts = Settings.loadLastOptions();
            applySessionSettings({
                color: baseOpts.color,
                engine: entry.engine || baseOpts.engine,
                difficulty:
                    typeof entry.depth === "number" && entry.depth >= 1
                        ? entry.depth
                        : baseOpts.difficulty,
                mouse: baseOpts.mouse,
                showAvailableMoves: baseOpts.showAvailableMoves,
                allowUndo: baseOpts.allowUndo,
                timeMinutes: baseOpts.timeMinutes,
            });
            const stateStr =
                typeof entry.state === "string" ? entry.state : JSON.stringify(entry.state);
            const parsedMoves = parseSavedGameMoves(entry);
            game.loadGame(stateStr);
            if (parsedMoves.length) {
                game.loadMoves(parsedMoves);
            }
            redoPairAvailable = false;
            lastCheckNotifySide = null;
            alertMode = false;
            headerEventMessage = null;
            headerEventKind = null;
            Board.clearArrows();
            Board.syncFromGameState();
            if (game.GameState && game.GameState.capturedPiecesList) {
                Board.updateCaptureLists(game.GameState.capturedPiecesList);
            }
            updateMovesTable(movesForMovesTable(parsedMoves));
            pauseClocksForSetup();
            gameActive = false;
            document.body.classList.remove("desktop-play-has-active-game");
            if (Board.setHumanPlayEnabled) {
                Board.setHumanPlayEnabled(false);
            }
            updateHeaderTurn();
            updateActionButtons();
            lastLoadedSavedGameId = String(bookmarkId);
            setCurrentGameId(null);
            syncGameRunPanelOptions();
            showStatus(
                "Position loaded — set next move and computer color in the header, then press Play",
                0,
                "info",
            );
        } catch (err) {
            showStatus(err.message || "Could not load saved game", 0, "error");
        } finally {
            animating = false;
            updateActionButtons();
        }
    }

    function createSavedGameItem(entry) {
        const id = savedGameId(entry);
        const div = document.createElement("div");
        div.className = "desktop-play-saved-game";
        div.dataset.bookmarkId = id;
        if (expandedSavedGameId === id) {
            div.classList.add("expanded");
        }

        const row = document.createElement("div");
        row.className = "desktop-play-saved-game-row";
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.setAttribute(
            "aria-expanded",
            expandedSavedGameId === id ? "true" : "false",
        );

        if (renamingSavedGameId === id) {
            const renameInput = document.createElement("input");
            renameInput.type = "text";
            renameInput.className = "desktop-play-saved-game-rename-input";
            renameInput.value = entry.name || "Saved game";
            renameInput.setAttribute("aria-label", "Saved game name");
            renameInput.addEventListener("click", function (ev) {
                ev.stopPropagation();
            });
            renameInput.addEventListener("keydown", function (ev) {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    commitRenameSavedGame(id, renameInput.value);
                } else if (ev.key === "Escape") {
                    ev.preventDefault();
                    cancelRenameSavedGame();
                }
            });
            row.appendChild(renameInput);
        } else {
            const nameSpan = document.createElement("span");
            nameSpan.className = "desktop-play-saved-game-name";
            const label = entry.name || "Saved game";
            nameSpan.textContent = label;
            nameSpan.title = label + " — click to load position on board";
            nameSpan.setAttribute("role", "button");
            nameSpan.setAttribute("tabindex", "0");
            nameSpan.addEventListener("click", function (ev) {
                ev.stopPropagation();
                loadSavedGame(id);
            });
            nameSpan.addEventListener("keydown", function (ev) {
                if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    ev.stopPropagation();
                    loadSavedGame(id);
                }
            });
            row.appendChild(nameSpan);
        }

        const expandBtn = createSavedGameIconButton(
            "Show details",
            "expand",
            function () {
                toggleSavedGameExpanded(id);
            },
        );
        expandBtn.classList.add("desktop-play-saved-game-expand");
        expandBtn.setAttribute("aria-expanded", expandedSavedGameId === id ? "true" : "false");
        row.appendChild(expandBtn);
        div.appendChild(row);

        const details = document.createElement("div");
        details.className = "desktop-play-saved-game-details";

        const meta = document.createElement("div");
        meta.className = "desktop-play-saved-game-meta";
        meta.textContent = formatSavedGameDate(entry.date);
        details.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "desktop-play-saved-game-actions";
        actions.appendChild(
            createSavedGameIconButton("Delete saved game", "delete", function () {
                deleteSavedGame(id);
            }),
        );
        actions.appendChild(
            createSavedGameIconButton("Rename saved game", "rename", function () {
                startRenameSavedGame(id);
            }),
        );
        details.appendChild(actions);
        div.appendChild(details);

        return div;
    }

    function renderSavedGamesList() {
        const gamesDiv = $("gamesDiv");
        if (!gamesDiv) {
            return;
        }
        gamesDiv.innerHTML = "";
        if (!savedGames.length) {
            return;
        }
        savedGames.forEach(function (entry) {
            gamesDiv.appendChild(createSavedGameItem(entry));
        });
    }

    async function loadSavedGames() {
        if (!Api.get) {
            return;
        }
        try {
            const list = await Api.get("/bookmark");
            savedGames = Array.isArray(list) ? list.slice() : [];
            savedGames.sort(function (a, b) {
                const ta = a && a.date ? new Date(a.date).getTime() : 0;
                const tb = b && b.date ? new Date(b.date).getTime() : 0;
                return tb - ta;
            });
            renderSavedGamesList();
        } catch (err) {
            console.error(err);
        }
    }

    async function onSaveGame() {
        if (!game || !session || animating || dialogOn) {
            return;
        }
        const state = game.GameState;
        if (!state) {
            showStatus("Nothing to save", 2000, "error");
            return;
        }
        setButtonDisabled("saveBtn", true);
        try {
            const bookmark = await Api.post("/bookmark", {
                gameState: state,
                name: formatSaveGameName(),
                gameType: "SinglePlayerGame",
                moves: bookmarkMovesPayload(),
                engine: session.engine || "brain42",
                depth:
                    typeof session.difficulty === "number" && session.difficulty >= 1
                        ? session.difficulty
                        : 3,
            });
            if (bookmark && bookmark._id) {
                savedGames = savedGames.filter(function (b) {
                    return String(b._id) !== String(bookmark._id);
                });
                savedGames.unshift(bookmark);
            } else {
                await loadSavedGames();
            }
            renderSavedGamesList();
            showStatus("Game saved", 2000, "info");
        } catch (err) {
            showStatus(err.message || "Could not save game", 0, "error");
        } finally {
            updateActionButtons();
        }
    }

    function updateMovesTable(moves) {
        const movesDiv = $("movesDiv");
        if (!movesDiv || !moves) {
            return;
        }
        movesDiv.innerHTML = "";
        const table = document.createElement("table");
        table.className = "movesTable";
        const rows = buildMoveTableRows(moves);
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            const tr = document.createElement("tr");
            const tdNum = document.createElement("td");
            tdNum.textContent = String(r + 1);
            tdNum.className = "tdNum";
            const tdWhite = document.createElement("td");
            tdWhite.className = "tdMove";
            setCellLabel(tdWhite, row.white);
            const tdBlack = document.createElement("td");
            tdBlack.className = "tdMove";
            setCellLabel(tdBlack, row.black);
            tr.appendChild(tdNum);
            tr.appendChild(tdWhite);
            tr.appendChild(tdBlack);
            table.appendChild(tr);
        }
        movesDiv.appendChild(table);
        movesDiv.scrollTop = movesDiv.scrollHeight;
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
        if (!Board.isBoardAnimating()) {
            Board.drawBoard(gameState.board);
            Board.updateCaptureLists(gameState.capturedPiecesList || []);
        }
        if (positionSetupMode) {
            return;
        }
        updateMovesTable(tableMovesFromGame());

        if (gameState.draw) {
            lastCheckNotifySide = null;
            onDraw(gameState.drawReason || "Draw");
            Board.applyDrawHighlight();
        } else if (gameState.checkmate) {
            lastCheckNotifySide = null;
            onCheckmate(game.Turn);
            Board.applyCheckedHighlight();
        } else if (gameState.check === true) {
            if (lastCheckNotifySide !== game.Turn) {
                onCheck(game.Turn);
                lastCheckNotifySide = game.Turn;
            }
            Board.applyCheckedHighlight();
        } else if (alertMode && !gameState.check && !gameState.checkmate && !gameState.draw) {
            alertMode = false;
            lastCheckNotifySide = null;
            showStatus("");
        }

        updateHeaderTurn();
        updateActionButtons();
    }

    function onCheck(turn) {
        alertMode = true;
        showStatus("Check", 2000, "check");
    }

    function onCheckmate(matedTurn) {
        alertMode = true;
        const winner = game.opponent(matedTurn);
        showStatus("Checkmate — " + game.colorName(winner) + " wins", 0, "checkmate");
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
        showStatus("Draw — " + reason, 0, "draw");
        Board.applyDrawHighlight();
        if (whiteHandle) {
            clearInterval(whiteHandle);
        }
        if (blackHandle) {
            clearInterval(blackHandle);
        }
        updateActionButtons();
    }

    function adjustIncomingNetworkMoveForBoardView(move) {
        return move;
    }

    function adjustOutgoingNetworkMoveForBoardView(move) {
        return move;
    }

    function networkMoveAlreadyApplied(move) {
        if (!move || !game || !game.GameState || !game.GameState.board) {
            return false;
        }
        const board = game.GameState.board;
        const target = board[move.target.row] && board[move.target.row][move.target.col];
        const source = board[move.source.row] && board[move.source.row][move.source.col];
        if (!target || source) {
            return false;
        }
        if (move.piece && target.color === move.piece.color) {
            if (move.piece.pieceType == null || target.pieceType === move.piece.pieceType) {
                return true;
            }
        }
        return false;
    }

    function parseServerMoves(moves) {
        if (!Array.isArray(moves)) {
            return [];
        }
        return moves.map(function (m) {
            return typeof m === "string" ? JSON.parse(m) : m;
        });
    }

    async function applyEngineMove(move) {
        const adjusted = adjustIncomingNetworkMoveForBoardView(move);
        if (!adjusted) {
            return false;
        }
        if (adjusted.promotion && adjusted.selectedPiece == null) {
            return false;
        }
        if (networkMoveAlreadyApplied(adjusted)) {
            Board.syncFromGameState();
            return true;
        }

        try {
            if (adjusted.promotion) {
                await Board.animateMove(adjusted);
                const actual = game.makeMove(adjusted.source, adjusted.target);
                actual.selectedPiece = adjusted.selectedPiece;
                actual.promotion = true;
                if (actual.piece && adjusted.piece) {
                    actual.piece.color = adjusted.piece.color;
                }
                game.completePromotion(actual);
            } else {
                await Board.animateMove(adjusted);
                game.makeMove(adjusted.source, adjusted.target);
            }
            if (Board.refreshHumanPieceInput) {
                Board.refreshHumanPieceInput();
            }
        } finally {
            if (Board.clearBoardAnimating) {
                Board.clearBoardAnimating();
            }
        }
        lastMove = game.LastMove || lastMove;
        updateMovesTable(tableMovesFromGame());
        updateHeaderTurn();
        return true;
    }

    async function runEngineMove() {
        if (!game || !session || !Engine || game.GameOver || !isAiTurn() || positionSetupMode) {
            return;
        }
        if (animating || dialogOn) {
            return;
        }
        if (Board.resetSquareColors) {
            Board.resetSquareColors();
        }
        await yieldForPaint();
        animating = true;
        showStatus("Engine thinking…", 0, "info");
        try {
            const move = await Engine.computeMove({
                gameState: game.GameState,
                engine: session.engine,
                difficulty: session.difficulty,
            });
            if (!move) {
                showStatus("Engine could not find a move", 0, "error");
                return;
            }
            if (move.promotion && move.selectedPiece == null) {
                move.selectedPiece = game.QUEEN;
            }
            const applied = await applyEngineMove(move);
            if (!applied) {
                showStatus("Engine move could not be applied", 0, "error");
                return;
            }
            switchClocks();
            if (isHumanTurn()) {
                showStatus("", 0, "info");
            }
        } catch (err) {
            console.error(err);
            showStatus(err.message || "Engine error", 0, "error");
        } finally {
            animating = false;
            if (Board.refreshHumanPieceInput) {
                Board.refreshHumanPieceInput();
            }
            updateActionButtons();
        }
    }

    function applySessionSettings(opts) {
        session = Settings.buildSession(opts);
        allowUndo = resolveAllowUndo(session);
        currentPlayerIsWhite = opts.color !== "black";
        Board.setPlayerView(currentPlayerIsWhite);
        if (Board.setHumanColor) {
            Board.setHumanColor(currentPlayerIsWhite);
        }
        Board.setPreferences({
            mouse: session.mousePreference || "drag",
            showAvailableMoves: session.showAvailableMoves !== false,
        });
        updateMatchHeader();
        syncGameRunPanelOptions();
    }

    async function beginNewGame(opts) {
        applySessionSettings(opts);
        assignNewGameId();
        game.startNewGame(currentPlayerIsWhite);
        resetClocks();
        redoPairAvailable = false;
        lastCheckNotifySide = null;
        alertMode = false;
        Board.clearArrows();
        Board.syncFromGameState();
        updateMovesTable([]);
        updateHeaderTurn();
        gameActive = true;
        document.body.classList.add("desktop-play-has-active-game");
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(true);
        }
        updateActionButtons();
        syncGameRunPanelOptions();
        if (!game.GameOver && !isHumanTurn()) {
            await runEngineMove();
        } else if (!game.GameOver) {
            switchClocks();
            showStatus("Your move", 2000, "info");
        }
    }

    function beginPositionSetupFromMenu() {
        const opts = Settings.loadLastOptions();
        applySessionSettings(opts);
        syncEmptyBoard();
        resetClocks();
        redoPairAvailable = false;
        updateMovesTable([]);
        updateHeaderTurn();
        gameActive = false;
        enterPositionSetupMode();
    }

    async function onPromotion(turn) {
        const opponentMove =
            (currentPlayerIsWhite && turn === "black") ||
            (!currentPlayerIsWhite && turn === "white");
        if (opponentMove || autoCompletePromotion) {
            return;
        }
        dialogOn = true;
        animating = true;
        showStatus("Choose promotion piece", 0, "promotion");
        return new Promise(function (resolve) {
            Board.showPromotionDialog(async function (selectedPiece) {
                let runBrainAfter = false;
                try {
                    const pending = game.LastMove;
                    if (!pending || !pending.promotion) {
                        showStatus("");
                        return;
                    }
                    if (
                        typeof selectedPiece !== "number" ||
                        selectedPiece < game.KNIGHT ||
                        selectedPiece > game.QUEEN
                    ) {
                        showStatus("Invalid promotion piece", 0, "error");
                        return;
                    }
                    pending.selectedPiece = selectedPiece;
                    game.completePromotion(pending);
                    lastMove = pending;
                    Board.syncFromGameState();
                    syncBoardFromGame();
                    redoPairAvailable = false;
                    switchClocks();
                    updateMovesTable(tableMovesFromGame());
                    updateHeaderTurn();
                    showStatus("");
                    runBrainAfter = !game.GameOver && isAiTurn();
                } catch (err) {
                    console.error(err);
                    showStatus(err.message || "Promotion failed", 0, "error");
                } finally {
                    dialogOn = false;
                    animating = false;
                    updateActionButtons();
                    resolve();
                }
                if (runBrainAfter) {
                    await runEngineMove();
                }
            });
        });
    }

    async function onHumanMove(executed) {
        if (!gameActive || positionSetupMode) {
            return;
        }
        lastMove = executed;
        redoPairAvailable = false;
        Board.clearArrows();
        if (Board.resetSquareColors) {
            Board.resetSquareColors();
        }
        switchClocks();
        updateMovesTable(tableMovesFromGame());
        updateHeaderTurn();
        updateActionButtons();
        if (!game.GameOver && isAiTurn()) {
            await yieldForPaint();
            await runEngineMove();
        }
    }

    function showPositionValidationAlert(text) {
        if (dialogOn) {
            return;
        }
        const raw = String(text);
        const idx = raw.indexOf("\n\n");
        let title = "Invalid position";
        let body = raw;
        if (idx !== -1) {
            title = raw.slice(0, idx).trim().replace(/:\s*$/, "");
            body = raw.slice(idx + 2).trim();
        }
        Dialog.alert({ title: title, message: body });
    }

    function validatePositionSetup(purpose) {
        if (!PositionValidation || !PositionValidation.getMessage || !game) {
            return true;
        }
        const err = PositionValidation.getMessage(game, purpose);
        if (err) {
            showPositionValidationAlert(err);
            return false;
        }
        return true;
    }

    function confirmDialog(title, message, onYes) {
        if (dialogOn) {
            return;
        }
        if (typeof message === "function") {
            onYes = message;
            message = title;
            title = "Confirm";
        }
        Dialog.confirm({
            title: title,
            message: message,
            onConfirm: onYes,
        });
    }

    function onResign() {
        if (game.GameOver) {
            return;
        }
        confirmDialog("Resign this game?", "You will lose the game.", function () {
            const player = currentPlayerIsWhite ? "White" : "Black";
            game.resign(player);
            updateActionButtons();
        });
    }

    function onDraw() {
        if (game.GameOver || $("drawBtn").disabled) {
            return;
        }
        Dialog.alert({
            title: "Draw offer",
            message: "Draw offers are not available when playing against the engine.",
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
        if (NewGameDialog && typeof NewGameDialog.show === "function") {
            NewGameDialog.show(beginNewGame);
        }
    }

    function onHome() {
        if (positionSetupMode) {
            exitPositionSetupMode(true);
            resetToIdleScreen();
            return;
        }
        if (!gameActive) {
            window.location.href = "/app/";
            return;
        }
        const humanHasMoved = currentPlayerIsWhite
            ? game.Moves.length >= 1
            : game.Moves.length >= 2;
        if (!humanHasMoved) {
            resetToIdleScreen();
            return;
        }
        confirmDialog("Leave game?", "Your game will be resigned.", function () {
            const player = currentPlayerIsWhite ? "White" : "Black";
            game.resign(player);
            resetToIdleScreen();
        });
    }

    function resetToIdleScreen() {
        if (positionSetupMode) {
            Board.setSetupMode(false);
            setPositionSetupUi(false);
        }
        gameActive = false;
        positionSetupSnapshot = null;
        document.body.classList.remove("desktop-play-has-active-game");
        if (whiteHandle) {
            clearInterval(whiteHandle);
            whiteHandle = null;
        }
        if (blackHandle) {
            clearInterval(blackHandle);
            blackHandle = null;
        }
        session = null;
        setCurrentGameId(null);
        alertMode = false;
        clearHeaderEvent();
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(false);
        }
        if (Board.clearKingHighlights) {
            Board.clearKingHighlights();
        }
        syncEmptyBoard();
        updateMovesTable([]);
        updateMatchHeader();
        updateHeaderTurn();
        showStatus("Choose New game or Position setup from the sidebar", 0, "info");
        updateActionButtons();
        updateGameIdLabel();
    }

    async function startSession() {
        await loadSavedGames();

        game = new ChessGame();
        ensureGameRunPanel();
        Board.setGame(game);
        Board.setPlayerView(true);
        Board.setPreferences({
            mouse: "drag",
            showAvailableMoves: true,
        });
        Board.setHumanMoveHandler(onHumanMove);
        Board.mount("chessboard");
        if (window.DesktopBoardScale && typeof window.DesktopBoardScale.refresh === "function") {
            window.DesktopBoardScale.refresh();
        }
        Board.registerInput();
        if (Board.setHumanPlayEnabled) {
            Board.setHumanPlayEnabled(false);
        }
        registerGameEvents();

        syncEmptyBoard();
        updateMovesTable([]);
        updateHeaderTurn();
        updateMatchHeader();
        showStatus("Choose New game or Position setup from the sidebar", 0, "info");
        updateActionButtons();
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (Dialog && Dialog.setLockHandlers) {
            Dialog.setLockHandlers(function (locked) {
                dialogOn = locked;
            });
        }
        buildActionRail();
        startSession().catch(function (err) {
            showStatus(err.message || "Could not load game", 0, "error");
            console.error(err);
        });
    });
})();
