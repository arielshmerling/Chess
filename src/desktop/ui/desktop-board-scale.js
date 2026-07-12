/**
 * Fit the chess board and left action rail to the play window when resized.
 * Updates --board-scale and --desktop-play-actions-scale on body (see desktop-play.css).
 */
(function () {
    "use strict";

    const BASE_BOARD_HEIGHT = 440;
    const FRAME_EXTRA = 40;
    /** Smallest board edge (excluding outer frame). */
    const MIN_BOARD_SIZE = 200;
    const MIN_BOARD_SCALE = MIN_BOARD_SIZE / BASE_BOARD_HEIGHT;
    /** Fallback only when layout size is not yet measurable. */
    const DEFAULT_BOARD_SCALE = 1.4;
    const BOARD_PADDING = 16;

    const MIN_RAIL_SCALE = 0.5;
    const RAIL_FIT_MARGIN = 0.97;

    let scheduled = false;

    function updateBoardScale() {
        const main = document.querySelector(".desktop-play-main");
        if (!main) {
            return;
        }
        const availW = Math.max(0, main.clientWidth - BOARD_PADDING * 2);
        const availH = Math.max(0, main.clientHeight - BOARD_PADDING * 2);
        const fitW = (availW - FRAME_EXTRA) / BASE_BOARD_HEIGHT;
        const fitH = (availH - FRAME_EXTRA) / BASE_BOARD_HEIGHT;
        let scale = Math.min(fitW, fitH);
        if (!Number.isFinite(scale) || scale <= 0) {
            scale = DEFAULT_BOARD_SCALE;
        }
        scale = Math.max(MIN_BOARD_SCALE, scale);
        document.body.style.setProperty("--board-scale", String(scale));
    }

    function measureActionRailOverflow(rail) {
        document.body.style.setProperty("--desktop-play-actions-scale", "1");
        document.body.classList.remove("desktop-play-actions--compact");
        return {
            avail: rail.clientHeight,
            needed: rail.scrollHeight,
        };
    }

    function updateActionRailScale() {
        const rail = document.getElementById("desktopPlayActions");
        if (!rail || !rail.children.length) {
            return;
        }

        let { avail, needed } = measureActionRailOverflow(rail);
        if (avail <= 0 || needed <= avail) {
            document.body.style.setProperty("--desktop-play-actions-scale", "1");
            document.body.classList.remove("desktop-play-actions--compact");
            return;
        }

        document.body.classList.add("desktop-play-actions--compact");

        let scale = (avail / needed) * RAIL_FIT_MARGIN;
        scale = Math.max(MIN_RAIL_SCALE, Math.min(1, scale));
        document.body.style.setProperty("--desktop-play-actions-scale", String(scale));

        avail = rail.clientHeight;
        needed = rail.scrollHeight;
        if (needed > avail && scale > MIN_RAIL_SCALE) {
            scale = Math.max(MIN_RAIL_SCALE, scale * (avail / needed) * RAIL_FIT_MARGIN);
            document.body.style.setProperty("--desktop-play-actions-scale", String(scale));
        }
    }

    function updateLayoutScales() {
        scheduled = false;
        updateBoardScale();
        updateActionRailScale();
    }

    function scheduleUpdate() {
        if (scheduled) {
            return;
        }
        scheduled = true;
        requestAnimationFrame(updateLayoutScales);
    }

    function init() {
        const main = document.querySelector(".desktop-play-main");
        const rail = document.getElementById("desktopPlayActions");
        if (!main && !rail) {
            return;
        }
        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(scheduleUpdate);
            if (main) {
                observer.observe(main);
            }
            if (rail) {
                observer.observe(rail);
            }
            const shell = document.querySelector(".desktop-play-shell");
            if (shell) {
                observer.observe(shell);
            }
        }
        window.addEventListener("resize", scheduleUpdate);
        updateLayoutScales();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    window.DesktopBoardScale = { refresh: scheduleUpdate };
})();
