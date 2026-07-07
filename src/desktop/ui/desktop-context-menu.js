/**
 * Lightweight right-click context menu for desktop play.
 */
(function (global) {
    "use strict";

    let menuEl = null;
    let dismissHandlers = null;

    function close() {
        if (menuEl) {
            menuEl.remove();
            menuEl = null;
        }
        if (dismissHandlers) {
            document.removeEventListener("pointerdown", dismissHandlers.pointerdown, true);
            document.removeEventListener("keydown", dismissHandlers.keydown, true);
            window.removeEventListener("blur", dismissHandlers.blur);
            dismissHandlers = null;
        }
    }

    function clampPosition(left, top, width, height) {
        const margin = 8;
        const maxLeft = Math.max(margin, window.innerWidth - width - margin);
        const maxTop = Math.max(margin, window.innerHeight - height - margin);
        return {
            left: Math.min(Math.max(margin, left), maxLeft),
            top: Math.min(Math.max(margin, top), maxTop),
        };
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {Array<{label?: string, onClick?: function, disabled?: boolean, separator?: boolean, header?: boolean}>} items
     */
    function show(x, y, items) {
        close();
        if (!items || !items.length) {
            return;
        }

        menuEl = document.createElement("div");
        menuEl.className = "desktop-context-menu";
        menuEl.setAttribute("role", "menu");

        items.forEach(function (item) {
            if (item.separator) {
                const sep = document.createElement("div");
                sep.className = "desktop-context-menu-separator";
                sep.setAttribute("role", "separator");
                menuEl.appendChild(sep);
                return;
            }
            if (item.header) {
                const heading = document.createElement("div");
                heading.className = "desktop-context-menu-header";
                heading.textContent = item.label || "";
                menuEl.appendChild(heading);
                return;
            }
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "desktop-context-menu-item";
            btn.setAttribute("role", "menuitem");
            btn.textContent = item.label || "";
            if (item.disabled) {
                btn.disabled = true;
            } else if (typeof item.onClick === "function") {
                btn.addEventListener("click", function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    close();
                    item.onClick();
                });
            }
            menuEl.appendChild(btn);
        });

        document.body.appendChild(menuEl);
        const rect = menuEl.getBoundingClientRect();
        const pos = clampPosition(x, y, rect.width, rect.height);
        menuEl.style.left = pos.left + "px";
        menuEl.style.top = pos.top + "px";

        dismissHandlers = {
            pointerdown: function (ev) {
                if (menuEl && !menuEl.contains(ev.target)) {
                    close();
                }
            },
            keydown: function (ev) {
                if (ev.key === "Escape") {
                    close();
                }
            },
            blur: function () {
                close();
            },
        };

        window.setTimeout(function () {
            if (!dismissHandlers) {
                return;
            }
            document.addEventListener("pointerdown", dismissHandlers.pointerdown, true);
            document.addEventListener("keydown", dismissHandlers.keydown, true);
            window.addEventListener("blur", dismissHandlers.blur);
        }, 0);
    }

    global.DesktopContextMenu = {
        show: show,
        close: close,
    };
})(window);
