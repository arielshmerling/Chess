const assert = require("assert");
const { JSDOM } = require("jsdom");

const ActionRail = require("../src/play-ui/action-rail");

describe("play-ui action rail", function () {
    let dom;
    let rail;
    let clicks;

    beforeEach(function () {
        clicks = [];
        dom = new JSDOM("<body><nav id=\"rail\"></nav></body>");
        rail = dom.window.document.getElementById("rail");
    });

    it("mounts buttons, spacers, and accent class", function () {
        ActionRail.mount(rail, [
            {
                id: "rematchBtn",
                label: "New game",
                icon: "newGame",
                accent: true,
                onClick: function () {
                    clicks.push("rematch");
                },
            },
            { type: "spacer" },
            {
                id: "flipBtn",
                label: "Flip",
                icon: "flip",
                onClick: function () {
                    clicks.push("flip");
                },
            },
        ]);

        const buttons = rail.querySelectorAll("button.desktop-play-action");
        assert.strictEqual(buttons.length, 2);
        assert.ok(buttons[0].classList.contains("desktop-play-action--accent"));
        assert.strictEqual(buttons[0].id, "rematchBtn");
        assert.strictEqual(buttons[0].title, "New game");
        assert.ok(buttons[0].querySelector(".desktop-play-action-icon").innerHTML);
        assert.strictEqual(
            buttons[0].querySelector(".desktop-play-action-label").textContent,
            "New game",
        );
        assert.ok(rail.querySelector(".desktop-play-actions-spacer"));

        buttons[1].click();
        assert.deepStrictEqual(clicks, ["flip"]);
    });

    it("setDisabled toggles the button disabled flag", function () {
        ActionRail.mount(rail, [
            { id: "saveBtn", label: "Save", icon: "save", onClick: function () {} },
        ]);
        ActionRail.setDisabled("saveBtn", true, dom.window.document);
        assert.strictEqual(dom.window.document.getElementById("saveBtn").disabled, true);
        ActionRail.setDisabled("saveBtn", false, dom.window.document);
        assert.strictEqual(dom.window.document.getElementById("saveBtn").disabled, false);
    });
});
