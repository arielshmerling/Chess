/**
 * Desktop-only customizable themes: editor panel, live preview, save/load.
 */
(function () {
    "use strict";

    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }

    var STORAGE_KEY = "shmerling.desktop.customThemes";
    var PANEL_POS_KEY = "shmerling.desktop.customThemePanelPos";

    var THEME_KEYS = window.DesktopThemeKeys || {};
    var THEME_GROUPS = THEME_KEYS.THEME_GROUPS || [];
    var THEME_VAR_KEYS = THEME_KEYS.THEME_VAR_KEYS || [];

    var panelEl = null;
    var draftVars = null;
    var referenceVars = null;
    var snapshotBeforeEdit = null;
    var snapshotThemeId = null;
    var editingSavedId = null;
    var dragState = null;
    var DEFAULT_ACTIVE_THEME = "custom:custom-mr45iwvr";
    var cachedStore = { activeTheme: DEFAULT_ACTIVE_THEME, themes: [] };
    var storeLoaded = false;
    var readyResolve = null;
    var whenReadyPromise = new Promise(function (resolve) {
        readyResolve = resolve;
    });

    function allThemeKeys() {
        if (THEME_VAR_KEYS.length) {
            return THEME_VAR_KEYS.slice();
        }
        var keys = [];
        THEME_GROUPS.forEach(function (g) {
            g.keys.forEach(function (k) {
                if (keys.indexOf(k) === -1) {
                    keys.push(k);
                }
            });
        });
        return keys;
    }

    function readStore() {
        return {
            activeTheme: cachedStore.activeTheme,
            themes: cachedStore.themes.slice(),
        };
    }

    function syncLocalStorageCache() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ themes: cachedStore.themes })
            );
            localStorage.setItem("theme", cachedStore.activeTheme);
        } catch {
            /* ignore quota / private mode */
        }
    }

    function persistToServer() {
        return fetch("/app/api/custom-themes", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(cachedStore),
        })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error("Failed to save themes");
                }
                return res.json();
            })
            .then(function (data) {
                if (data && Array.isArray(data.themes)) {
                    cachedStore.activeTheme = data.activeTheme || cachedStore.activeTheme;
                    cachedStore.themes = data.themes.map(function (t) {
                        return {
                            id: t.id,
                            name: t.name,
                            vars: completeThemeVarsClient(t.vars, "blue"),
                            updatedAt: t.updatedAt,
                        };
                    });
                    syncLocalStorageCache();
                }
            });
    }

    function writeStore(store) {
        if (store) {
            if (store.activeTheme) {
                cachedStore.activeTheme = store.activeTheme;
            }
            if (Array.isArray(store.themes)) {
                cachedStore.themes = store.themes.map(function (t) {
                    return {
                        id: t.id,
                        name: t.name,
                        vars: completeThemeVarsClient(t.vars, "blue"),
                        updatedAt: t.updatedAt,
                    };
                });
            }
        }
        syncLocalStorageCache();
        return persistToServer();
    }

    function setActiveTheme(themeId) {
        cachedStore.activeTheme = themeId;
        syncLocalStorageCache();
        return persistToServer();
    }

    function getActiveTheme() {
        return cachedStore.activeTheme || localStorage.getItem("theme") || DEFAULT_ACTIVE_THEME;
    }

    function migrateFromLocalStorage(data) {
        var changed = false;
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            var localActive = localStorage.getItem("theme");
            if (raw) {
                var parsed = JSON.parse(raw);
                if (
                    parsed &&
                    Array.isArray(parsed.themes) &&
                    parsed.themes.length > 0 &&
                    (!data.themes || data.themes.length === 0)
                ) {
                    data.themes = parsed.themes.map(function (theme) {
                        return {
                            id: theme.id,
                            name: theme.name || t("desktop.customTheme.defaultName"),
                            vars: completeThemeVarsClient(theme.vars, "blue"),
                            updatedAt: theme.updatedAt || Date.now(),
                        };
                    });
                    changed = true;
                }
            }
            if (localActive === "blue" || localActive === "dark") {
                data.activeTheme = "custom:" + localActive;
                changed = true;
            } else if (localActive && localActive.indexOf("custom:") === 0) {
                data.activeTheme = localActive;
                changed = true;
            }
        } catch {
            /* ignore */
        }
        return changed;
    }

    function hydrateFromLocalCache() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            var localActive = localStorage.getItem("theme");
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.themes) && parsed.themes.length > 0) {
                    cachedStore.themes = parsed.themes.map(function (theme) {
                        return {
                            id: theme.id,
                            name: theme.name || t("desktop.customTheme.defaultName"),
                            vars: completeThemeVarsClient(theme.vars, "blue"),
                            updatedAt: theme.updatedAt || Date.now(),
                        };
                    });
                }
            }
            if (localActive === "blue" || localActive === "dark") {
                cachedStore.activeTheme = "custom:" + localActive;
            } else if (localActive && localActive.indexOf("custom:") === 0) {
                cachedStore.activeTheme = localActive;
            }
        } catch {
            /* ignore */
        }
    }

    function resolveReady(store) {
        if (readyResolve) {
            readyResolve(store || cachedStore);
            readyResolve = null;
        }
    }

    function loadFromServer() {
        return fetch("/app/api/custom-themes", {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
        })
            .then(function (res) {
                if (!res.ok) {
                    throw new Error("Failed to load themes");
                }
                return res.json();
            })
            .then(function (data) {
                var store = {
                    activeTheme: data && data.activeTheme ? data.activeTheme : DEFAULT_ACTIVE_THEME,
                    themes: data && Array.isArray(data.themes) ? data.themes : [],
                };
                store.themes = store.themes.map(function (t) {
                    return {
                        id: t.id,
                        name: t.name,
                        vars: completeThemeVarsClient(t.vars, "blue"),
                        updatedAt: t.updatedAt,
                    };
                });
                if (migrateFromLocalStorage(store)) {
                    cachedStore = store;
                    syncLocalStorageCache();
                    return persistToServer().then(function () {
                        return store;
                    });
                }
                cachedStore = store;
                syncLocalStorageCache();
                return store;
            })
            .catch(function () {
                var fallback = { activeTheme: DEFAULT_ACTIVE_THEME, themes: [] };
                migrateFromLocalStorage(fallback);
                cachedStore = fallback;
                syncLocalStorageCache();
                return fallback;
            })
            .then(function (store) {
                cachedStore = store;
                storeLoaded = true;
                syncLocalStorageCache();
                resolveReady(store);
                document.dispatchEvent(new CustomEvent("shmerling-custom-themes-changed"));
                return store;
            });
    }

    function getBuiltinThemeVars(themeId) {
        if (typeof themes === "undefined") {
            return {};
        }
        if (themeId === "dark") {
            return normalizeThemeVars(cloneVars(themes.darkTheme));
        }
        return normalizeThemeVars(cloneVars(themes.blueTheme));
    }

    function cloneVars(obj) {
        var out = {};
        if (!obj) {
            return out;
        }
        Object.keys(obj).forEach(function (k) {
            out[k] = obj[k];
        });
        return out;
    }

    function getThemeById(id) {
        var store = readStore();
        for (var i = 0; i < store.themes.length; i++) {
            if (store.themes[i].id === id) {
                return {
                    id: store.themes[i].id,
                    name: store.themes[i].name,
                    vars: completeThemeVarsClient(store.themes[i].vars, "blue"),
                    updatedAt: store.themes[i].updatedAt,
                };
            }
        }
        return null;
    }

    function getCurrentThemeId() {
        return getActiveTheme();
    }

    function getCurrentThemeVars() {
        var themeId = getCurrentThemeId();
        if (themeId.indexOf("custom:") === 0) {
            var custom = getThemeById(themeId.slice(7));
            if (custom && custom.vars) {
                return mergeThemeVars(custom.vars, "blue");
            }
        }
        return getBuiltinThemeVars("blue");
    }

    function applyVars(vars) {
        if (typeof setDefaultTheme === "function") {
            setDefaultTheme(normalizeThemeVars(vars));
        }
    }

    function normalizeColorValue(value) {
        if (value == null) {
            return "";
        }
        return String(value).trim().replace(/;+\s*$/g, "");
    }

    function normalizeThemeVars(vars) {
        var out = cloneVars(vars);
        Object.keys(out).forEach(function (key) {
            var v = out[key];
            if (typeof v === "string") {
                var cleaned = normalizeColorValue(v);
                if (cleaned !== v) {
                    out[key] = cleaned;
                }
            }
        });
        return out;
    }

    function isColorLike(value) {
        if (!value || typeof value !== "string") {
            return false;
        }
        var v = normalizeColorValue(value);
        if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
            return true;
        }
        if (/^rgba?\(/i.test(v)) {
            return true;
        }
        if (/^hsla?\(/i.test(v)) {
            return true;
        }
        return false;
    }

    function parseToHex(value) {
        if (!value) {
            return "#808080";
        }
        var v = normalizeColorValue(value);
        if (/^#[0-9a-fA-F]{6}$/i.test(v)) {
            return v;
        }
        if (/^#[0-9a-fA-F]{3}$/i.test(v)) {
            var r = v[1];
            var g = v[2];
            var b = v[3];
            return "#" + r + r + g + g + b + b;
        }
        var rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (rgb) {
            function h(n) {
                var x = Math.max(0, Math.min(255, parseInt(n, 10)));
                return ("0" + x.toString(16)).slice(-2);
            }
            return "#" + h(rgb[1]) + h(rgb[2]) + h(rgb[3]);
        }
        return "#808080";
    }

    function usesAlphaColor(value) {
        return /^rgba\(/i.test(normalizeColorValue(value));
    }

    function formatColorFromPicker(hex, previousValue) {
        var prev = normalizeColorValue(previousValue);
        var alphaMatch = prev.match(
            /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/i
        );
        if (alphaMatch) {
            var base = parseToHex(hex);
            var parts = base.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
            if (parts) {
                return (
                    "rgba(" +
                    parseInt(parts[1], 16) +
                    ", " +
                    parseInt(parts[2], 16) +
                    ", " +
                    parseInt(parts[3], 16) +
                    ", " +
                    alphaMatch[1] +
                    ")"
                );
            }
        }
        return parseToHex(hex);
    }

    function mergeThemeVars(overlay, fallbackThemeId) {
        var fallback = fallbackThemeId === "dark" ? "dark" : "blue";
        var base = getBuiltinThemeVars(fallback);
        var out = {};
        allThemeKeys().forEach(function (k) {
            var fromOverlay =
                overlay && overlay[k] != null && String(overlay[k]).trim() !== "";
            out[k] = fromOverlay ? overlay[k] : base[k] != null ? base[k] : "";
        });
        return normalizeThemeVars(out);
    }

    /** Match server themeSchema.completeThemeVars so saves include every key. */
    function completeThemeVarsClient(overlay, fallbackThemeId) {
        return mergeThemeVars(overlay, fallbackThemeId);
    }

    function completeDraftVars() {
        var fallback = "blue";
        if (snapshotThemeId === "dark") {
            fallback = "dark";
        } else if (editingSavedId) {
            fallback = "blue";
        }
        return completeThemeVarsClient(draftVars, fallback);
    }

    var KEY_LABELS = {
        "--play-header-background": "Header panel background",
        "--play-footer-background": "Footer panel background",
        "--promotion-hover-background": "Promotion piece hover background",
        "--moves-cell-space-color": "Moves cells space color",
        "--game-item-border-color": "Game item border color",
        "--game-mode-frame-color": "Game mode frame color",
        "--topbar-link-forecolor": "Link text",
        "--topbar-link-highlight": "Link highlight",
        "--play-now-btn-background": "Play Now background",
        "--play-now-btn-forecolor": "Play Now text",
    };

    function labelForKey(key) {
        if (KEY_LABELS[key]) {
            return KEY_LABELS[key];
        }
        return key.replace(/^--/, "").replace(/-/g, " ");
    }

    function propertySearchText(key, groupLabel) {
        return (
            (groupLabel || "") +
            " " +
            labelForKey(key) +
            " " +
            key.replace(/^--/, "").replace(/-/g, " ")
        ).toLowerCase();
    }

    function applyFieldFilter(query) {
        var container = document.getElementById("desktopCustomThemeFields");
        if (!container) {
            return;
        }
        var q = (query || "").trim().toLowerCase();
        container.querySelectorAll(".desktop-custom-theme-group").forEach(function (section) {
            var visibleRows = 0;
            section.querySelectorAll(".desktop-custom-theme-row").forEach(function (row) {
                var text = row.dataset.searchText || "";
                var show = !q || text.indexOf(q) !== -1;
                row.hidden = !show;
                if (show) {
                    visibleRows += 1;
                }
            });
            section.hidden = visibleRows === 0;
        });
    }

    function ensurePanel() {
        if (panelEl) {
            return panelEl;
        }

        panelEl = document.createElement("div");
        panelEl.id = "desktopCustomThemePanel";
        panelEl.className = "desktop-custom-theme-panel";
        panelEl.hidden = true;
        panelEl.setAttribute("role", "dialog");
        panelEl.setAttribute("aria-labelledby", "desktopCustomThemeTitle");

        panelEl.innerHTML = [
            '<div class="desktop-custom-theme-header" data-drag-handle>',
            '  <h2 id="desktopCustomThemeTitle" class="desktop-custom-theme-title">' + t("desktop.customTheme.title") + "</h2>",
            '  <button type="button" class="desktop-custom-theme-close" id="desktopCustomThemeClose" aria-label="' + t("common.cancel") + '">×</button>',
            "</div>",
            '<div class="desktop-custom-theme-toolbar">',
            '  <label class="desktop-custom-theme-field">',
            '    <span class="desktop-custom-theme-field-label">' + t("desktop.customTheme.saved") + "</span>",
            '    <select id="desktopCustomThemeLoad" class="desktop-custom-theme-select"></select>',
            "  </label>",
            '  <label class="desktop-custom-theme-field desktop-custom-theme-field--name">',
            '    <span class="desktop-custom-theme-field-label">' + t("desktop.customTheme.name") + "</span>",
            '    <input type="text" id="desktopCustomThemeName" class="desktop-custom-theme-input desktop-custom-theme-name-input" maxlength="40" placeholder="' + t("desktop.customTheme.namePlaceholder") + '">',
            "  </label>",
            '  <button type="button" class="desktop-btn desktop-btn-gold desktop-custom-theme-save" id="desktopCustomThemeSave">' + t("desktop.customTheme.save") + "</button>",
            '  <button type="button" class="desktop-btn desktop-custom-theme-delete" id="desktopCustomThemeDelete" hidden>' + t("desktop.customTheme.delete") + "</button>",
            "</div>",
            '<div class="desktop-custom-theme-search">',
            '  <label class="desktop-custom-theme-search-label" for="desktopCustomThemeSearch">' + t("desktop.customTheme.searchProperties") + "</label>",
            '  <input type="search" id="desktopCustomThemeSearch" class="desktop-custom-theme-input desktop-custom-theme-search-input" placeholder="' + t("desktop.customTheme.filterPlaceholder") + '" autocomplete="off" spellcheck="false">',
            "</div>",
            '<div class="desktop-custom-theme-scroll" id="desktopCustomThemeFields"></div>',
            '<div class="desktop-custom-theme-footer">',
            '  <button type="button" class="desktop-btn" id="desktopCustomThemeCancel">' + t("common.cancel") + "</button>",
            '  <button type="button" class="desktop-btn desktop-btn-gold" id="desktopCustomThemeApplyBuiltin">' + t("desktop.customTheme.resetPreset") + "</button>",
            "</div>",
        ].join("\n");

        document.body.appendChild(panelEl);
        bindPanelEvents();
        restorePanelPosition();
        return panelEl;
    }

    function bindPanelEvents() {
        var closeBtn = document.getElementById("desktopCustomThemeClose");
        var cancelBtn = document.getElementById("desktopCustomThemeCancel");
        var saveBtn = document.getElementById("desktopCustomThemeSave");
        var deleteBtn = document.getElementById("desktopCustomThemeDelete");
        var loadSel = document.getElementById("desktopCustomThemeLoad");
        var resetBtn = document.getElementById("desktopCustomThemeApplyBuiltin");
        var searchInput = document.getElementById("desktopCustomThemeSearch");
        var header = panelEl.querySelector("[data-drag-handle]");

        closeBtn.addEventListener("click", closeEditor);
        cancelBtn.addEventListener("click", closeEditor);

        saveBtn.addEventListener("click", saveTheme);

        deleteBtn.addEventListener("click", function () {
            if (!editingSavedId) {
                return;
            }
            var store = readStore();
            var deletedThemeId = "custom:" + editingSavedId;
            var wasActive = getCurrentThemeId() === deletedThemeId;
            store.themes = store.themes.filter(function (t) {
                return t.id !== editingSavedId;
            });
            if (wasActive) {
                store.activeTheme = store.themes.length
                    ? "custom:" + store.themes[0].id
                    : DEFAULT_ACTIVE_THEME;
            }
            writeStore(store).then(function () {
                if (wasActive) {
                    if (typeof window.applyDesktopTheme === "function") {
                        window.applyDesktopTheme(store.activeTheme);
                    }
                }
                editingSavedId = null;
                populateLoadSelect();
                deleteBtn.hidden = true;
                document.getElementById("desktopCustomThemeName").value = "";
                refreshSavedThemesInPrefs();
            }).catch(function (err) {
                console.error(err);
                window.alert(t("desktop.customTheme.couldNotSave"));
            });
        });

        loadSel.addEventListener("change", function () {
            var id = loadSel.value;
            if (!id) {
                return;
            }
            var saved = getThemeById(id);
            if (saved && saved.vars) {
                var loadFallback = snapshotThemeId === "dark" ? "dark" : "blue";
                draftVars = mergeThemeVars(saved.vars, loadFallback);
                referenceVars = cloneVars(draftVars);
                editingSavedId = id;
                document.getElementById("desktopCustomThemeName").value = saved.name || "";
                document.getElementById("desktopCustomThemeDelete").hidden = false;
                renderFields();
                applyVars(draftVars);
            }
        });

        resetBtn.addEventListener("click", function () {
            var base = snapshotThemeId === "dark" ? "dark" : "blue";
            if (snapshotThemeId && snapshotThemeId.indexOf("custom:") === 0) {
                var c = getThemeById(snapshotThemeId.slice(7));
                draftVars = c ? mergeThemeVars(c.vars, base) : getBuiltinThemeVars(base);
            } else {
                draftVars = getBuiltinThemeVars(base);
            }
            referenceVars = cloneVars(draftVars);
            renderFields();
            applyVars(draftVars);
        });

        if (searchInput) {
            searchInput.addEventListener("input", function () {
                applyFieldFilter(searchInput.value);
            });
        }

        header.addEventListener("mousedown", startDrag);
        document.addEventListener("mousemove", onDrag);
        document.addEventListener("mouseup", endDrag);

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && panelEl && !panelEl.hidden) {
                closeEditor();
            }
        });
    }

    function startDrag(e) {
        if (e.button !== 0) {
            return;
        }
        var rect = panelEl.getBoundingClientRect();
        dragState = {
            startX: e.clientX,
            startY: e.clientY,
            left: rect.left,
            top: rect.top,
        };
        panelEl.classList.add("is-dragging");
        e.preventDefault();
    }

    function onDrag(e) {
        if (!dragState) {
            return;
        }
        var left = dragState.left + (e.clientX - dragState.startX);
        var top = dragState.top + (e.clientY - dragState.startY);
        var maxL = Math.max(8, window.innerWidth - panelEl.offsetWidth - 8);
        var maxT = Math.max(8, window.innerHeight - panelEl.offsetHeight - 8);
        left = Math.max(8, Math.min(maxL, left));
        top = Math.max(8, Math.min(maxT, top));
        panelEl.style.left = left + "px";
        panelEl.style.top = top + "px";
        panelEl.style.right = "auto";
        panelEl.style.bottom = "auto";
    }

    function endDrag() {
        if (!dragState) {
            return;
        }
        dragState = null;
        panelEl.classList.remove("is-dragging");
        savePanelPosition();
    }

    function savePanelPosition() {
        var rect = panelEl.getBoundingClientRect();
        localStorage.setItem(
            PANEL_POS_KEY,
            JSON.stringify({ left: rect.left, top: rect.top })
        );
    }

    function restorePanelPosition() {
        try {
            var raw = localStorage.getItem(PANEL_POS_KEY);
            if (!raw) {
                return;
            }
            var pos = JSON.parse(raw);
            if (typeof pos.left === "number" && typeof pos.top === "number") {
                panelEl.style.left = pos.left + "px";
                panelEl.style.top = pos.top + "px";
                panelEl.style.right = "auto";
                panelEl.style.bottom = "auto";
            }
        } catch {
            /* ignore */
        }
    }

    function populateLoadSelect() {
        var sel = document.getElementById("desktopCustomThemeLoad");
        if (!sel) {
            return;
        }
        var store = readStore();
        sel.innerHTML = '<option value="">— ' + t("desktop.customTheme.saved") + " —</option>";
        store.themes.forEach(function (t) {
            var opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.name || "Untitled";
            if (t.id === editingSavedId) {
                opt.selected = true;
            }
            sel.appendChild(opt);
        });
    }

    function appendResetSwatch(key, value, colorInput, textInput, textOnly, row) {
        var refValue = normalizeColorValue(
            referenceVars && referenceVars[key] != null
                ? String(referenceVars[key])
                : value
        );
        var swatch = document.createElement("button");
        swatch.type = "button";
        swatch.className = "desktop-custom-theme-swatch";
        swatch.title = t("desktop.customTheme.resetToOriginal");
        swatch.setAttribute(
            "aria-label",
            t("desktop.customTheme.resetPropertyAria", { label: labelForKey(key) }),
        );
        if (isColorLike(refValue)) {
            swatch.style.background = refValue;
        } else if (key === "--turnClock") {
            swatch.textContent = "◐";
        } else {
            swatch.style.background = "transparent";
        }
        swatch.addEventListener("click", function () {
            draftVars[key] = refValue;
            if (isColorLike(refValue)) {
                if (colorInput) {
                    colorInput.value = parseToHex(refValue);
                }
                if (textInput) {
                    textInput.value = refValue;
                }
            } else if (textOnly) {
                textOnly.value = refValue;
            }
            applyVars(draftVars);
        });
        row.appendChild(swatch);
    }

    function renderFields() {
        var container = document.getElementById("desktopCustomThemeFields");
        if (!container || !draftVars) {
            return;
        }
        container.innerHTML = "";

        THEME_GROUPS.forEach(function (group) {
            var section = document.createElement("section");
            section.className = "desktop-custom-theme-group";

            var title = document.createElement("h3");
            title.className = "desktop-custom-theme-group-title";
            title.textContent = group.label;
            section.appendChild(title);

            group.keys.forEach(function (key) {
                var value =
                    draftVars[key] != null ? normalizeColorValue(String(draftVars[key])) : "";
                var row = document.createElement("div");
                row.className = "desktop-custom-theme-row";
                row.dataset.searchText = propertySearchText(key, group.label);

                var label = document.createElement("label");
                label.className = "desktop-custom-theme-row-label";
                label.textContent = labelForKey(key);
                label.setAttribute("for", "ctf-" + key.slice(2));

                var controls = document.createElement("div");
                controls.className = "desktop-custom-theme-row-controls";

                var colorInput = null;
                var textInput = null;
                var textOnly = null;

                if (isColorLike(value)) {
                    colorInput = document.createElement("input");
                    colorInput.type = "color";
                    colorInput.className = "desktop-custom-theme-color";
                    colorInput.id = "ctf-" + key.slice(2);
                    colorInput.value = parseToHex(value);
                    colorInput.dataset.themeKey = key;

                    textInput = document.createElement("input");
                    textInput.type = "text";
                    textInput.className = "desktop-custom-theme-input desktop-custom-theme-hex";
                    if (usesAlphaColor(value)) {
                        textInput.classList.add("desktop-custom-theme-hex--alpha");
                    }
                    textInput.value = value;
                    textInput.dataset.themeKey = key;
                    textInput.setAttribute("spellcheck", "false");

                    function syncFromColor() {
                        var next = formatColorFromPicker(colorInput.value, draftVars[key]);
                        textInput.value = next;
                        draftVars[key] = next;
                        applyVars(draftVars);
                    }

                    function syncFromText() {
                        var v = normalizeColorValue(textInput.value);
                        if (!isColorLike(v)) {
                            return;
                        }
                        draftVars[key] = v;
                        textInput.value = v;
                        colorInput.value = parseToHex(v);
                        textInput.classList.toggle(
                            "desktop-custom-theme-hex--alpha",
                            usesAlphaColor(v)
                        );
                        applyVars(draftVars);
                    }

                    colorInput.addEventListener("input", syncFromColor);
                    textInput.addEventListener("change", syncFromText);
                    textInput.addEventListener("input", syncFromText);

                    controls.appendChild(colorInput);
                    controls.appendChild(textInput);
                } else {
                    textOnly = document.createElement("input");
                    textOnly.type = "text";
                    textOnly.className = "desktop-custom-theme-input desktop-custom-theme-hex";
                    textOnly.value = value;
                    textOnly.dataset.themeKey = key;
                    textOnly.placeholder = "e.g. invert(1)";
                    textOnly.addEventListener("input", function () {
                        draftVars[key] = textOnly.value;
                        applyVars(draftVars);
                    });
                    controls.appendChild(textOnly);
                }

                row.appendChild(label);
                row.appendChild(controls);
                appendResetSwatch(key, value, colorInput, textInput, textOnly, row);
                section.appendChild(row);
            });

            container.appendChild(section);
        });

        var searchInput = document.getElementById("desktopCustomThemeSearch");
        applyFieldFilter(searchInput ? searchInput.value : "");
    }

    function canOpenThemeEditor() {
        if (
            window.ShmerlingPlayShell
            && typeof window.ShmerlingPlayShell.isElectronPlayPage === "function"
            && window.ShmerlingPlayShell.isElectronPlayPage()
        ) {
            return true;
        }
        if (typeof window.__SHMERLING_CAN_CUSTOMIZE_THEMES__ === "boolean") {
            return window.__SHMERLING_CAN_CUSTOMIZE_THEMES__;
        }
        return false;
    }

    function openEditor() {
        if (!canOpenThemeEditor()) {
            return;
        }
        ensurePanel();
        snapshotThemeId = getCurrentThemeId();
        var fallback = snapshotThemeId === "dark" ? "dark" : "blue";
        snapshotBeforeEdit = mergeThemeVars(getCurrentThemeVars(), fallback);
        draftVars = cloneVars(snapshotBeforeEdit);
        referenceVars = cloneVars(snapshotBeforeEdit);

        var currentCustom =
            snapshotThemeId.indexOf("custom:") === 0 ? snapshotThemeId.slice(7) : null;
        var nameInput = document.getElementById("desktopCustomThemeName");
        if (currentCustom) {
            var saved = getThemeById(currentCustom);
            editingSavedId = saved ? currentCustom : null;
            nameInput.value = saved ? saved.name : "";
            document.getElementById("desktopCustomThemeDelete").hidden = !saved;
        } else {
            editingSavedId = null;
            nameInput.value = "";
            document.getElementById("desktopCustomThemeDelete").hidden = true;
        }

        draftVars = mergeThemeVars(draftVars, fallback);
        referenceVars = cloneVars(draftVars);
        populateLoadSelect();
        var searchInput = document.getElementById("desktopCustomThemeSearch");
        if (searchInput) {
            searchInput.value = "";
        }
        renderFields();
        panelEl.hidden = false;

        var prefs = document.getElementById("desktopPrefsPanel");
        if (prefs) {
            prefs.hidden = true;
        }
    }

    function closeEditor(restore) {
        if (!panelEl) {
            return;
        }
        var shouldRestore = restore !== false;
        if (shouldRestore && snapshotBeforeEdit) {
            applyVars(snapshotBeforeEdit);
            if (snapshotThemeId && typeof window.applyDesktopTheme === "function") {
                if (snapshotThemeId.indexOf("custom:") === 0) {
                    window.applyDesktopTheme(snapshotThemeId);
                } else {
                    window.applyDesktopTheme(snapshotThemeId === "dark" ? "dark" : "blue");
                }
            }
        }
        panelEl.hidden = true;
        draftVars = null;
        referenceVars = null;
        snapshotBeforeEdit = null;
    }

    function saveTheme() {
        var nameInput = document.getElementById("desktopCustomThemeName");
        var name = (nameInput.value || "").trim() || t("desktop.customTheme.defaultName");
        var store = readStore();
        var id = editingSavedId || "custom-" + Date.now().toString(36);
        var entry = {
            id: id,
            name: name,
            vars: completeDraftVars(),
            updatedAt: Date.now(),
        };

        var found = false;
        store.themes = store.themes.map(function (t) {
            if (t.id === id) {
                found = true;
                return entry;
            }
            return t;
        });
        if (!found) {
            store.themes.push(entry);
        }
        writeStore(store)
            .then(function () {
            editingSavedId = id;
            var saved = getThemeById(id);
            if (saved && saved.vars) {
                draftVars = cloneVars(saved.vars);
                referenceVars = cloneVars(saved.vars);
            }
            if (typeof window.applyDesktopTheme === "function") {
                window.applyDesktopTheme("custom:" + id);
            } else if (saved && saved.vars) {
                applyVars(saved.vars);
                setActiveTheme("custom:" + id);
            } else {
                applyVars(draftVars);
                setActiveTheme("custom:" + id);
            }
            snapshotBeforeEdit = cloneVars(draftVars);
            snapshotThemeId = "custom:" + id;
            populateLoadSelect();
            document.getElementById("desktopCustomThemeDelete").hidden = false;
            refreshSavedThemesInPrefs();
        })
            .catch(function (err) {
                console.error(err);
                window.alert(t("desktop.customTheme.couldNotSave"));
            });
    }

    function refreshSavedThemesInPrefs() {
        document.dispatchEvent(new CustomEvent("shmerling-custom-themes-changed"));
    }

    function renderSavedThemeButtons(container) {
        if (!container) {
            return;
        }
        container.innerHTML = "";
        container.classList.add("desktop-prefs-gallery");

        var store = readStore();
        var current = getCurrentThemeId();
        var selectedName = "";

        var status = document.createElement("div");
        status.className = "desktop-prefs-gallery-status";
        status.id = "desktopPrefsThemeStatus";

        var grid = document.createElement("div");
        grid.className = "desktop-prefs-gallery-grid desktop-prefs-gallery-grid--themes";
        grid.setAttribute("role", "group");

        store.themes.forEach(function (theme) {
            var themeKey = "custom:" + theme.id;
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "desktop-theme-choice desktop-theme-choice--tile";
            btn.setAttribute("data-theme", themeKey);
            btn.setAttribute("aria-label", theme.name || "Untitled");
            btn.title = theme.name || "Untitled";
            var active = current === themeKey;
            btn.setAttribute("aria-pressed", active ? "true" : "false");
            if (active) {
                btn.classList.add("is-active");
                selectedName = theme.name || "Untitled";
            }

            var vars = theme.vars || {};
            var light = vars["--lightSquare"] || vars["--light"] || "#e8e0d0";
            var dark = vars["--darkSquare"] || vars["--dark"] || "#6b8cae";
            var frame = vars["--frame"] || vars["--darker"] || "#293241";
            var ambience = vars["--body-background"] || vars["--darker"] || "#1a1a1a";

            var swatch = document.createElement("span");
            swatch.className = "desktop-theme-swatch desktop-theme-swatch--board";
            swatch.setAttribute("aria-hidden", "true");
            swatch.style.setProperty("--theme-preview-light", light);
            swatch.style.setProperty("--theme-preview-dark", dark);
            swatch.style.setProperty("--theme-preview-frame", frame);
            swatch.style.setProperty("--theme-preview-ambience", ambience);

            var board = document.createElement("span");
            board.className = "desktop-theme-swatch-board";
            for (var i = 0; i < 16; i++) {
                var cell = document.createElement("span");
                var row = Math.floor(i / 4);
                var col = i % 4;
                cell.className =
                    "desktop-theme-swatch-cell" +
                    ((row + col) % 2 === 0
                        ? " desktop-theme-swatch-cell--light"
                        : " desktop-theme-swatch-cell--dark");
                board.appendChild(cell);
            }
            swatch.appendChild(board);
            btn.appendChild(swatch);

            btn.addEventListener("click", function () {
                if (typeof window.applyDesktopTheme === "function") {
                    window.applyDesktopTheme(themeKey);
                }
                renderSavedThemeButtons(container);
            });
            grid.appendChild(btn);
        });

        status.textContent = selectedName
            ? (typeof window.ShmerlingStrings !== "undefined" &&
              typeof window.ShmerlingStrings.t === "function"
                ? window.ShmerlingStrings.t("desktop.prefs.selectedTheme", { name: selectedName })
                : "Selected: " + selectedName)
            : "";

        container.appendChild(status);
        container.appendChild(grid);
    }

    window.DesktopCustomTheme = {
        openEditor: openEditor,
        closeEditor: closeEditor,
        getThemeById: getThemeById,
        getSavedThemes: function () {
            return readStore().themes;
        },
        applyVars: applyVars,
        getCurrentThemeVars: getCurrentThemeVars,
        renderSavedThemeButtons: renderSavedThemeButtons,
        allThemeKeys: allThemeKeys,
        whenReady: function () {
            return whenReadyPromise;
        },
        isStoreLoaded: function () {
            return storeLoaded;
        },
        getActiveTheme: getActiveTheme,
        setActiveTheme: setActiveTheme,
    };

    /* Resolve whenReady from local cache first so theme paint is not gated on Mongo. */
    hydrateFromLocalCache();
    resolveReady(cachedStore);
    loadFromServer();
})();
