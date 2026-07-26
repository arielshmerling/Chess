/**
 * Moves panel: turns a move list into numbered rows and renders the moves table.
 *
 * Presentation only. The caller decides which moves to show, whether a move is a
 * result move (1-0 / 0-1 / …), which ply is selected, and what a ply click means.
 */
(function (global) {
    "use strict";

    const RESULT_MOVE_STRINGS = ["1-0", "0-1", "1/2-1/2", "*"];

    /**
     * @param {*} move
     * @returns {"white"|"black"|null} Side that played the move, when known.
     */
    function moveColor(move) {
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

    /**
     * @param {string} moveStr
     * @returns {boolean}
     */
    function isResultMoveString(moveStr) {
        return RESULT_MOVE_STRINGS.indexOf(moveStr) !== -1;
    }

    /**
     * Move lists arrive either as objects or as JSON strings (saved games / server).
     * @param {Array<object|string>} moves
     * @returns {Array<{ moveStr: string, turn?: string }>}
     */
    function normalizeMoves(moves) {
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

    function defaultIsResultMove(move) {
        return !!move && isResultMoveString(move.moveStr || "");
    }

    /**
     * Append the game result (1-0 / 0-1 / …) as a trailing pseudo move, unless the
     * list already ends with one. The result takes the colour opposite the last move
     * so it lands in its own table cell.
     *
     * @param {Array<object>} moves
     * @param {string|null} resultStr
     * @param {(move: object) => boolean} [isResultMove]
     * @returns {Array<object>} New list; the input is not modified.
     */
    function appendResultMove(moves, resultStr, isResultMove) {
        const list = (moves || []).slice();
        if (!resultStr) {
            return list;
        }
        const isResult = isResultMove || defaultIsResultMove;
        const last = list[list.length - 1];
        if (last && last.moveStr === resultStr) {
            return list;
        }
        if (last && isResult(last)) {
            return list;
        }
        const resultMove = { moveStr: resultStr };
        const lastColor = moveColor(last);
        if (lastColor === "white") {
            resultMove.turn = "black";
        } else if (lastColor === "black") {
            resultMove.turn = "white";
        } else if (list.length === 0) {
            resultMove.turn = "black";
        } else if (list.length % 2 === 1) {
            resultMove.turn = "black";
        } else {
            resultMove.turn = "white";
        }
        list.push(resultMove);
        return list;
    }

    /**
     * Pair half-moves into table rows. A list that starts on black, or whose colours
     * are unknown, still produces one row per move pair.
     *
     * Ply numbers are 1-based positions in `moves`; result moves get no ply because
     * there is no position to navigate to.
     *
     * @param {Array<object>} moves
     * @param {(move: object) => boolean} [isResultMove]
     * @returns {Array<{ num: number, white: string, black: string, whitePly: number|null, blackPly: number|null }>}
     */
    function buildRows(moves, isResultMove) {
        const rows = [];
        if (!moves || !moves.length) {
            return rows;
        }
        const isResult = isResultMove || defaultIsResultMove;
        let i = 0;
        let rowNum = 1;
        while (i < moves.length) {
            const move = moves[i];
            const color = moveColor(move);
            const row = {
                num: rowNum,
                white: "",
                black: "",
                whitePly: null,
                blackPly: null,
            };
            rowNum += 1;
            if (color === "black") {
                row.white = "-";
                row.black = move.moveStr || "";
                if (!isResult(move)) {
                    row.blackPly = i + 1;
                }
                rows.push(row);
                i += 1;
                continue;
            }
            row.white = move.moveStr || "";
            if (!isResult(move)) {
                row.whitePly = i + 1;
            }
            const next = i + 1 < moves.length ? moves[i + 1] : null;
            const pairs = next && (color !== "white" || moveColor(next) === "black");
            if (pairs) {
                row.black = next.moveStr || "";
                if (!isResult(next)) {
                    row.blackPly = i + 2;
                }
                i += 2;
            } else {
                i += 1;
            }
            rows.push(row);
        }
        return rows;
    }

    function setCellLabel(td, text) {
        const label = text == null ? "" : String(text);
        td.textContent = label;
        td.title = label;
    }

    function makePlyCellClickable(td, ply, onPlyActivate) {
        td.dataset.ply = String(ply);
        td.classList.add("desktop-play-move-clickable");
        td.setAttribute("role", "button");
        td.setAttribute("tabindex", "0");
        td.addEventListener("click", function (ev) {
            ev.preventDefault();
            onPlyActivate(ply);
        });
        td.addEventListener("keydown", function (ev) {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onPlyActivate(ply);
            }
        });
    }

    /**
     * Mark the row cell for `selectedPly` and scroll it into view.
     * @param {HTMLElement} container
     * @param {number|null} selectedPly
     */
    function highlightSelectedPly(container, selectedPly) {
        if (!container) {
            return;
        }
        container.querySelectorAll(".tdMove").forEach(function (td) {
            td.classList.remove("selectedMove");
        });
        if (!selectedPly) {
            return;
        }
        const selected = container.querySelector(".tdMove[data-ply='" + selectedPly + "']");
        if (selected) {
            selected.classList.add("selectedMove");
            selected.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
    }

    /**
     * Replace the contents of `container` with the moves table.
     *
     * @param {HTMLElement} container
     * @param {Array<object>} moves - Already filtered/ordered by the caller.
     * @param {object} [options]
     * @param {(move: object) => boolean} [options.isResultMove]
     * @param {(ply: number) => void} [options.onPlyActivate] - Enables ply clicks when set.
     * @param {number|null} [options.selectedPly]
     */
    function render(container, moves, options) {
        if (!container || moves == null) {
            return;
        }
        const opts = options || {};
        const doc = container.ownerDocument || global.document;
        const clickable = typeof opts.onPlyActivate === "function";

        container.innerHTML = "";
        const table = doc.createElement("table");
        table.className = "movesTable";

        const rows = buildRows(moves, opts.isResultMove);
        for (let r = 0; r < rows.length; r += 1) {
            const row = rows[r];
            const tr = doc.createElement("tr");
            const tdNum = doc.createElement("td");
            tdNum.textContent = String(row.num);
            tdNum.className = "tdNum";
            const tdWhite = doc.createElement("td");
            tdWhite.className = "tdMove";
            setCellLabel(tdWhite, row.white);
            const tdBlack = doc.createElement("td");
            tdBlack.className = "tdMove";
            setCellLabel(tdBlack, row.black);
            if (clickable) {
                if (row.whitePly) {
                    makePlyCellClickable(tdWhite, row.whitePly, opts.onPlyActivate);
                }
                if (row.blackPly) {
                    makePlyCellClickable(tdBlack, row.blackPly, opts.onPlyActivate);
                }
            }
            tr.appendChild(tdNum);
            tr.appendChild(tdWhite);
            tr.appendChild(tdBlack);
            table.appendChild(tr);
        }

        container.appendChild(table);
        highlightSelectedPly(container, opts.selectedPly || null);
        container.scrollTop = container.scrollHeight;
    }

    const MovesPanel = {
        moveColor: moveColor,
        isResultMoveString: isResultMoveString,
        normalizeMoves: normalizeMoves,
        appendResultMove: appendResultMove,
        buildRows: buildRows,
        highlightSelectedPly: highlightSelectedPly,
        render: render,
    };

    global.PlayMovesPanel = MovesPanel;

    /* Node (unit tests) — browsers load this file as a plain script. */
    if (typeof module === "object" && module && module.exports) {
        module.exports = MovesPanel;
    }
})(typeof window !== "undefined" ? window : globalThis);
