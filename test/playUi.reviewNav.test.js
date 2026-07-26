const assert = require("assert");
const { JSDOM } = require("jsdom");

const ReviewNav = require("../src/play-ui/review-nav");

describe("play-ui review nav", function () {
    let dom;
    let container;

    beforeEach(function () {
        dom = new JSDOM('<div id="desktopPlayReviewNav"></div>');
        container = dom.window.document.getElementById("desktopPlayReviewNav");
    });

    it("mounts the five nav controls", function () {
        const els = ReviewNav.mount(container, {});
        assert.ok(els);
        assert.strictEqual(container.querySelectorAll("button").length, 5);
        assert.strictEqual(els.start.getAttribute("aria-label"), "Start");
        assert.strictEqual(els.playPause.getAttribute("aria-label"), "Play");
        assert.strictEqual(els.pauseIcon.hidden, true);
    });

    it("fires the mounted handlers", function () {
        const calls = [];
        ReviewNav.mount(container, {
            onStart: () => calls.push("start"),
            onBack: () => calls.push("back"),
            onPlayPause: () => calls.push("playPause"),
            onForward: () => calls.push("forward"),
            onEnd: () => calls.push("end"),
        });

        container.querySelectorAll("button").forEach((btn) => btn.click());
        assert.deepStrictEqual(calls, ["start", "back", "playPause", "forward", "end"]);
    });

    it("hides the bar when not visible", function () {
        const els = ReviewNav.mount(container, {});
        ReviewNav.update(container, els, { visible: false });
        assert.strictEqual(container.hidden, true);
    });

    it("applies enabled flags and play/pause icons", function () {
        const els = ReviewNav.mount(container, {});
        ReviewNav.update(container, els, {
            visible: true,
            playing: true,
            start: false,
            back: false,
            forward: false,
            end: false,
            playPause: true,
        });

        assert.strictEqual(container.hidden, false);
        assert.strictEqual(els.start.disabled, true);
        assert.strictEqual(els.playPause.disabled, false);
        assert.strictEqual(els.playIcon.hidden, true);
        assert.strictEqual(els.pauseIcon.hidden, false);
        assert.strictEqual(els.playPause.getAttribute("aria-label"), "Pause");
        assert.strictEqual(els.playPause.title, "Pause");

        ReviewNav.update(container, els, {
            visible: true,
            playing: false,
            start: true,
            back: true,
            forward: true,
            end: true,
            playPause: true,
        });
        assert.strictEqual(els.playIcon.hidden, false);
        assert.strictEqual(els.pauseIcon.hidden, true);
        assert.strictEqual(els.playPause.getAttribute("aria-label"), "Play");
    });
});
