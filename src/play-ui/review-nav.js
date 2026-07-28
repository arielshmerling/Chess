/**
 * Review navigation bar: Start / Back / Play-Pause / Forward / End.
 *
 * Presentation only. The caller decides when a control is allowed and what
 * each click means (jump to ply, start playback, stop playback).
 */
(function (global) {
    "use strict";

    const t =
        typeof module === "object" && module && module.exports
            ? require("../strings/t-bridge").t
            : typeof global.ShmerlingT === "function"
              ? global.ShmerlingT
              : function (key) {
                    return key;
                };

    const ICONS = {
        start:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 6h2v12H6V6zm3.5 6L18 18V6L9.5 12z\" fill=\"currentColor\"/></svg>",
        back:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 18l-6-6 6-6v12z\" fill=\"currentColor\"/></svg>",
        play:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5v14l11-7L8 5z\" fill=\"currentColor\"/></svg>",
        pause:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 5h4v14H6V5zm8 0h4v14h-4V5z\" fill=\"currentColor\"/></svg>",
        forward:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 18l6-6-6-6v12z\" fill=\"currentColor\"/></svg>",
        end:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M16 6h2v12h-2V6zM6 18V6l8.5 6L6 18z\" fill=\"currentColor\"/></svg>",
    };

    function createButton(doc, label, iconKey, className, onClick) {
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "desktop-play-review-nav-btn" + (className ? " " + className : "");
        btn.setAttribute("aria-label", label);
        btn.title = label;
        btn.innerHTML = ICONS[iconKey] || "";
        btn.addEventListener("click", function (ev) {
            ev.preventDefault();
            if (typeof onClick === "function") {
                onClick();
            }
        });
        return btn;
    }

    /**
     * Build the nav controls inside `container` once.
     *
     * @param {HTMLElement} container
     * @param {object} handlers
     * @param {() => void} [handlers.onStart]
     * @param {() => void} [handlers.onBack]
     * @param {() => void} [handlers.onPlayPause]
     * @param {() => void} [handlers.onForward]
     * @param {() => void} [handlers.onEnd]
     * @returns {{ start: HTMLButtonElement, back: HTMLButtonElement, playPause: HTMLButtonElement, forward: HTMLButtonElement, end: HTMLButtonElement, playIcon: HTMLElement, pauseIcon: HTMLElement }}
     */
    function mount(container, handlers) {
        if (!container) {
            return null;
        }
        const h = handlers || {};
        const doc = container.ownerDocument || global.document;
        container.innerHTML = "";

        const startBtn = createButton(doc, t("play.reviewNav.start"), "start", "", h.onStart);
        const backBtn = createButton(doc, t("play.reviewNav.back"), "back", "", h.onBack);

        const playPauseBtn = doc.createElement("button");
        playPauseBtn.type = "button";
        playPauseBtn.className =
            "desktop-play-review-nav-btn desktop-play-review-nav-btn--playpause";
        playPauseBtn.setAttribute("aria-label", t("play.reviewNav.play"));
        playPauseBtn.title = t("play.reviewNav.play");
        const playIcon = doc.createElement("span");
        playIcon.className = "desktop-play-review-nav-play-icon";
        playIcon.innerHTML = ICONS.play;
        playIcon.setAttribute("aria-hidden", "true");
        const pauseIcon = doc.createElement("span");
        pauseIcon.className = "desktop-play-review-nav-pause-icon";
        pauseIcon.innerHTML = ICONS.pause;
        pauseIcon.hidden = true;
        pauseIcon.setAttribute("aria-hidden", "true");
        playPauseBtn.appendChild(playIcon);
        playPauseBtn.appendChild(pauseIcon);
        playPauseBtn.addEventListener("click", function (ev) {
            ev.preventDefault();
            if (typeof h.onPlayPause === "function") {
                h.onPlayPause();
            }
        });

        const forwardBtn = createButton(doc, t("play.reviewNav.forward"), "forward", "", h.onForward);
        const endBtn = createButton(doc, t("play.reviewNav.end"), "end", "", h.onEnd);

        container.appendChild(startBtn);
        container.appendChild(backBtn);
        container.appendChild(playPauseBtn);
        container.appendChild(forwardBtn);
        container.appendChild(endBtn);

        return {
            start: startBtn,
            back: backBtn,
            playPause: playPauseBtn,
            forward: forwardBtn,
            end: endBtn,
            playIcon: playIcon,
            pauseIcon: pauseIcon,
        };
    }

    /**
     * Apply visibility and enabled/disabled state from a pure button-state object.
     *
     * @param {HTMLElement} container
     * @param {object|null} els - Return value of mount().
     * @param {object} options
     * @param {boolean} options.visible
     * @param {boolean} options.playing
     * @param {boolean} options.start
     * @param {boolean} options.back
     * @param {boolean} options.forward
     * @param {boolean} options.end
     * @param {boolean} options.playPause
     */
    function update(container, els, options) {
        if (!container) {
            return;
        }
        const opts = options || {};
        const visible = !!opts.visible;
        container.hidden = !visible;
        if (!visible || !els) {
            return;
        }
        els.start.disabled = !opts.start;
        els.back.disabled = !opts.back;
        els.forward.disabled = !opts.forward;
        els.end.disabled = !opts.end;
        els.playPause.disabled = !opts.playPause;
        const playing = !!opts.playing;
        if (els.playIcon) {
            els.playIcon.hidden = playing;
        }
        if (els.pauseIcon) {
            els.pauseIcon.hidden = !playing;
        }
        els.playPause.setAttribute("aria-label", playing ? t("play.reviewNav.pause") : t("play.reviewNav.play"));
        els.playPause.title = playing ? t("play.reviewNav.pause") : t("play.reviewNav.play");
    }

    const ReviewNav = {
        ICONS: ICONS,
        mount: mount,
        update: update,
    };

    global.PlayReviewNav = ReviewNav;

    if (typeof module === "object" && module && module.exports) {
        module.exports = ReviewNav;
    }
})(typeof window !== "undefined" ? window : globalThis);
