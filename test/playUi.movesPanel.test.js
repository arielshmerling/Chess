const assert = require("assert");
const { JSDOM } = require("jsdom");

const MovesPanel = require("../src/play-ui/moves-panel");

function move(moveStr, turn) {
    return turn ? { moveStr, turn } : { moveStr };
}

describe("play-ui moves panel", function () {
    describe("row model", function () {
        it("pairs white and black half-moves into numbered rows", function () {
            const rows = MovesPanel.buildRows([
                move("e4", "white"),
                move("e5", "black"),
                move("Nf3", "white"),
            ]);

            assert.deepStrictEqual(
                rows.map((r) => [r.num, r.white, r.black]),
                [
                    [1, "e4", "e5"],
                    [2, "Nf3", ""],
                ],
            );
        });

        it("shows a placeholder when the list starts on black", function () {
            const rows = MovesPanel.buildRows([move("e5", "black"), move("Nf3", "white")]);

            assert.deepStrictEqual(
                rows.map((r) => [r.num, r.white, r.black]),
                [
                    [1, "-", "e5"],
                    [2, "Nf3", ""],
                ],
            );
        });

        it("pairs by position when move colours are unknown", function () {
            const rows = MovesPanel.buildRows([move("e4"), move("e5"), move("Nf3")]);

            assert.deepStrictEqual(
                rows.map((r) => [r.num, r.white, r.black]),
                [
                    [1, "e4", "e5"],
                    [2, "Nf3", ""],
                ],
            );
        });

        it("derives colour from the moved piece when turn is absent", function () {
            const rows = MovesPanel.buildRows([
                { moveStr: "e5", piece: { color: "black" } },
            ]);

            assert.strictEqual(rows[0].white, "-");
            assert.strictEqual(rows[0].black, "e5");
        });

        it("numbers plies 1-based and skips result moves", function () {
            const rows = MovesPanel.buildRows([
                move("e4", "white"),
                move("e5", "black"),
                move("1-0", "white"),
            ]);

            assert.deepStrictEqual(
                rows.map((r) => [r.whitePly, r.blackPly]),
                [
                    [1, 2],
                    [null, null],
                ],
            );
        });

        it("honours a caller-supplied result-move predicate", function () {
            const rows = MovesPanel.buildRows([move("resigned", "white")], function (m) {
                return m.moveStr === "resigned";
            });

            assert.strictEqual(rows[0].whitePly, null);
        });

        it("returns no rows for an empty or missing list", function () {
            assert.deepStrictEqual(MovesPanel.buildRows([]), []);
            assert.deepStrictEqual(MovesPanel.buildRows(null), []);
        });
    });

    describe("normalizeMoves", function () {
        it("parses JSON string moves and keeps object moves", function () {
            const moves = MovesPanel.normalizeMoves([
                JSON.stringify({ moveStr: "e4", turn: "white" }),
                { moveStr: "e5", turn: "black", extra: "dropped" },
            ]);

            assert.deepStrictEqual(moves, [
                { moveStr: "e4", turn: "white" },
                { moveStr: "e5", turn: "black" },
            ]);
        });

        it("yields an empty move for unparsable entries", function () {
            assert.deepStrictEqual(MovesPanel.normalizeMoves(["{not json"]), [{ moveStr: "" }]);
        });
    });

    describe("appendResultMove", function () {
        it("appends the result opposite the last mover", function () {
            const list = MovesPanel.appendResultMove([move("e4", "white")], "1-0");

            assert.deepStrictEqual(list[list.length - 1], { moveStr: "1-0", turn: "black" });
        });

        it("does not modify the input list", function () {
            const input = [move("e4", "white")];
            MovesPanel.appendResultMove(input, "1-0");

            assert.strictEqual(input.length, 1);
        });

        it("skips appending when there is no result", function () {
            assert.deepStrictEqual(MovesPanel.appendResultMove([move("e4", "white")], null), [
                move("e4", "white"),
            ]);
        });

        it("skips appending when the list already ends with a result", function () {
            const list = MovesPanel.appendResultMove(
                [move("e4", "white"), move("1-0", "black")],
                "1-0",
            );

            assert.strictEqual(list.length, 2);
        });

        it("places the result on black for an empty list", function () {
            const list = MovesPanel.appendResultMove([], "1/2-1/2");

            assert.deepStrictEqual(list, [{ moveStr: "1/2-1/2", turn: "black" }]);
        });
    });

    describe("render", function () {
        let dom;
        let container;

        beforeEach(function () {
            dom = new JSDOM('<div id="movesDiv"></div>');
            container = dom.window.document.getElementById("movesDiv");
            /* scrollIntoView is not implemented by jsdom. */
            dom.window.HTMLElement.prototype.scrollIntoView = function () {};
        });

        it("renders one table row per move pair", function () {
            MovesPanel.render(container, [move("e4", "white"), move("e5", "black")]);

            const rows = container.querySelectorAll("table.movesTable tr");
            assert.strictEqual(rows.length, 1);
            const cells = rows[0].querySelectorAll("td");
            assert.deepStrictEqual(
                Array.from(cells).map((td) => [td.className, td.textContent]),
                [
                    ["tdNum", "1"],
                    ["tdMove", "e4"],
                    ["tdMove", "e5"],
                ],
            );
        });

        it("sets a tooltip matching the cell text", function () {
            MovesPanel.render(container, [move("e4", "white")]);

            const white = container.querySelectorAll(".tdMove")[0];
            assert.strictEqual(white.title, "e4");
        });

        it("replaces previous contents on re-render", function () {
            MovesPanel.render(container, [move("e4", "white")]);
            MovesPanel.render(container, [move("d4", "white")]);

            assert.strictEqual(container.querySelectorAll("table").length, 1);
            assert.strictEqual(container.querySelector(".tdMove").textContent, "d4");
        });

        it("leaves the panel untouched when moves are null", function () {
            MovesPanel.render(container, [move("e4", "white")]);
            MovesPanel.render(container, null);

            assert.strictEqual(container.querySelectorAll("table").length, 1);
        });

        it("makes plies clickable only when a handler is supplied", function () {
            MovesPanel.render(container, [move("e4", "white"), move("e5", "black")]);
            assert.strictEqual(container.querySelectorAll("[data-ply]").length, 0);

            const clicked = [];
            MovesPanel.render(container, [move("e4", "white"), move("e5", "black")], {
                onPlyActivate: (ply) => clicked.push(ply),
            });

            const cells = container.querySelectorAll(".tdMove");
            assert.deepStrictEqual(
                Array.from(cells).map((td) => td.dataset.ply),
                ["1", "2"],
            );
            cells[1].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
            assert.deepStrictEqual(clicked, [2]);
        });

        it("activates a ply from the keyboard", function () {
            const clicked = [];
            MovesPanel.render(container, [move("e4", "white")], {
                onPlyActivate: (ply) => clicked.push(ply),
            });

            const cell = container.querySelector(".tdMove");
            assert.strictEqual(cell.getAttribute("role"), "button");
            assert.strictEqual(cell.getAttribute("tabindex"), "0");
            cell.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
            cell.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: " ", bubbles: true }));
            cell.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "a", bubbles: true }));

            assert.deepStrictEqual(clicked, [1, 1]);
        });

        it("marks the selected ply", function () {
            MovesPanel.render(container, [move("e4", "white"), move("e5", "black")], {
                onPlyActivate: () => {},
                selectedPly: 2,
            });

            const selected = container.querySelectorAll(".selectedMove");
            assert.strictEqual(selected.length, 1);
            assert.strictEqual(selected[0].dataset.ply, "2");
        });

        it("clears a previous selection when re-rendered without one", function () {
            MovesPanel.render(container, [move("e4", "white")], {
                onPlyActivate: () => {},
                selectedPly: 1,
            });
            MovesPanel.render(container, [move("e4", "white")], { onPlyActivate: () => {} });

            assert.strictEqual(container.querySelectorAll(".selectedMove").length, 0);
        });
    });
});
