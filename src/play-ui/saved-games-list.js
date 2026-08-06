/**
 * Saved games sidebar list: builds each entry's DOM and refreshes the list.
 *
 * Presentation only. The caller supplies the display fields and the handlers for
 * every user action; this module never talks to the bookmark API or ChessGame.
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

    const ACTION_ICONS = {
        edit:
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\"/></svg>",
        delete:
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/><line x1=\"10\" y1=\"11\" x2=\"10\" y2=\"17\"/><line x1=\"14\" y1=\"11\" x2=\"14\" y2=\"17\"/></svg>",
        rename:
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z\"/><line x1=\"7\" y1=\"7\" x2=\"7.01\" y2=\"7\"/></svg>",
        load:
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"><polyline points=\"20 6 9 17 4 12\"/></svg>",
        expand:
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"9 6 15 12 9 18\"/></svg>",
        info:
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"12\" y1=\"16\" x2=\"12\" y2=\"12\"/><line x1=\"12\" y1=\"8\" x2=\"12.01\" y2=\"8\"/></svg>",
    };

    function createIconButton(doc, title, iconKey, onClick) {
        const btn = doc.createElement("button");
        btn.type = "button";
        btn.className = "desktop-play-saved-game-icon-btn";
        btn.setAttribute("title", title);
        btn.setAttribute("aria-label", title);
        btn.innerHTML = ACTION_ICONS[iconKey] || "";
        btn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            if (typeof onClick === "function") {
                onClick(ev);
            }
        });
        return btn;
    }

    /**
     * @param {Document} doc
     * @param {object} view
     * @param {string} view.id
     * @param {boolean} view.isPosition
     * @param {boolean} view.selected
     * @param {boolean} view.expanded
     * @param {boolean} view.renaming
     * @param {string} view.name
     * @param {string} view.nameTitle
     * @param {string} view.dateText
     * @param {string} view.turnText
     * @param {string} view.playersText
     * @param {string} view.infoTooltip
     * @param {boolean} view.showEdit
     * @param {object} handlers
     * @returns {HTMLElement}
     */
    function createItem(doc, view, handlers) {
        const h = handlers || {};
        const id = view.id;
        const div = doc.createElement("div");
        div.className = "desktop-play-saved-game";
        if (view.isPosition) {
            div.classList.add("desktop-play-saved-position");
        }
        div.dataset.bookmarkId = id;
        if (view.expanded) {
            div.classList.add("expanded");
        }
        if (view.selected) {
            div.classList.add("is-selected");
        }
        div.setAttribute("aria-selected", view.selected ? "true" : "false");

        const row = doc.createElement("div");
        row.className = "desktop-play-saved-game-row";
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.setAttribute("aria-expanded", view.expanded ? "true" : "false");
        row.addEventListener("click", function (ev) {
            if (typeof h.onRowClick === "function") {
                h.onRowClick(ev);
            }
        });

        if (view.renaming) {
            const renameInput = doc.createElement("input");
            renameInput.type = "text";
            renameInput.className = "desktop-play-saved-game-rename-input";
            renameInput.value = view.name || t("play.savedGames.defaultName");
            renameInput.setAttribute("aria-label", t("play.savedGames.nameAriaLabel"));
            renameInput.addEventListener("click", function (ev) {
                ev.stopPropagation();
            });
            renameInput.addEventListener("keydown", function (ev) {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    if (typeof h.onRenameCommit === "function") {
                        h.onRenameCommit(renameInput.value);
                    }
                } else if (ev.key === "Escape") {
                    ev.preventDefault();
                    if (typeof h.onRenameCancel === "function") {
                        h.onRenameCancel();
                    }
                }
            });
            row.appendChild(renameInput);
        } else {
            const nameSpan = doc.createElement("span");
            nameSpan.className = "desktop-play-saved-game-name";
            nameSpan.textContent = view.name || t("play.savedGames.defaultName");
            nameSpan.title = view.nameTitle || nameSpan.textContent;
            nameSpan.setAttribute("role", "button");
            nameSpan.setAttribute("tabindex", "0");
            nameSpan.addEventListener("click", function (ev) {
                if (typeof h.onNameClick === "function") {
                    h.onNameClick(ev);
                }
            });
            nameSpan.addEventListener("dblclick", function (ev) {
                if (typeof h.onNameDblClick === "function") {
                    h.onNameDblClick(ev);
                }
            });
            nameSpan.addEventListener("keydown", function (ev) {
                if (typeof h.onNameKeydown === "function") {
                    h.onNameKeydown(ev);
                }
            });
            row.appendChild(nameSpan);
        }

        const expandBtn = createIconButton(doc, t("play.savedGames.showDetails"), "expand", h.onExpand);
        expandBtn.classList.add("desktop-play-saved-game-expand");
        expandBtn.setAttribute("aria-expanded", view.expanded ? "true" : "false");
        row.appendChild(expandBtn);
        div.appendChild(row);

        const details = doc.createElement("div");
        details.className = "desktop-play-saved-game-details";

        const turnLine = doc.createElement("div");
        turnLine.className = "desktop-play-saved-game-turn";
        turnLine.textContent = view.turnText || "";
        details.appendChild(turnLine);

        const meta = doc.createElement("div");
        meta.className = "desktop-play-saved-game-meta";
        meta.textContent = view.dateText || "";
        details.appendChild(meta);

        const playersLine = doc.createElement("div");
        playersLine.className = "desktop-play-saved-game-players";
        playersLine.textContent = view.playersText || "";
        details.appendChild(playersLine);

        const actions = doc.createElement("div");
        actions.className = "desktop-play-saved-game-actions";
        if (view.infoTooltip) {
            const infoBtn = createIconButton(doc, view.infoTooltip, "info", function () {});
            infoBtn.setAttribute("aria-label", t("play.savedGames.detailsAriaLabel"));
            actions.appendChild(infoBtn);
        }
        if (view.showEdit) {
            actions.appendChild(createIconButton(doc, t("play.savedGames.editPosition"), "edit", h.onEdit));
        }
        actions.appendChild(createIconButton(doc, t("play.savedGames.deleteSavedGame"), "delete", h.onDelete));
        actions.appendChild(createIconButton(doc, t("play.savedGames.renameSavedGame"), "rename", h.onRename));
        details.appendChild(actions);
        div.appendChild(details);

        div.addEventListener("contextmenu", function (ev) {
            if (typeof h.onContextMenu === "function") {
                h.onContextMenu(ev);
            }
        });

        return div;
    }

    /**
     * Replace the contents of `container` with the filtered entries.
     *
     * @param {HTMLElement} container
     * @param {Array<object>} views - Display data for each entry (see createItem).
     * @param {object} [options]
     * @param {"games"|"positions"} [options.filter]
     * @param {(view: object) => object} [options.handlersFor] - Returns handlers for a view.
     */
    function render(container, views, options) {
        if (!container) {
            return;
        }
        const opts = options || {};
        const doc = container.ownerDocument || global.document;
        container.innerHTML = "";
        const list = views || [];
        if (!list.length) {
            const empty = doc.createElement("p");
            empty.className = "desktop-play-saved-list-empty";
            empty.textContent =
                opts.filter === "positions"
                    ? t("play.savedGames.noSavedPositions")
                    : t("play.savedGames.noSavedGames");
            container.appendChild(empty);
            return;
        }
        list.forEach(function (view) {
            const handlers =
                typeof opts.handlersFor === "function" ? opts.handlersFor(view) : {};
            container.appendChild(createItem(doc, view, handlers));
        });
    }

    /**
     * Toggle the expanded class on the item for `bookmarkId`. Collapses any other
     * open item. Returns the id that is now expanded, or null.
     *
     * @param {HTMLElement} container
     * @param {string} bookmarkId
     * @returns {string|null}
     */
    function toggleExpanded(container, bookmarkId) {
        if (!container) {
            return null;
        }
        const item = container.querySelector(
            ".desktop-play-saved-game[data-bookmark-id='" + bookmarkId + "']",
        );
        if (!item) {
            return null;
        }
        container.querySelectorAll(".desktop-play-saved-game.expanded").forEach(function (el) {
            if (el !== item) {
                el.classList.remove("expanded");
            }
        });
        const wasExpanded = item.classList.contains("expanded");
        item.classList.toggle("expanded");
        const expanded = !wasExpanded;
        const row = item.querySelector(".desktop-play-saved-game-row");
        if (row) {
            row.setAttribute("aria-expanded", expanded ? "true" : "false");
        }
        const expandBtn = item.querySelector(".desktop-play-saved-game-expand");
        if (expandBtn) {
            expandBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
        }
        return expanded ? String(bookmarkId) : null;
    }

    /**
     * @param {HTMLElement} container
     * @param {Set<string>|Array<string>} selectedIds
     */
    function syncSelection(container, selectedIds) {
        if (!container) {
            return;
        }
        const selected =
            selectedIds instanceof Set
                ? selectedIds
                : new Set((selectedIds || []).map(String));
        container.querySelectorAll(".desktop-play-saved-game").forEach(function (el) {
            const id = el.dataset.bookmarkId;
            const isSelected = id != null && selected.has(id);
            el.classList.toggle("is-selected", isSelected);
            el.setAttribute("aria-selected", isSelected ? "true" : "false");
        });
    }

    /**
     * Focus and select the rename input for `bookmarkId`, if it is on screen.
     * @param {HTMLElement} container
     * @param {string} bookmarkId
     */
    function focusRenameInput(container, bookmarkId) {
        if (!container) {
            return;
        }
        const input = container.querySelector(
            ".desktop-play-saved-game[data-bookmark-id='" +
                bookmarkId +
                "'] .desktop-play-saved-game-rename-input",
        );
        if (input) {
            input.focus();
            input.select();
        }
    }

    const SavedGamesList = {
        render: render,
        toggleExpanded: toggleExpanded,
        syncSelection: syncSelection,
        focusRenameInput: focusRenameInput,
    };

    global.PlaySavedGamesList = SavedGamesList;

    /* Node (unit tests) — browsers load this file as a plain script. */
    if (typeof module === "object" && module && module.exports) {
        module.exports = SavedGamesList;
    }
})(typeof window !== "undefined" ? window : globalThis);
