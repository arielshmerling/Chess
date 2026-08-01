/**
 * Desktop theme CSS variable keys (single source for Node + browser).
 */
(function (root, factory) {
    var exported = factory();
    if (typeof module === "object" && module.exports) {
        module.exports = exported;
    } else {
        root.DesktopThemeKeys = exported;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    var THEME_GROUPS = [
        {
            label: "Palette",
            keys: ["--darker", "--dark", "--semiDark", "--semiLight", "--light"],
        },
        {
            label: "Top bar",
            keys: ["--topbar-link-forecolor", "--topbar-link-highlight"],
        },
        {
            label: "Board",
            keys: [
                "--body-background",
                "--darkSquare",
                "--lightSquare",
                "--optionSquare",
                "--promotion-hover-background",
                "--frame",
                "--frame-forecolor",
            ],
        },
        {
            label: "Play layout",
            keys: [
                "--play-header-background",
                "--play-footer-background",
                "--play-clock-background",
                "--play-clock-border",
                "--play-clock-text",
                "--play-clock-active-border",
                "--play-clock-active-background",
                "--play-clock-active-ring",
                "--play-game-id-text",
                "--turnClock",
            ],
        },
        {
            label: "Play dock borders",
            keys: [
                "--moves-cell-space-color",
                "--game-item-border-color",
                "--game-mode-frame-color",
            ],
        },
        {
            label: "Panels",
            keys: ["--panel-background", "--panel-border"],
        },
        {
            label: "Buttons",
            keys: ["--button-background", "--button-forecolor", "--button-highlight"],
        },
        {
            label: "Text fields",
            keys: ["--textbox-background", "--textbox-forecolor"],
        },
        {
            label: "Moves list",
            keys: [
                "--moves-panel-bg",
                "--moves-dock-title-background",
                "--moves-dock-title-text",
                "--moves-header-background",
                "--moves-header-text",
                "--moves-cell-bg",
                "--moves-cell-text",
                "--moves-cell-highlight-bg",
                "--moves-cell-highlight-text",
                "--moves-cell-selected-bg",
            ],
        },
        {
            label: "Gold button",
            keys: [
                "--gold-btn-text",
                "--gold-btn-border",
                "--gold-btn-border-hover",
                "--gold-btn-highlight",
                "--gold-btn-mid",
                "--gold-btn-dark",
                "--gold-btn-shadow",
                "--gold-btn-glow",
            ],
        },
        {
            label: "Gold slider",
            keys: [
                "--gold-slider-track-start",
                "--gold-slider-track-end",
                "--gold-slider-track-border",
            ],
        },
        {
            label: "Dialogs",
            keys: [
                "--dialog-overlay-background",
                "--dialog-overlay-blur",
                "--dialog-background",
                "--dialog-border",
                "--dialog-shadow",
                "--dialog-text",
                "--dialog-title-text",
                "--dialog-label-text",
                "--dialog-input-background",
                "--dialog-input-border",
                "--dialog-input-focus-outline",
                "--dialog-error-text",
                "--dialog-inner-background",
                "--dialog-inner-border",
            ],
        },
    ];

    var THEME_VAR_KEYS = [];
    THEME_GROUPS.forEach(function (group) {
        group.keys.forEach(function (key) {
            if (THEME_VAR_KEYS.indexOf(key) === -1) {
                THEME_VAR_KEYS.push(key);
            }
        });
    });

    return { THEME_GROUPS: THEME_GROUPS, THEME_VAR_KEYS: THEME_VAR_KEYS };
});
