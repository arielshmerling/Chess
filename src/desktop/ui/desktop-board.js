/**
 * Chess board DOM + input for desktop play (no axios, no web-only features).
 */
(function (global) {
    "use strict";

    const WHITE_PIECES = [
        "images/3409_white-pawn.png",
        "images/3404_white-king.png",
        "images/3408_white-knight.png",
        "images/3407_white-bishop.png",
        "images/3406_white-rook.png",
        "images/3405_white-queen.png",
    ];
    const BLACK_PIECES = [
        "images/3403_black-pawn.png",
        "images/3398_black-king.png",
        "images/3402_black-knight.png",
        "images/3401_black-bishop.png",
        "images/3400_black-rook.png",
        "images/3399_black-queen.png",
    ];

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
    let showAvailableMoves = true;
    let mousePreference = "drag";
    let onHumanMove = null;

    function setGame(chessGameInstance) {
        chessGame = chessGameInstance;
    }

    function setPlayerView(isWhite) {
        currentPlayerIsWhite = !!isWhite;
        if (chessGame) {
            chessGame.WhitePlayerView = currentPlayerIsWhite;
        }
        updateRowOrder();
        updateLegend();
    }

    function setPreferences(opts) {
        mousePreference = opts.mouse === "double" ? "double" : "drag";
        showAvailableMoves = opts.showAvailableMoves !== false;
    }

    function setHumanMoveHandler(fn) {
        onHumanMove = fn;
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
        const stack = document.createElement("div");
        stack.className = "chessboard_horizontal_stack";

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
        return img;
    }

    function drawBoard(board) {
        if (!board || !guiBoard[0][0]) {
            return;
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
        if (chessGame && (chessGame.Draw || (chessGame.GameState && chessGame.GameState.draw))) {
            applyDrawHighlight();
        } else {
            applyCheckedHighlight();
        }
        if (mousePreference === "double") {
            applyMousePreference();
        }
    }

    function isPieceDraggable(piece) {
        if (!piece || chessGame.GameOver) {
            return false;
        }
        if (currentPlayerIsWhite && piece.color === "black") {
            return false;
        }
        if (!currentPlayerIsWhite && piece.color === "white") {
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
        divWhite.innerHTML = "";
        divBlack.innerHTML = "";
        if (!captured) {
            return;
        }
        captured.forEach(function (piece) {
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

    function resetSquareColors() {
        if (!guiBoard[0][0]) {
            return;
        }
        for (let i = 0; i < chessGame.BOARD_ROWS; i++) {
            for (let j = 0; j < chessGame.BOARD_COLUMNS; j++) {
                guiBoard[i][j].className = "square " + (((i + j) % 2) === 0 ? "white" : "black");
            }
        }
        if (chessGame && (chessGame.Draw || (chessGame.GameState && chessGame.GameState.draw))) {
            applyDrawHighlight();
        } else {
            applyCheckedHighlight();
        }
    }

    function applyCheckedHighlight() {
        if (!chessGame || !guiBoard[0][0]) {
            return;
        }
        for (let i = 0; i < chessGame.BOARD_ROWS; i++) {
            for (let j = 0; j < chessGame.BOARD_COLUMNS; j++) {
                guiBoard[i][j].classList.remove("king-in-check", "king-in-checkmate");
            }
        }
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
        for (let i = 0; i < chessGame.BOARD_ROWS; i++) {
            for (let j = 0; j < chessGame.BOARD_COLUMNS; j++) {
                guiBoard[i][j].classList.remove("king-in-draw", "king-in-check", "king-in-checkmate");
            }
        }
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

    function syncFromGameState() {
        const state = chessGame.GameState;
        if (state && state.board) {
            drawBoard(state.board);
            updateCaptureLists(state.capturedPiecesList || []);
        }
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

    function registerInput() {
        document.onmousedown = startDrag;
        document.onmouseup = stopDrag;
        if (innerBoardEl) {
            innerBoardEl.removeEventListener("click", onBoardClick);
        }
        applyMousePreference();
    }

    function applyMousePreference() {
        if (!innerBoardEl) {
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
                const ours =
                    (currentPlayerIsWhite && pieceColor === "white") ||
                    (!currentPlayerIsWhite && pieceColor === "black");
                img.className = ours ? "draggable" : "nondraggable";
            });
        }
    }

    function startDrag(e) {
        if (mousePreference !== "drag" || chessGame.GameOver) {
            return;
        }
        draggedImage = e.target;
        if (!draggedImage.classList || !draggedImage.classList.contains("draggable")) {
            return;
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
        draggedImage.style.zIndex = "1";
        coordX = parseInt(draggedImage.style.left, 10) || 0;
        coordY = parseInt(draggedImage.style.top, 10) || 0;
        drag = true;
        sourcePosition = findPositionFromDrag();
        document.onmousemove = onDragging;
        if (showAvailableMoves) {
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

    async function stopDrag() {
        if (!drag) {
            return;
        }
        draggedImage.style.cursor = "grab";
        drag = false;
        const target = findPositionFromDrag();
        const moved = await tryHumanMove(sourcePosition, target);
        if (!moved && draggedImage && sourcePosition) {
            const div = guiBoard[sourcePosition.row][sourcePosition.col];
            if (div) {
                div.innerHTML = "";
                div.appendChild(draggedImage);
                draggedImage.style.left = "0px";
                draggedImage.style.top = "0px";
                draggedImage.style.zIndex = "0";
            }
        }
        document.onmousemove = null;
        resetSquareColors();
    }

    async function onBoardClick(e) {
        if (mousePreference !== "double" || chessGame.GameOver) {
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
        const isOurPiece =
            pieceImg &&
            ((currentPlayerIsWhite && pieceImg.src.indexOf("white") !== -1) ||
                (!currentPlayerIsWhite && pieceImg.src.indexOf("black") !== -1));
        const ourTurn =
            chessGame.Turn === (currentPlayerIsWhite ? "white" : "black");

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
        await tryHumanMove(clickToMoveSelected, pos);
        clickToMoveSelected = null;
        resetSquareColors();
    }

    async function tryHumanMove(sourcePos, targetPos) {
        const moveObj = chessGame.validateMove(sourcePos, targetPos, chessGame.Turn);
        if (!moveObj.valid) {
            return false;
        }
        const executed = chessGame.makeMove(sourcePos, targetPos);
        syncFromGameState();
        if (executed && executed.promotion && chessGame.GameState && chessGame.GameState.promoting) {
            return true;
        }
        if (onHumanMove) {
            await onHumanMove(executed);
        }
        return true;
    }

    function showPromotionDialog(onPick) {
        const boardRoot = document.getElementById("chessboard");
        if (!boardRoot) {
            return;
        }
        const existing = document.getElementById("cloak");
        if (existing) {
            existing.remove();
        }
        const last = chessGame.LastMove;
        const pieceUrls = last && last.piece && last.piece.color === "black" ? BLACK_PIECES : WHITE_PIECES;
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
        return new Promise(function (resolve) {
            const speed = 50;
            const divMoveTarget = findSquare(move.target.row, move.target.col);
            const img = divMoveTarget && divMoveTarget.childNodes[0];
            if (!img) {
                syncFromGameState();
                resolve();
                return;
            }
            const squareWidth = divMoveTarget.offsetWidth;
            const horizontalDistance = (move.source.col - move.target.col) * squareWidth;
            const verticalDistance = (move.source.row - move.target.row) * squareWidth;
            const verticalSteps = verticalDistance / speed;
            const horizontalSteps = horizontalDistance / speed;
            let left = 0;
            let top = 0;
            img.style.zIndex = "2";
            img.style.position = "absolute";
            const interval = setInterval(function () {
                left += horizontalSteps;
                top += verticalSteps;
                img.style.marginLeft = left + "px";
                img.style.marginTop = top + "px";
                if (
                    Math.abs(left - horizontalDistance * 2) < 1 &&
                    Math.abs(top - verticalDistance * 2) < 1
                ) {
                    clearInterval(interval);
                    img.style.position = "relative";
                    img.style.marginLeft = "0px";
                    img.style.marginTop = "0px";
                    syncFromGameState();
                    resolve();
                }
            }, 2);
        });
    }

    function animateMove(move) {
        return new Promise(function (resolve, reject) {
            clearArrows();
            const speed = 20;
            const divMoveTarget = findSquare(move.source.row, move.source.col);
            const img = divMoveTarget && divMoveTarget.childNodes[0];
            if (!img) {
                syncFromGameState();
                reject();
                return;
            }
            const squareWidth = divMoveTarget.offsetWidth;
            const squareHeight = divMoveTarget.offsetWidth;
            const horizontalDistance = (move.target.col - move.source.col) * squareWidth;
            const verticalDistance = (move.target.row - move.source.row) * squareHeight;
            const verticalSteps = verticalDistance / speed;
            const horizontalSteps = horizontalDistance / speed;
            let left = 0;
            let top = 0;
            img.style.zIndex = "2";
            img.style.position = "absolute";
            const interval = setInterval(function () {
                left += horizontalSteps;
                top += verticalSteps;
                img.style.marginLeft = left + "px";
                img.style.marginTop = top + "px";
                if (
                    Math.abs(left - horizontalDistance * 2) < 1 &&
                    Math.abs(top - verticalDistance * 2) < 1
                ) {
                    clearInterval(interval);
                    img.style.position = "relative";
                    img.style.marginLeft = "0px";
                    img.style.marginTop = "0px";
                    syncFromGameState();
                    resolve();
                }
            }, 2);
        });
    }

    global.DesktopBoard = {
        setGame: setGame,
        setPlayerView: setPlayerView,
        setPreferences: setPreferences,
        setHumanMoveHandler: setHumanMoveHandler,
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
        applyDrawHighlight: applyDrawHighlight,
    };
})(window);
