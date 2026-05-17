/**
 * Fit the chess board to the desktop play main area when the window is resized.
 * Updates --board-scale on body (see desktop-play.css).
 */
(function () {
    "use strict";

    const BASE_BOARD_HEIGHT = 440;
    const FRAME_EXTRA = 40;
    const MAX_SCALE = 1.4;
    const MIN_SCALE = 0.35;
    const PADDING = 16;

    let scheduled = false;

    function updateBoardScale() {
        scheduled = false;
        const main = document.querySelector(".desktop-play-main");
        if (!main) {
            return;
        }
        const availW = Math.max(0, main.clientWidth - PADDING * 2);
        const availH = Math.max(0, main.clientHeight - PADDING * 2);
        const fitW = (availW - FRAME_EXTRA) / BASE_BOARD_HEIGHT;
        const fitH = (availH - FRAME_EXTRA) / BASE_BOARD_HEIGHT;
        let scale = Math.min(MAX_SCALE, fitW, fitH);
        if (!Number.isFinite(scale)) {
            scale = MAX_SCALE;
        }
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
        document.body.style.setProperty("--board-scale", String(scale));
    }

    function scheduleUpdate() {
        if (scheduled) {
            return;
        }
        scheduled = true;
        requestAnimationFrame(updateBoardScale);
    }

    function init() {
        const main = document.querySelector(".desktop-play-main");
        if (!main) {
            return;
        }
        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(scheduleUpdate);
            observer.observe(main);
        }
        window.addEventListener("resize", scheduleUpdate);
        updateBoardScale();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.DesktopBoardScale = { refresh: scheduleUpdate };
})();
