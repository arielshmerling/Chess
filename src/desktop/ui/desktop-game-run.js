/**
 * Play / turn / computer-side controls for starting games from setup or saved entries.
 */
(function (global) {
    "use strict";

    const SVG_PLAY =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="8 5 19 12 8 19 8 5"/></svg>';

    let panelRoot = null;
    let runTurn = "white";
    let runComputerIsWhite = false;
    let onPlay = null;
    let onTurnChange = null;
    let onComputerColorChange = null;
    let turnSwatchWhite = null;
    let turnSwatchBlack = null;
    let computerSwatchWhite = null;
    let computerSwatchBlack = null;

    function updateSwatchPair(whiteBtn, blackBtn, isWhiteSelected) {
        if (whiteBtn) {
            whiteBtn.classList.toggle("selected", isWhiteSelected);
            whiteBtn.setAttribute("aria-pressed", isWhiteSelected ? "true" : "false");
        }
        if (blackBtn) {
            blackBtn.classList.toggle("selected", !isWhiteSelected);
            blackBtn.setAttribute("aria-pressed", !isWhiteSelected ? "true" : "false");
        }
    }

    function appendSwatchSelectionDot(btn) {
        const dot = document.createElement("span");
        dot.className = "desktop-play-game-run-swatch-dot";
        dot.setAttribute("aria-hidden", "true");
        btn.appendChild(dot);
    }

    function createSwatchToggle(labelText, initialWhite, onPick, btnOut) {
        const row = document.createElement("div");
        row.className = "desktop-play-game-run-row";

        const label = document.createElement("span");
        label.className = "desktop-play-game-run-label";
        label.textContent = labelText;
        row.appendChild(label);

        const group = document.createElement("div");
        group.className = "desktop-play-game-run-swatch-group";
        group.setAttribute("role", "group");
        group.setAttribute("aria-label", labelText);

        const whiteBtn = document.createElement("button");
        whiteBtn.type = "button";
        whiteBtn.className =
            "desktop-play-game-run-swatch desktop-play-game-run-swatch--white";
        whiteBtn.title = "White";
        whiteBtn.setAttribute("aria-label", "White");
        appendSwatchSelectionDot(whiteBtn);
        whiteBtn.addEventListener("click", function () {
            onPick(true);
        });

        const blackBtn = document.createElement("button");
        blackBtn.type = "button";
        blackBtn.className =
            "desktop-play-game-run-swatch desktop-play-game-run-swatch--black";
        blackBtn.title = "Black";
        blackBtn.setAttribute("aria-label", "Black");
        appendSwatchSelectionDot(blackBtn);
        blackBtn.addEventListener("click", function () {
            onPick(false);
        });

        group.appendChild(whiteBtn);
        group.appendChild(blackBtn);
        row.appendChild(group);

        if (btnOut) {
            btnOut.white = whiteBtn;
            btnOut.black = blackBtn;
        }

        updateSwatchPair(whiteBtn, blackBtn, initialWhite);
        return row;
    }

    function setTurnSelection(turn) {
        runTurn = turn === "black" ? "black" : "white";
        updateSwatchPair(turnSwatchWhite, turnSwatchBlack, runTurn === "white");
    }

    function setComputerColorSelection(isWhite) {
        runComputerIsWhite = !!isWhite;
        updateSwatchPair(
            computerSwatchWhite,
            computerSwatchBlack,
            runComputerIsWhite,
        );
    }

    function resolveInitialComputerIsWhite(options) {
        if (typeof options.initialComputerIsWhite === "boolean") {
            return options.initialComputerIsWhite;
        }
        if (typeof options.initialHumanIsWhite === "boolean") {
            return !options.initialHumanIsWhite;
        }
        return false;
    }

    function mount(container, options) {
        options = options || {};
        onPlay = options.onPlay || null;
        onTurnChange = options.onTurnChange || null;
        onComputerColorChange =
            options.onComputerColorChange || options.onHumanColorChange || null;
        runTurn =
            options.initialTurn === "black" || options.initialTurn === "white"
                ? options.initialTurn
                : "white";
        runComputerIsWhite = resolveInitialComputerIsWhite(options);

        container.innerHTML = "";
        panelRoot = container;
        container.className = "desktop-play-game-run";

        const controls = document.createElement("div");
        controls.className = "desktop-play-game-run-controls";

        const turnBtns = {};
        controls.appendChild(
            createSwatchToggle(
                "Next Move",
                runTurn === "white",
                function (isWhite) {
                    const next = isWhite ? "white" : "black";
                    setTurnSelection(next);
                    if (onTurnChange) {
                        onTurnChange(next);
                    }
                },
                turnBtns,
            ),
        );
        turnSwatchWhite = turnBtns.white;
        turnSwatchBlack = turnBtns.black;

        const computerBtns = {};
        const computerRow = createSwatchToggle(
            "Computer",
            runComputerIsWhite,
            function (isWhite) {
                setComputerColorSelection(isWhite);
                if (onComputerColorChange) {
                    onComputerColorChange(isWhite);
                }
            },
            computerBtns,
        );
        computerRow.setAttribute(
            "title",
            "Which color the computer plays — you play the other side",
        );
        controls.appendChild(computerRow);
        computerSwatchWhite = computerBtns.white;
        computerSwatchBlack = computerBtns.black;

        container.appendChild(controls);

        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "desktop-play-game-run-play";
        playBtn.setAttribute("title", "Play");
        playBtn.setAttribute("aria-label", "Play");
        playBtn.innerHTML = SVG_PLAY;
        playBtn.addEventListener("click", function () {
            if (onPlay) {
                onPlay();
            }
        });
        container.appendChild(playBtn);
    }

    function syncOptions(opts) {
        opts = opts || {};
        if (opts.turn === "black" || opts.turn === "white") {
            setTurnSelection(opts.turn);
        }
        if (typeof opts.computerIsWhite === "boolean") {
            setComputerColorSelection(opts.computerIsWhite);
        } else if (typeof opts.humanIsWhite === "boolean") {
            setComputerColorSelection(!opts.humanIsWhite);
        }
    }

    function getOptions() {
        return {
            turn: runTurn,
            computerIsWhite: runComputerIsWhite,
            humanIsWhite: !runComputerIsWhite,
        };
    }

    global.DesktopGameRun = {
        mount: mount,
        getOptions: getOptions,
        syncOptions: syncOptions,
        setTurnSelection: setTurnSelection,
        setComputerColorSelection: setComputerColorSelection,
        createSwatchRow: createSwatchToggle,
        updateSwatchPair: updateSwatchPair,
    };
})(window);
