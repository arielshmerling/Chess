/**
 * Position setup panel and board-edit helpers for desktop play.
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

    const SVG = {
        eraser:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>',
        select:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
        reset:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
        defaultPos:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        save:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
        play:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="8 5 19 12 8 19 8 5"/></svg>',
        validate:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    };

    let chessGame = null;
    let panelRoot = null;
    let selected = { color: "white", pieceType: 0 };
    let onSavePosition = null;
    let onValidatePosition = null;
    let onClearBoard = null;
    let onDefaultBoard = null;
    let onSelectTool = null;
    let onTurnChange = null;
    let setupTurn = "white";
    let turnSwatchWhite = null;
    let turnSwatchBlack = null;
    let flagsRoot = null;
    let flagInputs = {};
    const STATUS_FLAG_KEYS = ["check", "checkmate", "draw"];

    const SETUP_FLAG_DEFS = [
        { key: "check", label: "Check", status: true },
        { key: "checkmate", label: "Checkmate", status: true },
        { key: "draw", label: "Draw", status: true },
        { key: "whiteKingMoved", label: "White king moved", castling: true },
        { key: "blackKingMoved", label: "Black king moved", castling: true },
        { key: "nearWhiteRookMoved", label: "White kingside rook moved", castling: true },
        { key: "farWhiteRookMoved", label: "White queenside rook moved", castling: true },
        { key: "nearBlackRookMoved", label: "Black kingside rook moved", castling: true },
        { key: "farBlackRookMoved", label: "Black queenside rook moved", castling: true },
    ];

    function mirrorNearFarRookFlagsToCastling(state) {
        if (!state) {
            return;
        }
        state.kingsideWhiteRookMoved = !!state.nearWhiteRookMoved;
        state.queensideWhiteRookMoved = !!state.farWhiteRookMoved;
        state.kingsideBlackRookMoved = !!state.nearBlackRookMoved;
        state.queensideBlackRookMoved = !!state.farBlackRookMoved;
    }

    function syncNearFarFromCastlingRookFlags(state) {
        if (!state) {
            return;
        }
        state.nearWhiteRookMoved = !!state.kingsideWhiteRookMoved;
        state.farWhiteRookMoved = !!state.queensideWhiteRookMoved;
        state.nearBlackRookMoved = !!state.kingsideBlackRookMoved;
        state.farBlackRookMoved = !!state.queensideBlackRookMoved;
    }

    function getCastlingHomeSlots(state, game) {
        if (!state || !state.board || !game) {
            return null;
        }
        const wv = state.whitePlayerView !== false;
        let whiteRow;
        let blackRow;
        let wKingR;
        let wKingC;
        let bKingR;
        let bKingC;
        let ksCol;
        let qsCol;
        if (wv) {
            whiteRow = 7;
            blackRow = 0;
            wKingR = 7;
            wKingC = 4;
            bKingR = 0;
            bKingC = 4;
            ksCol = 7;
            qsCol = 0;
        } else {
            whiteRow = 0;
            blackRow = 7;
            wKingR = 0;
            wKingC = 3;
            bKingR = 7;
            bKingC = 3;
            ksCol = 0;
            qsCol = 7;
        }
        const KING = game.KING;
        const ROOK = game.ROOK;
        return {
            whiteKingMoved: { row: wKingR, col: wKingC, color: "white", pieceType: KING },
            blackKingMoved: { row: bKingR, col: bKingC, color: "black", pieceType: KING },
            nearWhiteRookMoved: { row: whiteRow, col: ksCol, color: "white", pieceType: ROOK },
            farWhiteRookMoved: { row: whiteRow, col: qsCol, color: "white", pieceType: ROOK },
            nearBlackRookMoved: { row: blackRow, col: ksCol, color: "black", pieceType: ROOK },
            farBlackRookMoved: { row: blackRow, col: qsCol, color: "black", pieceType: ROOK },
        };
    }

    function isPieceOnHomeSquare(board, slot) {
        if (!board || !slot) {
            return false;
        }
        const p = board[slot.row] && board[slot.row][slot.col];
        return !!(p && p.color === slot.color && p.pieceType === slot.pieceType);
    }

    function syncKingRookFlagsFromBoard(state, game) {
        if (!state || !state.board || !game) {
            return;
        }
        const homes = getCastlingHomeSlots(state, game);
        if (!homes) {
            return;
        }
        const b = state.board;
        state.whiteKingMoved = !isPieceOnHomeSquare(b, homes.whiteKingMoved);
        state.blackKingMoved = !isPieceOnHomeSquare(b, homes.blackKingMoved);
        state.kingsideWhiteRookMoved = !isPieceOnHomeSquare(b, homes.nearWhiteRookMoved);
        state.queensideWhiteRookMoved = !isPieceOnHomeSquare(b, homes.farWhiteRookMoved);
        state.kingsideBlackRookMoved = !isPieceOnHomeSquare(b, homes.nearBlackRookMoved);
        state.queensideBlackRookMoved = !isPieceOnHomeSquare(b, homes.farBlackRookMoved);
        syncNearFarFromCastlingRookFlags(state);
    }

    function toolSelector() {
        return ".desktop-play-setup-piece, .desktop-play-setup-eraser, .desktop-play-setup-select, .desktop-play-setup-reset, .desktop-play-setup-default";
    }

    function clearToolSelection() {
        if (!panelRoot) {
            return;
        }
        panelRoot.querySelectorAll(toolSelector()).forEach(function (el) {
            el.classList.remove("selected");
        });
    }

    function selectTool(el) {
        clearToolSelection();
        if (el) {
            el.classList.add("selected");
        }
        if (onSelectTool) {
            onSelectTool(getSelection());
        }
    }

    function getSelection() {
        return selected;
    }

    function resetDefaultSelection() {
        if (!chessGame) {
            return;
        }
        const btn = panelRoot
            ? panelRoot.querySelector(
                  '.desktop-play-setup-piece[data-color="white"][data-piece="' +
                      chessGame.PAWN +
                      '"]',
              )
            : null;
        setSelection({ color: "white", pieceType: chessGame.PAWN });
        selectTool(btn);
    }

    function setSelection(next) {
        selected = next;
        if (onSelectTool) {
            onSelectTool(getSelection());
        }
    }

    function createPieceButton(color, pieceType) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "desktop-play-setup-piece";
        btn.setAttribute("data-color", color);
        btn.setAttribute("data-piece", String(pieceType));
        const img = document.createElement("img");
        img.src = color === "white" ? WHITE_PIECES[pieceType] : BLACK_PIECES[pieceType];
        img.alt = color + " piece";
        btn.appendChild(img);
        btn.addEventListener("click", function () {
            setSelection({ color: color, pieceType: pieceType });
            selectTool(btn);
        });
        return btn;
    }

    function refreshFlagCheckboxes() {
        if (!chessGame || !chessGame.GameState || !flagsRoot) {
            return;
        }
        const state = chessGame.GameState;
        const homes = getCastlingHomeSlots(state, chessGame);

        SETUP_FLAG_DEFS.forEach(function (def) {
            const input = flagInputs[def.key];
            const label = input && input.closest(".desktop-play-setup-flag");
            if (!input) {
                return;
            }

            if (def.status) {
                input.checked = !!state[def.key];
                input.disabled = true;
                if (label) {
                    label.classList.add("desktop-play-setup-flag--status");
                    label.classList.remove("desktop-play-setup-flag--castling-locked");
                }
                return;
            }

            if (label) {
                label.classList.remove("desktop-play-setup-flag--status");
            }

            if (!def.castling || !homes) {
                input.checked = !!state[def.key];
                input.disabled = false;
                if (label) {
                    label.classList.remove("desktop-play-setup-flag--castling-locked");
                }
                return;
            }

            const slot = homes[def.key];
            const onHome = isPieceOnHomeSquare(state.board, slot);
            input.disabled = !onHome;
            input.checked = onHome ? !state[def.key] : false;
            if (label) {
                label.classList.toggle("desktop-play-setup-flag--castling-locked", !onHome);
            }
        });
    }

    function syncStatusFlagsFromGame() {
        if (!chessGame || !chessGame.GameState) {
            return;
        }
        if (typeof chessGame.evaluate !== "function") {
            refreshFlagCheckboxes();
            return;
        }
        chessGame.evaluate();
        refreshFlagCheckboxes();
    }

    function applySetupFlag(key, uiChecked, isCastling) {
        if (STATUS_FLAG_KEYS.indexOf(key) !== -1) {
            return;
        }
        if (!chessGame || !global.DesktopBoard || !global.DesktopBoard.mutateSetupBoard) {
            return;
        }
        const stateValue = isCastling ? !uiChecked : !!uiChecked;
        global.DesktopBoard.mutateSetupBoard(
            function (state) {
                state[key] = stateValue;
                if (
                    key === "nearWhiteRookMoved" ||
                    key === "farWhiteRookMoved" ||
                    key === "nearBlackRookMoved" ||
                    key === "farBlackRookMoved"
                ) {
                    mirrorNearFarRookFlagsToCastling(state);
                }
            },
            { skipKingRookSync: true },
        );
    }

    function setSetupTurnSelection(turn) {
        setupTurn = turn === "black" ? "black" : "white";
        if (
            global.DesktopGameRun &&
            global.DesktopGameRun.updateSwatchPair
        ) {
            global.DesktopGameRun.updateSwatchPair(
                turnSwatchWhite,
                turnSwatchBlack,
                setupTurn === "white",
            );
        }
    }

    function syncTurnSelection(turn) {
        setSetupTurnSelection(turn);
    }

    function createTurnSection() {
        const section = document.createElement("div");
        section.className = "desktop-play-setup-turn";

        if (global.DesktopGameRun && global.DesktopGameRun.createSwatchRow) {
            const turnBtns = {};
            const row = global.DesktopGameRun.createSwatchRow(
                "Turn",
                setupTurn === "white",
                function (isWhite) {
                    const next = isWhite ? "white" : "black";
                    setSetupTurnSelection(next);
                    if (onTurnChange) {
                        onTurnChange(next);
                    }
                },
                turnBtns,
            );
            turnSwatchWhite = turnBtns.white;
            turnSwatchBlack = turnBtns.black;
            section.appendChild(row);
        }

        return section;
    }

    function createFlagsSection() {
        const section = document.createElement("div");
        section.className = "desktop-play-setup-flags";
        flagsRoot = section;
        flagInputs = {};

        const heading = document.createElement("span");
        heading.className = "desktop-play-setup-flags-heading";
        heading.textContent = "Position flags";
        section.appendChild(heading);

        const grid = document.createElement("div");
        grid.className = "desktop-play-setup-flags-grid";

        SETUP_FLAG_DEFS.forEach(function (def) {
            const label = document.createElement("label");
            label.className = "desktop-check desktop-play-setup-flag";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = false;
            if (def.status) {
                input.disabled = true;
                label.classList.add("desktop-play-setup-flag--status");
            } else {
                input.addEventListener("change", function () {
                    applySetupFlag(def.key, input.checked, !!def.castling);
                });
            }

            const box = document.createElement("span");
            box.className = "desktop-check-box";
            box.setAttribute("aria-hidden", "true");

            const text = document.createElement("span");
            text.className = "desktop-play-setup-flag-text";
            text.textContent = def.label;

            label.appendChild(input);
            label.appendChild(box);
            label.appendChild(text);
            grid.appendChild(label);
            flagInputs[def.key] = input;
        });

        section.appendChild(grid);
        return section;
    }

    function createToolButton(className, title, svg, onClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = className;
        btn.setAttribute("title", title);
        btn.setAttribute("aria-label", title);
        btn.innerHTML = svg;
        btn.addEventListener("click", function () {
            onClick(btn);
        });
        return btn;
    }

    function mountPanel(container, options) {
        options = options || {};
        chessGame = options.game;
        onSavePosition = options.onSavePosition || null;
        onValidatePosition = options.onValidatePosition || null;
        onClearBoard = options.onClearBoard || null;
        onDefaultBoard = options.onDefaultBoard || null;
        onSelectTool = options.onSelectTool || null;
        onTurnChange = options.onTurnChange || null;
        setupTurn =
            options.initialTurn === "black" || options.initialTurn === "white"
                ? options.initialTurn
                : chessGame && chessGame.GameState && chessGame.GameState.turn === "black"
                  ? "black"
                  : "white";

        container.innerHTML = "";
        turnSwatchWhite = null;
        turnSwatchBlack = null;
        panelRoot = container;
        flagsRoot = null;
        flagInputs = {};

        const pieceOrder = [
            chessGame.KING,
            chessGame.QUEEN,
            chessGame.ROOK,
            chessGame.BISHOP,
            chessGame.KNIGHT,
            chessGame.PAWN,
        ];

        const whiteCol = document.createElement("div");
        whiteCol.className = "desktop-play-setup-column";
        pieceOrder.forEach(function (pt) {
            whiteCol.appendChild(createPieceButton("white", pt));
        });

        const blackCol = document.createElement("div");
        blackCol.className = "desktop-play-setup-column";
        pieceOrder.forEach(function (pt) {
            blackCol.appendChild(createPieceButton("black", pt));
        });

        const controlsCol = document.createElement("div");
        controlsCol.className =
            "desktop-play-setup-column desktop-play-setup-column--controls";

        const tools = document.createElement("div");
        tools.className = "desktop-play-setup-tools";

        const eraser = createToolButton(
            "desktop-play-setup-eraser",
            "Eraser",
            SVG.eraser,
            function (btn) {
                setSelection({ mode: "eraser" });
                selectTool(btn);
            }
        );
        const selectBtn = createToolButton(
            "desktop-play-setup-select",
            "Select and move",
            SVG.select,
            function (btn) {
                setSelection({ mode: "select" });
                selectTool(btn);
            }
        );
        const resetBtn = createToolButton(
            "desktop-play-setup-reset",
            "Clear board",
            SVG.reset,
            function (btn) {
                setSelection({ mode: "eraser" });
                selectTool(btn);
                if (onClearBoard) {
                    onClearBoard();
                }
            }
        );
        const defaultBtn = createToolButton(
            "desktop-play-setup-default",
            "Default starting position",
            SVG.defaultPos,
            function () {
                if (onDefaultBoard) {
                    onDefaultBoard();
                }
                setSelection({ mode: "select" });
                selectTool(selectBtn);
            }
        );

        tools.appendChild(eraser);
        tools.appendChild(selectBtn);
        tools.appendChild(resetBtn);
        tools.appendChild(defaultBtn);
        controlsCol.appendChild(tools);

        const actions = document.createElement("div");
        actions.className = "desktop-play-setup-actions";

        const saveBtn = createToolButton("desktop-play-setup-save", "Save position", SVG.save, function () {
            if (onSavePosition) {
                onSavePosition();
            }
        });
        const validateBtn = createToolButton(
            "desktop-play-setup-validate",
            "Validate position",
            SVG.validate,
            function () {
                if (onValidatePosition) {
                    onValidatePosition();
                }
            },
        );
        actions.appendChild(saveBtn);
        actions.appendChild(validateBtn);
        controlsCol.appendChild(actions);

        const mainRow = document.createElement("div");
        mainRow.className = "desktop-play-setup-main";

        const piecesBlock = document.createElement("div");
        piecesBlock.className = "desktop-play-setup-pieces-block";

        const columnsWrap = document.createElement("div");
        columnsWrap.className = "desktop-play-setup-columns";
        columnsWrap.appendChild(whiteCol);
        columnsWrap.appendChild(blackCol);
        piecesBlock.appendChild(columnsWrap);

        mainRow.appendChild(piecesBlock);
        mainRow.appendChild(controlsCol);
        container.appendChild(mainRow);

        container.appendChild(createTurnSection());

        const flagsSection = createFlagsSection();
        container.appendChild(flagsSection);
        if (global.DesktopBoard && global.DesktopBoard.mutateSetupBoard) {
            global.DesktopBoard.mutateSetupBoard(function () {}, {});
        } else {
            refreshFlagCheckboxes();
        }

        const whitePawnBtn = whiteCol.querySelector(
            '.desktop-play-setup-piece[data-color="white"][data-piece="' + chessGame.PAWN + '"]',
        );
        if (whitePawnBtn) {
            setSelection({ color: "white", pieceType: chessGame.PAWN });
            selectTool(whitePawnBtn);
        }
    }

    function applySetupCursor(innerBoardEl, selection) {
        if (!innerBoardEl) {
            return;
        }
        if (!selection) {
            innerBoardEl.removeAttribute("data-research-cursor");
            return;
        }
        if (selection.mode === "eraser") {
            innerBoardEl.setAttribute("data-research-cursor", "eraser");
        } else if (selection.mode === "select") {
            innerBoardEl.setAttribute("data-research-cursor", "select");
        } else if (selection.color && selection.pieceType != null) {
            innerBoardEl.setAttribute("data-research-cursor", "place");
        } else {
            innerBoardEl.removeAttribute("data-research-cursor");
        }
    }

    global.DesktopPositionSetup = {
        mountPanel: mountPanel,
        getSelection: getSelection,
        setSelection: setSelection,
        resetDefaultSelection: resetDefaultSelection,
        syncKingRookFlagsFromBoard: syncKingRookFlagsFromBoard,
        applySetupCursor: applySetupCursor,
        refreshFlagCheckboxes: refreshFlagCheckboxes,
        syncStatusFlagsFromGame: syncStatusFlagsFromGame,
        syncTurnSelection: syncTurnSelection,
        WHITE_PIECES: WHITE_PIECES,
        BLACK_PIECES: BLACK_PIECES,
    };
})(window);
