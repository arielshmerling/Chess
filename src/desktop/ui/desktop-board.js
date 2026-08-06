/**
 * Chess board DOM + input for desktop play (no axios, no web-only features).
 */
(function (global) {
    "use strict";

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        if (typeof global.ShmerlingT === "function") {
            return global.ShmerlingT(key, params);
        }
        return key;
    }

    let WHITE_PIECES = [];
    let BLACK_PIECES = [];

    function syncPieceUrlArrays() {
        if (window.ShmerlingPieceSets && typeof window.ShmerlingPieceSets.getActiveUrls === "function") {
            const urls = window.ShmerlingPieceSets.getActiveUrls();
            WHITE_PIECES = urls.white;
            BLACK_PIECES = urls.black;
            return;
        }
        WHITE_PIECES = [
            "/images/pieces/storm-ivory/white-pawn.png",
            "/images/pieces/storm-ivory/white-king.png",
            "/images/pieces/storm-ivory/white-knight.png",
            "/images/pieces/storm-ivory/white-bishop.png",
            "/images/pieces/storm-ivory/white-rook.png",
            "/images/pieces/storm-ivory/white-queen.png",
        ];
        BLACK_PIECES = [
            "/images/pieces/storm-ivory/black-pawn.png",
            "/images/pieces/storm-ivory/black-king.png",
            "/images/pieces/storm-ivory/black-knight.png",
            "/images/pieces/storm-ivory/black-bishop.png",
            "/images/pieces/storm-ivory/black-rook.png",
            "/images/pieces/storm-ivory/black-queen.png",
        ];
    }

    syncPieceUrlArrays();

    document.addEventListener("shmerling-piece-set-changed", function () {
        syncPieceUrlArrays();
        if (chessGame && chessGame.GameState && chessGame.GameState.board) {
            drawBoard(chessGame.GameState.board);
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
        [null, null, null, null, null, null, null, null],
    ];

    let chessGame = null;
    let innerBoardEl = null;
    let drag = false;
    let draggedImage = null;
    let offsetX = 0;
    let offsetY = 0;
    let coordX = 0;
    let coordY = 0;
    let sourcePosition = null;
    let clickToMoveSelected = null;
    let currentPlayerIsWhite = true;
    /** Practice / Debug: either color may move on their turn. */
    let bothSidesHuman = false;
    let showAvailableMoves = true;
    let mousePreference = "drag";
    let onHumanMove = null;
    /** Optional: (source, target) => executedMove | null — session owns makeMove. */
    let humanMoveApplicator = null;
    let humanPlayEnabled = true;
    let setupModeActive = false;
    let setupGetSelection = null;
    let setupSuppressClick = false;
    let setupClickHandler = null;
    let setupContextMenuHandler = null;
    let setupMouseDownHandler = null;
    let boardAnimating = false;
    let activeMoveAnimationInterval = null;
    let animatingMoveImg = null;
    /** @type {null|function(): void} resolves the in-flight animateMove / animateUndoMove promise */
    let activeMoveAnimationSettle = null;
    let evaluationOverlayData = null;

    const MOVE_ANIM_INTERVAL_MS = 2;

    function formatEvalOverlayScore(value) {
        if (!Number.isFinite(value)) {
            return "?";
        }
        if (Math.abs(value) >= 1000) {
            return String(Math.round(value));
        }
        const rounded = Math.round(value * 100) / 100;
        if (Number.isInteger(rounded)) {
            return rounded > 0 ? "+" + String(rounded) : String(rounded);
        }
        const text = rounded.toFixed(2).replace(/\.?0+$/, "");
        return rounded > 0 ? "+" + text : text;
    }

    function buildEvalBreakdownTooltip(breakdown, score) {
        const lines = (breakdown || []).map(function (item) {
            return item.label + ": " + formatEvalOverlayScore(item.value);
        });
        lines.push(t("play.status.squareTotal", { score: formatEvalOverlayScore(score) }));
        return lines.join("\n");
    }

    function removeEvaluationLabels() {
        if (!guiBoard[0] || !guiBoard[0][0]) {
            return;
        }
        for (let i = 0; i < chessGame.BOARD_ROWS; i++) {
            for (let j = 0; j < chessGame.BOARD_COLUMNS; j++) {
                const labels = guiBoard[i][j].querySelectorAll(".desktop-board-eval-score");
                labels.forEach(function (el) {
                    el.remove();
                });
            }
        }
    }

    function applyEvaluationOverlay() {
        removeEvaluationLabels();
        if (!evaluationOverlayData || !evaluationOverlayData.squares || !guiBoard[0] || !guiBoard[0][0]) {
            return;
        }
        evaluationOverlayData.squares.forEach(function (sq) {
            const div = guiBoard[sq.row] && guiBoard[sq.row][sq.col];
            if (!div) {
                return;
            }
            const label = document.createElement("span");
            label.className = "desktop-board-eval-score";
            label.textContent = formatEvalOverlayScore(sq.score);
            label.setAttribute("title", buildEvalBreakdownTooltip(sq.breakdown, sq.score));
            div.appendChild(label);
        });
    }

    function showEvaluationOverlay(data) {
        evaluationOverlayData = data || null;
        applyEvaluationOverlay();
    }

    function clearEvaluationOverlay() {
        evaluationOverlayData = null;
        removeEvaluationLabels();
    }

    function isEvaluationOverlayActive() {
        return !!(evaluationOverlayData && evaluationOverlayData.squares && evaluationOverlayData.squares.length);
    }

    function setGame(chessGameInstance) {
        chessGame = chessGameInstance;
    }

    function getGame() {
        return chessGame;
    }

    function setPlayerView(isWhite) {
        currentPlayerIsWhite = !!isWhite;
        if (chessGame) {
            chessGame.WhitePlayerView = currentPlayerIsWhite;
        }
        updateRowOrder();
        updateLegend();
        refreshHumanPieceInput();
    }

    /** Which side the human plays (does not flip the board; use flipBoard for orientation). */
    function setHumanColor(isWhite) {
        currentPlayerIsWhite = !!isWhite;
        refreshHumanPieceInput();
    }

    function refreshHumanPieceInput() {
        applyMousePreference();
    }

    function setPreferences(opts) {
        mousePreference = opts.mouse === "double" ? "double" : "drag";
        showAvailableMoves = opts.showAvailableMoves !== false;
    }

    function setHumanMoveHandler(fn) {
        onHumanMove = fn;
    }

    function setHumanMoveApplicator(fn) {
        humanMoveApplicator = typeof fn === "function" ? fn : null;
    }

    function setHumanPlayEnabled(enabled) {
        humanPlayEnabled = !!enabled;
        refreshHumanPieceInput();
    }

    function setBothSidesHuman(enabled) {
        bothSidesHuman = !!enabled;
        refreshHumanPieceInput();
    }

    function isBothSidesHuman() {
        return bothSidesHuman;
    }

    function activeHumanColor() {
        if (bothSidesHuman && chessGame && chessGame.Turn) {
            return chessGame.Turn;
        }
        return currentPlayerIsWhite ? "white" : "black";
    }

    function getImageUrl(piece) {
        if (!piece) {
            return null;
        }
        return piece.color === "white"
            ? WHITE_PIECES[piece.pieceType]
            : BLACK_PIECES[piece.pieceType];
    }

    function findSquare(row, col) {
        return guiBoard[row][col];
    }

    function mount(containerId) {
        const root = document.getElementById(containerId || "chessboard");
        if (!root || !chessGame) {
            return;
        }
        root.innerHTML = "";
        root.setAttribute("dir", "ltr");
        const stack = document.createElement("div");
        stack.className = "chessboard_horizontal_stack";
        stack.setAttribute("dir", "ltr");

        stack.appendChild(createSide(false));
        stack.appendChild(createBoard());
        stack.appendChild(createSide(true));
        root.appendChild(stack);
        innerBoardEl = document.getElementById("innerBoard");

        const canvas = document.createElement("canvas");
        canvas.className = "arrowsCanvas";
        canvas.id = "arrowsCanvas";
        root.appendChild(canvas);

        applyMousePreference();
    }

    function createSide(isRight) {
        const right = isRight ? "right" : "";
        const side = document.createElement("div");
        side.className = "side_vertical_stack";

        const cornerTop = document.createElement("div");
        cornerTop.className = "frame corner";
        side.appendChild(cornerTop);

        const rows = document.createElement("div");
        rows.className = "side_squares";
        const whiteView = chessGame.WhitePlayerView;
        for (let i = chessGame.BOARD_ROWS; i > 0; i--) {
            const square = document.createElement("div");
            square.className = "frame square " + right;
            square.textContent = whiteView ? i : chessGame.BOARD_ROWS - i + 1;
            square.id = "row" + square.textContent + right;
            rows.appendChild(square);
        }
        side.appendChild(rows);

        const cornerBottom = document.createElement("div");
        cornerBottom.className = "frame corner";
        side.appendChild(cornerBottom);
        return side;
    }

    function createLegend(isTop) {
        const top = isTop ? "top" : "";
        const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
        const legend = document.createElement("div");
        legend.className = "frame legend " + top;
        for (let i = 0; i < chessGame.BOARD_COLUMNS; i++) {
            const square = document.createElement("div");
            square.className = "frame square";
            square.textContent = letters[i];
            square.id = "col" + letters[i] + top;
            legend.appendChild(square);
        }
        return legend;
    }

    function createBoard() {
        const mainBoard = document.createElement("div");
        mainBoard.className = "chessboard_vertical_stack";
        mainBoard.appendChild(createLegend(true));

        const squares = document.createElement("div");
        squares.className = "squares";
        squares.id = "innerBoard";
        for (let i = 0; i < chessGame.BOARD_ROWS; i++) {
            for (let j = 0; j < chessGame.BOARD_COLUMNS; j++) {
                const square = document.createElement("div");
                square.className = "square " + (((i + j) % 2) === 0 ? "white" : "black");
                square.setAttribute("data-row", String(i));
                square.setAttribute("data-col", String(j));
                squares.appendChild(square);
                guiBoard[i][j] = square;
            }
        }
        mainBoard.appendChild(squares);
        mainBoard.appendChild(createLegend(false));
        return mainBoard;
    }

    function updateRowOrder() {
        if (!chessGame || !guiBoard[0][0]) {
            return;
        }
        for (let i = chessGame.BOARD_ROWS; i > 0; i--) {
            const right = document.getElementById("row" + i + "right");
            const left = document.getElementById("row" + i);
            const label = chessGame.WhitePlayerView ? i : chessGame.BOARD_ROWS - i + 1;
            if (right) {
                right.textContent = label;
            }
            if (left) {
                left.textContent = label;
            }
        }
    }

    function updateLegend() {
        const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
        for (let i = 0; i < chessGame.BOARD_COLUMNS; i++) {
            const label = chessGame.WhitePlayerView
                ? letters[i]
                : letters[chessGame.BOARD_COLUMNS - i - 1];
            const top = document.getElementById("col" + letters[i] + "top");
            const bottom = document.getElementById("col" + letters[i]);
            if (top) {
                top.textContent = label;
            }
            if (bottom) {
                bottom.textContent = label;
            }
        }
    }

    function createPiece(url, draggable) {
        const img = document.createElement("img");
        img.src = url;
        img.className = draggable ? "draggable" : "nondraggable";
        // Native HTML5 image drag would fight our pointer-based dragging (Firefox ignores -webkit-user-drag).
        img.draggable = false;
        return img;
    }

    function resetPieceImgStyles(img) {
        if (!img) {
            return;
        }
        img.style.position = "";
        img.style.left = "";
        img.style.top = "";
        img.style.marginLeft = "";
        img.style.marginTop = "";
        img.style.zIndex = "";
    }

    function cancelMoveAnimation() {
        if (activeMoveAnimationInterval != null) {
            clearInterval(activeMoveAnimationInterval);
            activeMoveAnimationInterval = null;
        }
        if (animatingMoveImg) {
            resetPieceImgStyles(animatingMoveImg);
            animatingMoveImg = null;
        }
        boardAnimating = false;
        const settle = activeMoveAnimationSettle;
        activeMoveAnimationSettle = null;
        if (typeof settle === "function") {
            try {
                settle();
            } catch {
                /* ignore */
            }
        }
    }

    function clearDraggingSourceElevation() {
        if (!innerBoardEl) {
            return;
        }
        innerBoardEl.querySelectorAll(".square.dragging-source").forEach(function (sq) {
            sq.classList.remove("dragging-source");
        });
    }

    function cancelActiveDrag() {
        drag = false;
        document.onmousemove = null;
        clearDraggingSourceElevation();
        if (draggedImage) {
            resetPieceImgStyles(draggedImage);
            draggedImage.style.cursor = "";
            draggedImage = null;
        }
    }

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
        const wanted = String(url).split("/").pop();
        const have = String(srcAttr || img.src || "").split("/").pop();
        return !!(wanted && have && wanted === have);
    }

    function patchBoardFromState(board) {
        if (!board || !guiBoard[0][0]) {
            return;
        }
        for (let i = 0; i < chessGame.BOARD_ROWS; i++) {
            for (let j = 0; j < chessGame.BOARD_COLUMNS; j++) {
                const div = guiBoard[i][j];
                if (pieceMatchesSquareCell(div, board[i][j])) {
                    continue;
                }
                div.innerHTML = "";
                const url = getImageUrl(board[i][j]);
                if (url) {
                    div.appendChild(createPiece(url, isPieceDraggable(board[i][j])));
                }
            }
        }
        applyEndgameKingHighlights();
        if (mousePreference === "double" && !setupModeActive) {
            applyMousePreference();
        }
        if (setupModeActive) {
            applySetupPieceDraggability();
        }
        applyEvaluationOverlay();
    }

    /**
     * After animating a remote/engine move, leave the piece on the target square so
     * the following soft-patch does not recreate unchanged images.
     */
    function settleAnimatedPieceOnTarget(move, img) {
        if (!move || !img || !move.target) {
            return;
        }
        const targetDiv = findSquare(move.target.row, move.target.col);
        if (!targetDiv) {
            resetPieceImgStyles(img);
            return;
        }
        resetPieceImgStyles(img);
        img.style.position = "relative";
        targetDiv.innerHTML = "";
        targetDiv.appendChild(img);
        if (move.source) {
            const sourceDiv = findSquare(move.source.row, move.source.col);
            if (sourceDiv && sourceDiv !== targetDiv) {
                /* Source should be empty after the piece moved (captures already cleared). */
                const leftover = sourceDiv.querySelector("img");
                if (leftover === img) {
                    sourceDiv.innerHTML = "";
                }
            }
        }
    }

    function drawBoard(board) {
        if (!board || !guiBoard[0][0]) {
            return;
        }
        if (activeMoveAnimationInterval != null) {
            cancelMoveAnimation();
        } else if (animatingMoveImg) {
            resetPieceImgStyles(animatingMoveImg);
            animatingMoveImg = null;
        }
        for (let i = 0; i < chessGame.BOARD_ROWS; i++) {
            for (let j = 0; j < chessGame.BOARD_COLUMNS; j++) {
                const div = guiBoard[i][j];
                div.innerHTML = "";
                const url = getImageUrl(board[i][j]);
                if (url) {
                    div.appendChild(createPiece(url, isPieceDraggable(board[i][j])));
                }
            }
        }
        applyEndgameKingHighlights();
        if (mousePreference === "double" && !setupModeActive) {
            applyMousePreference();
        }
        if (setupModeActive) {
            applySetupPieceDraggability();
        }
        applyEvaluationOverlay();
    }

    function isPieceDraggable(piece) {
        if (setupModeActive) {
            return !!piece;
        }
        if (!piece || chessGame.GameOver) {
            return false;
        }
        const humanColor = activeHumanColor();
        if (piece.color !== humanColor) {
            return false;
        }
        if (chessGame.Turn !== humanColor) {
            return false;
        }
        return true;
    }

    function updateCaptureLists(captured) {
        const divWhite = document.getElementById("whiteCapturedPiece");
        const divBlack = document.getElementById("blackCapturedPiece");
        if (!divWhite || !divBlack) {
            return;
        }
        const list = Array.isArray(captured) ? captured : [];
        const signature = list
            .map(function (piece) {
                if (!piece || piece.color == null) {
                    return "";
                }
                return String(piece.color) + ":" + String(piece.pieceType);
            })
            .join("|");
        if (divWhite.getAttribute("data-capture-sig") === signature
            && divBlack.getAttribute("data-capture-sig") === signature) {
            return;
        }
        divWhite.setAttribute("data-capture-sig", signature);
        divBlack.setAttribute("data-capture-sig", signature);
        divWhite.innerHTML = "";
        divBlack.innerHTML = "";
        list.forEach(function (piece) {
            if (!piece || piece.color == null) {
                return;
            }
            const url = getImageUrl(piece);
            if (!url) {
                return;
            }
            const img = document.createElement("img");
            img.src = url;
            img.className = "captured";
            if (piece.color === "white") {
                divWhite.appendChild(img);
            } else {
                divBlack.appendChild(img);
            }
        });
    }

    function clearKingHighlights() {
        if (!guiBoard[0] || !guiBoard[0][0] || !chessGame) {
            return;
        }
        for (let i = 0; i < chessGame.BOARD_ROWS; i++) {
            for (let j = 0; j < chessGame.BOARD_COLUMNS; j++) {
                guiBoard[i][j].classList.remove(
                    "king-in-draw",
                    "king-in-check",
                    "king-in-checkmate",
                    "king-resigned",
                );
            }
        }
    }

    function applyResignedKingTilt(resignedColor) {
        if (!chessGame || !guiBoard[0][0] || !resignedColor) {
            return;
        }
        const color = String(resignedColor).toLowerCase();
        const stateBoard = chessGame.GameState && chessGame.GameState.board;
        if (!stateBoard) {
            return;
        }
        const kingType = chessGame.KING;
        for (let r = 0; r < chessGame.BOARD_ROWS; r++) {
            for (let c = 0; c < chessGame.BOARD_COLUMNS; c++) {
                guiBoard[r][c].classList.remove("king-resigned");
            }
        }
        for (let r = 0; r < chessGame.BOARD_ROWS; r++) {
            for (let c = 0; c < chessGame.BOARD_COLUMNS; c++) {
                const p = stateBoard[r][c];
                if (p && p.pieceType === kingType && p.color === color) {
                    guiBoard[r][c].classList.add("king-resigned");
                    return;
                }
            }
        }
    }

    function applyEndgameKingHighlights() {
        if (!chessGame || !guiBoard[0][0] || setupModeActive) {
            clearKingHighlights();
            return;
        }
        const resigned = chessGame.GameState && chessGame.GameState.resigned;
        if (resigned) {
            clearKingHighlights();
            applyResignedKingTilt(resigned);
            return;
        }
        if (chessGame.Draw || (chessGame.GameState && chessGame.GameState.draw)) {
            applyDrawHighlight();
        } else {
            applyCheckedHighlight();
        }
    }

    function resetSquareColors() {
        if (!guiBoard[0][0]) {
            return;
        }
        for (let i = 0; i < chessGame.BOARD_ROWS; i++) {
            for (let j = 0; j < chessGame.BOARD_COLUMNS; j++) {
                const square = guiBoard[i][j];
                const base = "square " + (((i + j) % 2) === 0 ? "white" : "black");
                if (square.className === base) {
                    continue;
                }
                square.className = base;
            }
        }
        applyEndgameKingHighlights();
    }

    function applyCheckedHighlight() {
        if (!chessGame || !guiBoard[0][0]) {
            return;
        }
        if (chessGame.GameState && chessGame.GameState.resigned) {
            applyResignedKingTilt(chessGame.GameState.resigned);
            return;
        }
        clearKingHighlights();
        if (chessGame.Draw || (chessGame.GameState && chessGame.GameState.draw)) {
            return;
        }
        const isCheckmate =
            chessGame.Checkmate || (chessGame.GameState && chessGame.GameState.checkmate);
        const isCheck = chessGame.Check || (chessGame.GameState && chessGame.GameState.check);
        if (!isCheckmate && !isCheck) {
            return;
        }
        const stateBoard = chessGame.GameState && chessGame.GameState.board;
        if (!stateBoard) {
            return;
        }
        const kingType = chessGame.KING;
        const turn = chessGame.Turn;
        const kingClass = isCheckmate ? "king-in-checkmate" : "king-in-check";
        for (let r = 0; r < chessGame.BOARD_ROWS; r++) {
            for (let c = 0; c < chessGame.BOARD_COLUMNS; c++) {
                const p = stateBoard[r][c];
                if (p && p.pieceType === kingType && p.color === turn) {
                    guiBoard[r][c].classList.add(kingClass);
                    return;
                }
            }
        }
    }

    function applyDrawHighlight() {
        if (!chessGame || !guiBoard[0][0]) {
            return;
        }
        clearKingHighlights();
        const stateBoard = chessGame.GameState && chessGame.GameState.board;
        if (!stateBoard) {
            return;
        }
        const kingType = chessGame.KING;
        for (let r = 0; r < chessGame.BOARD_ROWS; r++) {
            for (let c = 0; c < chessGame.BOARD_COLUMNS; c++) {
                const p = stateBoard[r][c];
                if (p && p.pieceType === kingType) {
                    guiBoard[r][c].classList.add("king-in-draw");
                }
            }
        }
    }

    function syncFromGameState(options) {
        options = options || {};
        const state = chessGame.GameState;
        if (state && state.board) {
            if (options.softPatch) {
                patchBoardFromState(state.board);
            } else {
                drawBoard(state.board);
            }
            updateCaptureLists(state.capturedPiecesList || []);
        }
    }

    function clearBoardAnimating() {
        boardAnimating = false;
    }

    function findPositionFromDrag() {
        const boardRect = innerBoardEl.getBoundingClientRect();
        const imgRect = draggedImage.getBoundingClientRect();
        const left = imgRect.x - boardRect.x;
        const top = imgRect.y - boardRect.y;
        const squareW = boardRect.width / 8;
        const squareH = boardRect.height / 8;
        return {
            row: Math.round(top / squareH),
            col: Math.round(left / squareW),
        };
    }

    function mutateSetupBoard(mutator, options) {
        options = options || {};
        clearEvaluationOverlay();
        if (!chessGame || !chessGame.GameState) {
            return;
        }
        const state = JSON.parse(JSON.stringify(chessGame.GameState));
        mutator(state);
        state.fiftyMovesCounter = 0;
        if (
            !options.skipKingRookSync &&
            global.DesktopPositionSetup &&
            global.DesktopPositionSetup.syncKingRookFlagsFromBoard
        ) {
            global.DesktopPositionSetup.syncKingRookFlagsFromBoard(state, chessGame);
        }
        chessGame.loadGame(JSON.stringify(state));
        syncFromGameState();
        if (
            global.DesktopPositionSetup &&
            global.DesktopPositionSetup.syncStatusFlagsFromGame
        ) {
            global.DesktopPositionSetup.syncStatusFlagsFromGame();
        } else if (
            global.DesktopPositionSetup &&
            global.DesktopPositionSetup.refreshFlagCheckboxes
        ) {
            global.DesktopPositionSetup.refreshFlagCheckboxes();
        }
    }

    function deleteSetupPieceAt(row, col) {
        mutateSetupBoard(function (state) {
            state.board[row][col] = null;
        });
    }

    function setupSquareFromEvent(ev) {
        const square = ev.target.closest(".square");
        if (!square || !innerBoardEl || !innerBoardEl.contains(square)) {
            return null;
        }
        const row = parseInt(square.getAttribute("data-row"), 10);
        const col = parseInt(square.getAttribute("data-col"), 10);
        if (isNaN(row) || isNaN(col)) {
            return null;
        }
        return { row: row, col: col, square: square };
    }

    function teardownSetupInput() {
        if (innerBoardEl && setupClickHandler) {
            innerBoardEl.removeEventListener("click", setupClickHandler);
        }
        if (innerBoardEl && setupContextMenuHandler) {
            innerBoardEl.removeEventListener("contextmenu", setupContextMenuHandler);
        }
        if (innerBoardEl && setupMouseDownHandler) {
            innerBoardEl.removeEventListener("mousedown", setupMouseDownHandler);
        }
        setupClickHandler = null;
        setupContextMenuHandler = null;
        setupMouseDownHandler = null;
        setupSuppressClick = false;
    }

    function registerSetupInput() {
        innerBoardEl = document.getElementById("innerBoard");
        if (!innerBoardEl) {
            return;
        }
        teardownSetupInput();

        setupClickHandler = function (ev) {
            if (!setupModeActive || !setupGetSelection) {
                return;
            }
            if (setupSuppressClick) {
                setupSuppressClick = false;
                return;
            }
            if (ev.button !== 0) {
                return;
            }
            const selection = setupGetSelection();
            if (selection && selection.mode === "select") {
                return;
            }
            const loc = setupSquareFromEvent(ev);
            if (!loc) {
                return;
            }
            mutateSetupBoard(function (state) {
                if (selection && selection.mode === "eraser") {
                    state.board[loc.row][loc.col] = null;
                } else if (
                    selection &&
                    selection.mode !== "select" &&
                    selection.color &&
                    typeof selection.pieceType === "number"
                ) {
                    state.board[loc.row][loc.col] = {
                        color: selection.color,
                        pieceType: selection.pieceType,
                    };
                }
            });
        };

        setupContextMenuHandler = function (ev) {
            if (!setupModeActive) {
                return;
            }
            const loc = setupSquareFromEvent(ev);
            if (!loc) {
                return;
            }
            const state = chessGame.GameState;
            if (!state.board[loc.row][loc.col]) {
                return;
            }
            ev.preventDefault();
            setupSuppressClick = true;
            deleteSetupPieceAt(loc.row, loc.col);
        };

        setupMouseDownHandler = function (ev) {
            if (!setupModeActive) {
                return;
            }
            const loc = setupSquareFromEvent(ev);
            if (!loc) {
                return;
            }
            const state = chessGame.GameState;
            const piece = state.board[loc.row][loc.col];

            if (ev.button === 2) {
                ev.preventDefault();
                setupSuppressClick = true;
                if (piece) {
                    deleteSetupPieceAt(loc.row, loc.col);
                }
                return;
            }

        };

        innerBoardEl.addEventListener("click", setupClickHandler);
        innerBoardEl.addEventListener("contextmenu", setupContextMenuHandler);
        innerBoardEl.addEventListener("mousedown", setupMouseDownHandler);
    }

    function setSetupMode(active, options) {
        options = options || {};
        setupModeActive = !!active;
        setupGetSelection = options.getSelection || null;
        if (active) {
            drag = false;
            document.onmousedown = startDrag;
            document.onmouseup = stopDrag;
            document.onmousemove = null;
            if (innerBoardEl) {
                innerBoardEl.removeEventListener("click", onBoardClick);
            }
            registerSetupInput();
            applySetupPieceDraggability();
            if (options.onCursorUpdate) {
                options.onCursorUpdate();
            }
        } else {
            teardownSetupInput();
            innerBoardEl = document.getElementById("innerBoard");
            if (innerBoardEl) {
                innerBoardEl.removeAttribute("data-research-cursor");
            }
            registerInput();
        }
    }

    function registerInput() {
        if (setupModeActive) {
            return;
        }
        document.onmousedown = startDrag;
        document.onmouseup = stopDrag;
        if (innerBoardEl) {
            innerBoardEl.removeEventListener("click", onBoardClick);
        }
        applyMousePreference();
    }

    function applySetupPieceDraggability() {
        if (!innerBoardEl || !setupModeActive) {
            return;
        }
        document.querySelectorAll("#innerBoard .square img").forEach(function (img) {
            img.className = "draggable";
            img.style.cursor = "grab";
        });
    }

    function applyMousePreference() {
        if (!innerBoardEl || setupModeActive) {
            return;
        }
        innerBoardEl.removeEventListener("click", onBoardClick);
        clickToMoveSelected = null;
        if (mousePreference === "double") {
            innerBoardEl.classList.add("move-mode-double");
            innerBoardEl.addEventListener("click", onBoardClick);
            document.querySelectorAll("#innerBoard .square img").forEach(function (img) {
                img.className = "nondraggable";
            });
        } else {
            innerBoardEl.classList.remove("move-mode-double");
            document.querySelectorAll("#innerBoard .square img").forEach(function (img) {
                const pieceColor = img.src.indexOf("white") !== -1 ? "white" : "black";
                const humanColor = activeHumanColor();
                const ourTurn = chessGame && chessGame.Turn === humanColor;
                const ours = ourTurn && pieceColor === humanColor;
                img.className = ours ? "draggable" : "nondraggable";
            });
        }
    }

    function startDrag(e) {
        if (chessGame.GameOver && !setupModeActive) {
            return;
        }
        if (!setupModeActive && mousePreference !== "drag") {
            return;
        }
        if (e.button !== 0) {
            return;
        }
        if (!e.target || e.target.tagName !== "IMG") {
            return;
        }
        draggedImage = e.target;
        if (!setupModeActive && (!draggedImage.classList || !draggedImage.classList.contains("draggable"))) {
            return;
        }
        if (setupModeActive) {
            const square = draggedImage.closest(".square");
            if (!square) {
                return;
            }
            const row = parseInt(square.getAttribute("data-row"), 10);
            const col = parseInt(square.getAttribute("data-col"), 10);
            if (isNaN(row) || isNaN(col) || !chessGame.GameState.board[row][col]) {
                return;
            }
        }
        if (e.target.type !== "textarea" && e.target.type !== "text" && e.preventDefault) {
            e.preventDefault();
        }
        offsetX = e.clientX;
        offsetY = e.clientY;
        if (!draggedImage.style.left) {
            draggedImage.style.position = "relative";
            draggedImage.style.left = "0px";
        }
        if (!draggedImage.style.top) {
            draggedImage.style.top = "0px";
        }
        clearDraggingSourceElevation();
        const sourceSquare = draggedImage.closest(".square");
        if (sourceSquare) {
            sourceSquare.classList.add("dragging-source");
        }
        // Above capture-target move dots (z-index 3), but only while this piece is dragged.
        draggedImage.style.zIndex = "10";
        coordX = parseInt(draggedImage.style.left, 10) || 0;
        coordY = parseInt(draggedImage.style.top, 10) || 0;
        drag = true;
        sourcePosition = findPositionFromDrag();
        document.onmousemove = onDragging;
        if (showAvailableMoves && !setupModeActive) {
            chessGame.possibleMoves(sourcePosition).forEach(function (option) {
                guiBoard[option.target.row][option.target.col].classList.add("option");
            });
        }
        return false;
    }

    function onDragging(e) {
        if (!drag) {
            return;
        }
        draggedImage.style.left = coordX + e.clientX - offsetX + "px";
        draggedImage.style.top = coordY + e.clientY - offsetY + "px";
        draggedImage.style.cursor = "grabbing";
        return false;
    }

    function snapDraggedPieceToSquare(row, col) {
        if (!draggedImage || !guiBoard[row] || !guiBoard[row][col]) {
            return;
        }
        const div = guiBoard[row][col];
        div.innerHTML = "";
        div.appendChild(draggedImage);
        draggedImage.style.position = "relative";
        draggedImage.style.left = "0px";
        draggedImage.style.top = "0px";
        draggedImage.style.zIndex = "0";
        draggedImage.style.cursor = "grab";
    }

    function isOnBoard(row, col) {
        return (
            row >= 0 &&
            row < chessGame.BOARD_ROWS &&
            col >= 0 &&
            col < chessGame.BOARD_COLUMNS
        );
    }

    async function stopDrag() {
        if (!drag) {
            return;
        }
        draggedImage.style.cursor = "grab";
        drag = false;
        document.onmousemove = null;
        resetSquareColors();
        const target = findPositionFromDrag();

        if (setupModeActive) {
            setupSuppressClick = true;
            if (sourcePosition && target && isOnBoard(target.row, target.col)) {
                const sr = sourcePosition.row;
                const sc = sourcePosition.col;
                const tr = target.row;
                const tc = target.col;
                if (tr !== sr || tc !== sc) {
                    mutateSetupBoard(function (state) {
                        state.board[tr][tc] = state.board[sr][sc];
                        state.board[sr][sc] = null;
                    });
                } else {
                    snapDraggedPieceToSquare(sr, sc);
                }
            } else if (sourcePosition) {
                snapDraggedPieceToSquare(sourcePosition.row, sourcePosition.col);
            }
            cancelActiveDrag();
            return;
        }

        const moved = await tryHumanMove(sourcePosition, target);
        if (!moved && draggedImage && sourcePosition) {
            snapDraggedPieceToSquare(sourcePosition.row, sourcePosition.col);
            cancelActiveDrag();
        } else {
            cancelActiveDrag();
        }
    }

    async function onBoardClick(e) {
        if (setupModeActive || mousePreference !== "double" || chessGame.GameOver) {
            return;
        }
        const square = e.target.closest(".square");
        if (!square) {
            return;
        }
        const row = parseInt(square.getAttribute("data-row"), 10);
        const col = parseInt(square.getAttribute("data-col"), 10);
        const pos = { row: row, col: col };
        const pieceImg = square.querySelector("img");
        const humanColor = activeHumanColor();
        const isOurPiece =
            pieceImg &&
            ((humanColor === "white" && pieceImg.src.indexOf("white") !== -1) ||
                (humanColor === "black" && pieceImg.src.indexOf("black") !== -1));
        const ourTurn = chessGame.Turn === humanColor;

        if (!clickToMoveSelected) {
            if (isOurPiece && ourTurn) {
                clickToMoveSelected = pos;
                resetSquareColors();
                square.classList.add("optionSource");
                if (showAvailableMoves) {
                    chessGame.possibleMoves(pos).forEach(function (option) {
                        guiBoard[option.target.row][option.target.col].classList.add("option");
                    });
                }
            }
            return;
        }
        if (clickToMoveSelected.row === row && clickToMoveSelected.col === col) {
            clickToMoveSelected = null;
            resetSquareColors();
            return;
        }
        if (isOurPiece) {
            clickToMoveSelected = pos;
            resetSquareColors();
            square.classList.add("optionSource");
            if (showAvailableMoves) {
                chessGame.possibleMoves(pos).forEach(function (option) {
                    guiBoard[option.target.row][option.target.col].classList.add("option");
                });
            }
            return;
        }
        resetSquareColors();
        await tryHumanMove(clickToMoveSelected, pos);
        clickToMoveSelected = null;
    }

    function buildAnimMoveFromValidation(moveObj, sourcePos, targetPos) {
        const animMove = {
            source: { row: sourcePos.row, col: sourcePos.col },
            target: { row: targetPos.row, col: targetPos.col },
            piece: moveObj.piece,
        };
        if (moveObj.ennPassant && moveObj.hitSquare) {
            animMove.ennPassant = true;
            animMove.hitSquare = moveObj.hitSquare;
        }
        return animMove;
    }

    async function tryHumanMove(sourcePos, targetPos) {
        if (!humanPlayEnabled && !setupModeActive) {
            return false;
        }
        const moveObj = chessGame.validateMove(sourcePos, targetPos, chessGame.Turn);
        if (!moveObj.valid) {
            return false;
        }
        let executed;
        try {
            if (humanMoveApplicator) {
                executed = await humanMoveApplicator(sourcePos, targetPos);
            } else {
                executed = chessGame.makeMove(sourcePos, targetPos);
            }
            if (!executed || executed.valid === false) {
                return false;
            }
            /*
             * Move the existing <img> onto the target before soft-patching so Safari
             * does not briefly empty the source (destroying the node) and recreate it.
             */
            if (sourcePos && targetPos && isOnBoard(targetPos.row, targetPos.col)) {
                const sourceDiv = findSquare(sourcePos.row, sourcePos.col);
                const movingImg =
                    draggedImage ||
                    (sourceDiv && sourceDiv.querySelector
                        ? sourceDiv.querySelector("img")
                        : null);
                if (movingImg) {
                    if (executed.ennPassant && executed.hitSquare) {
                        const capturedSquare = findSquare(
                            executed.hitSquare.row,
                            executed.hitSquare.col,
                        );
                        if (capturedSquare) {
                            capturedSquare.innerHTML = "";
                        }
                    }
                    settleAnimatedPieceOnTarget(
                        { source: sourcePos, target: targetPos },
                        movingImg,
                    );
                    if (draggedImage === movingImg) {
                        draggedImage = null;
                    }
                }
            }
            syncFromGameState({ softPatch: true });
            refreshHumanPieceInput();
            resetSquareColors();
        } finally {
            clearBoardAnimating();
        }
        if (executed && executed.promotion && chessGame.GameState && chessGame.GameState.promoting) {
            return true;
        }
        if (onHumanMove) {
            await onHumanMove(executed);
        }
        return true;
    }

    function showPromotionDialog(promotingColor, onPick) {
        const boardRoot = document.getElementById("chessboard");
        if (!boardRoot) {
            return;
        }
        const existing = document.getElementById("cloak");
        if (existing) {
            existing.remove();
        }
        const pieceUrls = promotingColor === "black" ? BLACK_PIECES : WHITE_PIECES;
        const cloak = document.createElement("div");
        cloak.className = "cloak desktop-promotion-cloak";
        cloak.id = "cloak";
        cloak.style.visibility = "visible";
        cloak.style.opacity = "1";
        const box = document.createElement("div");
        box.className = "promotionSelectionBox";
        box.id = "promotionSelectionBox";
        for (let i = chessGame.KNIGHT; i <= chessGame.QUEEN; i++) {
            const piece = createPiece(pieceUrls[i], false);
            piece.className = "promotionPiece";
            piece.setAttribute("alt", String(i));
            piece.onclick = function (ev) {
                const target = ev.currentTarget;
                const selected = parseInt(target.getAttribute("alt"), 10);
                cloak.remove();
                onPick(selected);
            };
            box.appendChild(piece);
        }
        cloak.appendChild(box);
        boardRoot.appendChild(cloak);
    }

    function clearArrows() {
        const canvas = document.getElementById("arrowsCanvas");
        if (canvas) {
            canvas.style.visibility = "hidden";
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    }

    function drawArrow(ctx, fromx, fromy, tox, toy, arrowWidth, color) {
        const headlen = arrowWidth / 2;
        const angle = Math.atan2(toy - fromy, tox - fromx);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(fromx, fromy);
        ctx.lineTo(tox, toy);
        ctx.lineWidth = arrowWidth;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tox, toy);
        ctx.lineTo(
            tox - headlen * Math.cos(angle - Math.PI / 6),
            toy - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            tox - headlen * Math.cos(angle + Math.PI / 6),
            toy - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.lineTo(tox, toy);
        ctx.lineTo(
            tox - headlen * Math.cos(angle - Math.PI / 6),
            toy - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.stroke();
        ctx.restore();
    }

    function findLastMoveWithCoords() {
        if (!chessGame || !chessGame.Moves) {
            return null;
        }
        const moves = chessGame.Moves;
        for (let i = moves.length - 1; i >= 0; i--) {
            const m = moves[i];
            if (m && m.source && m.target && m.source.row != null && m.target.row != null) {
                return m;
            }
        }
        return null;
    }

    function toggleLastMoveArrow() {
        const last = findLastMoveWithCoords();
        if (!last || !innerBoardEl) {
            return false;
        }
        const canvas = document.getElementById("arrowsCanvas");
        if (!canvas) {
            return false;
        }
        if (canvas.style.visibility === "visible") {
            clearArrows();
            return false;
        }
        const divMoveTarget = findSquare(last.target.row, last.target.col);
        if (!divMoveTarget) {
            return false;
        }
        const squareWidth = divMoveTarget.offsetWidth;
        canvas.style.visibility = "visible";
        canvas.setAttribute("width", String(innerBoardEl.offsetWidth));
        canvas.setAttribute("height", String(innerBoardEl.offsetWidth));
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let x1;
        let y1;
        let x2;
        let y2;
        if (last.whitePlayerView === chessGame.WhitePlayerView) {
            x1 = last.source.col * squareWidth + squareWidth / 2;
            y1 = last.source.row * squareWidth + squareWidth / 2;
            x2 = last.target.col * squareWidth + squareWidth / 2;
            y2 = last.target.row * squareWidth + squareWidth / 2;
        } else {
            x1 =
                (chessGame.BOARD_COLUMNS - last.source.col - 1) * squareWidth + squareWidth / 2;
            y1 = (chessGame.BOARD_ROWS - last.source.row - 1) * squareWidth + squareWidth / 2;
            x2 =
                (chessGame.BOARD_COLUMNS - last.target.col - 1) * squareWidth + squareWidth / 2;
            y2 = (chessGame.BOARD_ROWS - last.target.row - 1) * squareWidth + squareWidth / 2;
        }
        drawArrow(ctx, x1, y1, x2, y2, innerBoardEl.offsetWidth / 40, "#33a033");
        return true;
    }

    function flipBoard() {
        if (!chessGame) {
            return;
        }
        chessGame.WhitePlayerView = !chessGame.WhitePlayerView;
        clearArrows();
        updateRowOrder();
        updateLegend();
        syncFromGameState();
    }

    function animateUndoMove(move) {
        cancelMoveAnimation();
        boardAnimating = true;
        return new Promise(function (resolve) {
            activeMoveAnimationSettle = resolve;
            const speed = 50;
            clearArrows();
            const divMoveTarget = findSquare(move.target.row, move.target.col);
            const img = divMoveTarget && divMoveTarget.childNodes[0];
            if (!img) {
                syncFromGameState();
                boardAnimating = false;
                activeMoveAnimationSettle = null;
                resolve();
                return;
            }
            const squareWidth = divMoveTarget.offsetWidth;
            const squareHeight = divMoveTarget.offsetWidth;
            const horizontalDistance = (move.source.col - move.target.col) * squareWidth;
            const verticallDistance = (move.source.row - move.target.row) * squareHeight;
            const verticalSteps = verticallDistance / speed;
            const horizontalSteps = horizontalDistance / speed;
            let left = 0;
            let top = 0;
            animatingMoveImg = img;
            img.style.zIndex = "2";
            img.style.position = "absolute";
            activeMoveAnimationInterval = setInterval(function () {
                left += horizontalSteps;
                top += verticalSteps;
                img.style.marginLeft = left + "px";
                img.style.marginTop = top + "px";
                if (
                    Math.abs(left - horizontalDistance * 2) < 1 &&
                    Math.abs(top - verticallDistance * 2) < 1
                ) {
                    clearInterval(activeMoveAnimationInterval);
                    activeMoveAnimationInterval = null;
                    img.style.position = "relative";
                    img.style.marginLeft = "0px";
                    img.style.marginTop = "0px";
                    animatingMoveImg = null;
                    activeMoveAnimationSettle = null;
                    syncFromGameState();
                    boardAnimating = false;
                    resolve();
                }
            }, MOVE_ANIM_INTERVAL_MS);
        });
    }

    /** Matches web chessboard.js animateMove interval; stops at target (1× distance). */
    function animateMove(move, options) {
        options = options || {};
        const skipFinalSync = options.skipFinalSync === true;
        cancelMoveAnimation();
        return new Promise(function (resolve) {
            activeMoveAnimationSettle = resolve;
            boardAnimating = true;
            const speed = 20;

            if (!move) {
                boardAnimating = false;
                activeMoveAnimationSettle = null;
                resolve();
                return;
            }

            clearArrows();

            if (move.ennPassant && move.hitSquare) {
                const capturedSquare = findSquare(move.hitSquare.row, move.hitSquare.col);
                if (capturedSquare) {
                    capturedSquare.innerHTML = "";
                }
            }

            const divMoveSource = findSquare(move.source.row, move.source.col);
            const img = divMoveSource && divMoveSource.querySelector
                ? divMoveSource.querySelector("img")
                : (divMoveSource && divMoveSource.childNodes[0]);
            if (!img) {
                /* Caller applies chess state next when skipFinalSync; avoid a full wipe blink. */
                if (!skipFinalSync) {
                    syncFromGameState();
                }
                boardAnimating = false;
                activeMoveAnimationSettle = null;
                resolve();
                return;
            }

            const squareWidth = divMoveSource.offsetWidth;
            const squareHeight = divMoveSource.offsetWidth;
            const horizontalDistance = (move.target.col - move.source.col) * squareWidth;
            const verticallDistance = (move.target.row - move.source.row) * squareHeight;
            const verticalSteps = verticallDistance / speed;
            const horizontalSteps = horizontalDistance / speed;

            let left = 0;
            let top = 0;

            animatingMoveImg = img;
            img.style.zIndex = "2";
            img.style.position = "absolute";

            activeMoveAnimationInterval = setInterval(function () {
                left += horizontalSteps;
                top += verticalSteps;
                img.style.marginLeft = left + "px";
                img.style.marginTop = top + "px";

                if (
                    Math.abs(left - horizontalDistance) < 1 &&
                    Math.abs(top - verticallDistance) < 1
                ) {
                    clearInterval(activeMoveAnimationInterval);
                    activeMoveAnimationInterval = null;
                    animatingMoveImg = null;
                    activeMoveAnimationSettle = null;
                    if (skipFinalSync) {
                        settleAnimatedPieceOnTarget(move, img);
                    } else {
                        img.style.position = "relative";
                        img.style.marginLeft = "0px";
                        img.style.marginTop = "0px";
                        syncFromGameState();
                    }
                    boardAnimating = false;
                    resolve();
                }
            }, MOVE_ANIM_INTERVAL_MS);
        });
    }

    global.DesktopBoard = {
        setGame: setGame,
        getGame: getGame,
        setPlayerView: setPlayerView,
        setHumanColor: setHumanColor,
        refreshHumanPieceInput: refreshHumanPieceInput,
        setPreferences: setPreferences,
        setHumanMoveHandler: setHumanMoveHandler,
        setHumanMoveApplicator: setHumanMoveApplicator,
        setHumanPlayEnabled: setHumanPlayEnabled,
        setBothSidesHuman: setBothSidesHuman,
        isBothSidesHuman: isBothSidesHuman,
        mount: mount,
        drawBoard: drawBoard,
        syncFromGameState: syncFromGameState,
        updateCaptureLists: updateCaptureLists,
        resetSquareColors: resetSquareColors,
        registerInput: registerInput,
        applyMousePreference: applyMousePreference,
        showPromotionDialog: showPromotionDialog,
        animateMove: animateMove,
        animateUndoMove: animateUndoMove,
        findSquare: findSquare,
        flipBoard: flipBoard,
        clearArrows: clearArrows,
        toggleLastMoveArrow: toggleLastMoveArrow,
        applyCheckedHighlight: applyCheckedHighlight,
        applyEndgameKingHighlights: applyEndgameKingHighlights,
        applyDrawHighlight: applyDrawHighlight,
        applyResignedKingTilt: applyResignedKingTilt,
        clearKingHighlights: clearKingHighlights,
        setSetupMode: setSetupMode,
        mutateSetupBoard: mutateSetupBoard,
        showEvaluationOverlay: showEvaluationOverlay,
        clearEvaluationOverlay: clearEvaluationOverlay,
        isEvaluationOverlayActive: isEvaluationOverlayActive,
        isBoardAnimating: function () {
            return boardAnimating;
        },
        clearBoardAnimating: clearBoardAnimating,
    };
})(window);
