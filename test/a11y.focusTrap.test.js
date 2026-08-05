const assert = require("assert");
const { JSDOM } = require("jsdom");

describe("a11y focusTrap", function () {
    let trapFocus;
    let window;
    let document;

    beforeEach(function () {
        const html =
            "<!DOCTYPE html><html><body>" +
            '<div id="dlg" role="dialog">' +
            '<button id="a">A</button><button id="b">B</button>' +
            "</div>" +
            '<button id="outside">Outside</button>' +
            "</body></html>";
        const dom = new JSDOM(html);
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.HTMLElement = window.HTMLElement;
        delete require.cache[require.resolve("../src/a11y/focusTrap")];
        trapFocus = require("../src/a11y/focusTrap").trapFocus;
    });

    afterEach(function () {
        delete global.window;
        delete global.document;
        delete global.HTMLElement;
    });

    it("focuses the first control and restores previous focus on release", function () {
        const outside = document.getElementById("outside");
        outside.focus();
        const dlg = document.getElementById("dlg");
        const session = trapFocus(dlg);
        assert.strictEqual(document.activeElement && document.activeElement.id, "a");
        session.release();
        assert.strictEqual(document.activeElement && document.activeElement.id, "outside");
    });

    it("cycles Tab from last to first within the dialog", function () {
        const dlg = document.getElementById("dlg");
        const b = document.getElementById("b");
        trapFocus(dlg, { initialFocus: b });
        assert.strictEqual(document.activeElement.id, "b");
        const evt = new window.KeyboardEvent("keydown", {
            key: "Tab",
            bubbles: true,
            cancelable: true,
        });
        dlg.dispatchEvent(evt);
        assert.strictEqual(document.activeElement.id, "a");
    });
});
