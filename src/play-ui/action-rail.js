/**
 * Left action rail: New game, Resign, Undo, Flip, Exit, etc.
 *
 * Presentation only. The shell supplies labels, icons keys, and click handlers,
 * and still decides which buttons are enabled.
 */
(function (global) {
    "use strict";

    const ICONS = {
        resign:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 20V12M10 20V4M16 20v-6M22 20V9\"/></svg>",
        draw:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12h8\"/></svg>",
        undo:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 14H4V9l1.4 1.4 5.6-5.6 1.4 1.4-5.6 5.6H15v2H9z\"/></svg>",
        redo:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 14h5V9l-1.4 1.4-5.6-5.6-1.4 1.4 5.6 5.6H9v2h6z\"/></svg>",
        lastMove:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 12l7-7 7 7M12 5v14\"/></svg>",
        flip:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 7h10v3l4-4.5L17 1v3H5v6h2V7zm10 10H7v-3l-4 4.5L7 23v-3h12v-6h-2v4z\"/></svg>",
        newGame:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg>",
        exit:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M10 3H5a2 2 0 00-2 2v14a2 2 0 002 2h5M14 8l5 4-5 4M11 12h8\"/></svg>",
        save:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z\"/><polyline points=\"17 21 17 13 7 13 7 21\"/><polyline points=\"7 3 7 8 15 8\"/></svg>",
        positionSetup:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/></svg>",
        configuration:
            "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"3\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
    };

    /**
     * @param {HTMLElement} rail
     * @param {Array<object>} items - `{ type:"spacer" }` or `{ id, label, icon, onClick, accent? }`
     */
    function mount(rail, items) {
        if (!rail) {
            return;
        }
        const doc = rail.ownerDocument || global.document;
        (items || []).forEach(function (item) {
            if (!item) {
                return;
            }
            if (item.type === "spacer") {
                const spacer = doc.createElement("div");
                spacer.className = "desktop-play-actions-spacer";
                rail.appendChild(spacer);
                return;
            }
            const btn = doc.createElement("button");
            btn.type = "button";
            btn.id = item.id;
            btn.className =
                "desktop-play-action" + (item.accent ? " desktop-play-action--accent" : "");
            btn.title = item.label || "";
            const iconWrap = doc.createElement("span");
            iconWrap.className = "desktop-play-action-icon";
            iconWrap.innerHTML = ICONS[item.icon] || "";
            const label = doc.createElement("span");
            label.className = "desktop-play-action-label";
            label.textContent = item.label || "";
            btn.appendChild(iconWrap);
            btn.appendChild(label);
            if (typeof item.onClick === "function") {
                btn.addEventListener("click", item.onClick);
            }
            rail.appendChild(btn);
        });
    }

    /**
     * @param {string} id
     * @param {boolean} disabled
     * @param {Document} [doc]
     */
    function setDisabled(id, disabled, doc) {
        const root = doc || global.document;
        if (!root || !id) {
            return;
        }
        const btn = root.getElementById(id);
        if (btn) {
            btn.disabled = !!disabled;
        }
    }

    const ActionRail = {
        ICONS: ICONS,
        mount: mount,
        setDisabled: setDisabled,
    };

    global.PlayActionRail = ActionRail;

    if (typeof module === "object" && module && module.exports) {
        module.exports = ActionRail;
    }
})(typeof window !== "undefined" ? window : globalThis);
