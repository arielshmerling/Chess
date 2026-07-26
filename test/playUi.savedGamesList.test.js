const assert = require("assert");
const { JSDOM } = require("jsdom");

const SavedGamesList = require("../src/play-ui/saved-games-list");

function makeView(overrides) {
    return Object.assign(
        {
            id: "abc",
            isPosition: false,
            selected: false,
            expanded: false,
            renaming: false,
            name: "Saved — ariel vs. Engine",
            nameTitle: "Saved — ariel vs. Engine",
            dateText: "1/2/26, 3:04 AM",
            turnText: "Next move: White",
            playersText: "ariel vs. Engine",
            infoTooltip: "Saved: 1/2/26\nariel vs. Engine\nGame ID: abc",
            showEdit: true,
        },
        overrides,
    );
}

describe("play-ui saved games list", function () {
    let dom;
    let container;

    beforeEach(function () {
        dom = new JSDOM('<div id="gamesDiv"></div>');
        container = dom.window.document.getElementById("gamesDiv");
    });

    describe("render", function () {
        it("shows an empty message for games and positions", function () {
            SavedGamesList.render(container, [], { filter: "games" });
            assert.strictEqual(
                container.querySelector(".desktop-play-saved-list-empty").textContent,
                "No saved games yet.",
            );

            SavedGamesList.render(container, [], { filter: "positions" });
            assert.strictEqual(
                container.querySelector(".desktop-play-saved-list-empty").textContent,
                "No saved positions yet.",
            );
        });

        it("renders one item per view with the display fields", function () {
            SavedGamesList.render(container, [makeView()]);

            const item = container.querySelector(".desktop-play-saved-game");
            assert.ok(item);
            assert.strictEqual(item.dataset.bookmarkId, "abc");
            assert.strictEqual(
                item.querySelector(".desktop-play-saved-game-name").textContent,
                "Saved — ariel vs. Engine",
            );
            assert.strictEqual(
                item.querySelector(".desktop-play-saved-game-turn").textContent,
                "Next move: White",
            );
            assert.strictEqual(
                item.querySelector(".desktop-play-saved-game-players").textContent,
                "ariel vs. Engine",
            );
            assert.strictEqual(
                item.querySelector(".desktop-play-saved-game-meta").textContent,
                "1/2/26, 3:04 AM",
            );
        });

        it("marks positions, selection, and expansion", function () {
            SavedGamesList.render(container, [
                makeView({ isPosition: true, selected: true, expanded: true }),
            ]);

            const item = container.querySelector(".desktop-play-saved-game");
            assert.ok(item.classList.contains("desktop-play-saved-position"));
            assert.ok(item.classList.contains("is-selected"));
            assert.ok(item.classList.contains("expanded"));
            assert.strictEqual(item.getAttribute("aria-selected"), "true");
            assert.strictEqual(
                item.querySelector(".desktop-play-saved-game-row").getAttribute("aria-expanded"),
                "true",
            );
        });

        it("hides the edit button when showEdit is false", function () {
            SavedGamesList.render(container, [makeView({ showEdit: false })]);

            const titles = Array.from(
                container.querySelectorAll(".desktop-play-saved-game-icon-btn"),
            ).map((btn) => btn.getAttribute("title"));
            assert.ok(!titles.includes("Edit position"));
            assert.ok(titles.includes("Delete saved game"));
            assert.ok(titles.includes("Rename saved game"));
        });

        it("shows a rename input instead of the name when renaming", function () {
            SavedGamesList.render(container, [makeView({ renaming: true })]);

            assert.strictEqual(container.querySelector(".desktop-play-saved-game-name"), null);
            const input = container.querySelector(".desktop-play-saved-game-rename-input");
            assert.ok(input);
            assert.strictEqual(input.value, "Saved — ariel vs. Engine");
        });
    });

    describe("handlers", function () {
        it("fires expand, delete, and rename handlers", function () {
            const calls = [];
            SavedGamesList.render(container, [makeView()], {
                handlersFor: () => ({
                    onExpand: () => calls.push("expand"),
                    onDelete: () => calls.push("delete"),
                    onRename: () => calls.push("rename"),
                }),
            });

            container.querySelector(".desktop-play-saved-game-expand").click();
            container.querySelector('button[title="Delete saved game"]').click();
            container.querySelector('button[title="Rename saved game"]').click();

            assert.deepStrictEqual(calls, ["expand", "delete", "rename"]);
        });

        it("commits rename on Enter and cancels on Escape", function () {
            const calls = [];
            SavedGamesList.render(container, [makeView({ renaming: true })], {
                handlersFor: () => ({
                    onRenameCommit: (value) => calls.push(["commit", value]),
                    onRenameCancel: () => calls.push(["cancel"]),
                }),
            });

            const input = container.querySelector(".desktop-play-saved-game-rename-input");
            input.value = "New name";
            input.dispatchEvent(
                new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            );
            input.dispatchEvent(
                new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
            );

            assert.deepStrictEqual(calls, [
                ["commit", "New name"],
                ["cancel"],
            ]);
        });

        it("fires name click, dblclick, and keyboard activate", function () {
            const calls = [];
            SavedGamesList.render(container, [makeView()], {
                handlersFor: () => ({
                    onNameClick: () => calls.push("click"),
                    onNameDblClick: () => calls.push("dblclick"),
                    onNameKeydown: (ev) => calls.push("key:" + ev.key),
                }),
            });

            const name = container.querySelector(".desktop-play-saved-game-name");
            name.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
            name.dispatchEvent(new dom.window.MouseEvent("dblclick", { bubbles: true }));
            name.dispatchEvent(
                new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
            );

            assert.deepStrictEqual(calls, ["click", "dblclick", "key:Enter"]);
        });
    });

    describe("toggleExpanded", function () {
        it("expands one item and collapses the previous one", function () {
            SavedGamesList.render(container, [
                makeView({ id: "a", expanded: true }),
                makeView({ id: "b", name: "Other" }),
            ]);

            const next = SavedGamesList.toggleExpanded(container, "b");
            assert.strictEqual(next, "b");
            assert.ok(
                container
                    .querySelector(".desktop-play-saved-game[data-bookmark-id='b']")
                    .classList.contains("expanded"),
            );
            assert.ok(
                !container
                    .querySelector(".desktop-play-saved-game[data-bookmark-id='a']")
                    .classList.contains("expanded"),
            );

            assert.strictEqual(SavedGamesList.toggleExpanded(container, "b"), null);
        });
    });

    describe("syncSelection", function () {
        it("marks the selected ids and clears the others", function () {
            SavedGamesList.render(container, [
                makeView({ id: "a", selected: true }),
                makeView({ id: "b", name: "Other" }),
            ]);

            SavedGamesList.syncSelection(container, new Set(["b"]));

            const a = container.querySelector(".desktop-play-saved-game[data-bookmark-id='a']");
            const b = container.querySelector(".desktop-play-saved-game[data-bookmark-id='b']");
            assert.ok(!a.classList.contains("is-selected"));
            assert.ok(b.classList.contains("is-selected"));
            assert.strictEqual(b.getAttribute("aria-selected"), "true");
        });
    });
});
