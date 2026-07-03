/**
 * Collapse / expand Moves and Games side panels (entire sidebar).
 */
(function (global) {
    "use strict";

    var STORAGE_KEY = "shmerling.desktop.dockPanels";
    var cachedPrefs = null;

    function refreshBoardScale() {
        if (window.DesktopBoardScale && typeof window.DesktopBoardScale.refresh === "function") {
            window.DesktopBoardScale.refresh();
        }
    }

    function isDesktopApp() {
        if (typeof window === "undefined" || !window.location) {
            return false;
        }
        return window.location.pathname.indexOf("/app") === 0;
    }

    function defaultPreferences() {
        return { leftCollapsed: true, rightCollapsed: true };
    }

    function getSidebarKey(sidebar) {
        if (!sidebar) {
            return null;
        }
        if (
            sidebar.id === "desktopPlaySidebarMoves" ||
            sidebar.classList.contains("desktop-play-sidebar--left")
        ) {
            return "left";
        }
        if (
            sidebar.id === "desktopPlaySidebarGames" ||
            sidebar.classList.contains("desktop-play-sidebar--right")
        ) {
            return "right";
        }
        return null;
    }

    function normalizePreferences(prefs) {
        var source = prefs && typeof prefs === "object" ? prefs : {};
        return {
            leftCollapsed: source.leftCollapsed !== false,
            rightCollapsed: source.rightCollapsed !== false,
        };
    }

    function rememberPreferences(prefs) {
        cachedPrefs = normalizePreferences(prefs);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedPrefs));
        } catch {
            /* ignore */
        }
    }

    function loadPreferences() {
        if (cachedPrefs) {
            return { ...cachedPrefs };
        }
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                return normalizePreferences(JSON.parse(raw));
            }
        } catch {
            /* ignore */
        }
        return defaultPreferences();
    }

    function persistPreferencesToServer(prefs) {
        if (!isDesktopApp()) {
            return;
        }
        fetch("/app/api/ui-settings", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ dockPanels: normalizePreferences(prefs) }),
        }).catch(function () {
            /* ignore */
        });
    }

    function savePreference(sidebarKey, collapsed) {
        var prefs = loadPreferences();
        if (sidebarKey === "left") {
            prefs.leftCollapsed = collapsed;
        } else if (sidebarKey === "right") {
            prefs.rightCollapsed = collapsed;
        }
        rememberPreferences(prefs);
        persistPreferencesToServer(prefs);
    }

    function setSidebarCollapsed(sidebar, collapsed, options) {
        var persist = !options || options.persist !== false;
        sidebar.classList.toggle("desktop-play-sidebar--collapsed", collapsed);
        var expandTab = sidebar.querySelector(".desktop-play-sidebar-tab--expand");
        var collapseBtns = sidebar.querySelectorAll(".desktop-play-dock-toggle--collapse");
        if (expandTab) {
            expandTab.hidden = !collapsed;
        }
        collapseBtns.forEach(function (collapseBtn) {
            collapseBtn.hidden = collapsed;
        });
        if (persist) {
            var key = getSidebarKey(sidebar);
            if (key) {
                savePreference(key, collapsed);
            }
        }
        refreshBoardScale();
    }

    function applySavedPreferences() {
        var prefs = loadPreferences();
        document.querySelectorAll(".desktop-play-sidebar").forEach(function (sidebar) {
            var key = getSidebarKey(sidebar);
            if (key === "left") {
                setSidebarCollapsed(sidebar, prefs.leftCollapsed, { persist: false });
            } else if (key === "right") {
                setSidebarCollapsed(sidebar, prefs.rightCollapsed, { persist: false });
            }
        });
    }

    function bindDockPanelToggles() {
        document.querySelectorAll(".desktop-play-sidebar").forEach(function (sidebar) {
            var collapseBtns = sidebar.querySelectorAll(".desktop-play-dock-toggle--collapse");
            var expandTab = sidebar.querySelector(".desktop-play-sidebar-tab--expand");
            if (!collapseBtns.length || !expandTab) {
                return;
            }
            collapseBtns.forEach(function (collapseBtn) {
                collapseBtn.addEventListener("click", function () {
                    setSidebarCollapsed(sidebar, true);
                });
            });
            expandTab.addEventListener("click", function () {
                setSidebarCollapsed(sidebar, false);
            });
        });
    }

    function loadPreferencesFromServer() {
        if (!isDesktopApp()) {
            return Promise.resolve();
        }
        return fetch("/app/api/ui-settings", {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
        })
            .then(function (res) {
                if (!res.ok) {
                    return null;
                }
                return res.json();
            })
            .then(function (data) {
                if (data && data.dockPanels) {
                    rememberPreferences(data.dockPanels);
                }
            })
            .catch(function () {
                /* ignore */
            });
    }

    function initDockPanelToggles() {
        loadPreferencesFromServer().then(function () {
            applySavedPreferences();
            bindDockPanelToggles();
        });
    }

    global.DesktopDockPanels = {
        setSidebarCollapsed: setSidebarCollapsed,
        applySavedPreferences: applySavedPreferences,
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDockPanelToggles);
    } else {
        initDockPanelToggles();
    }
})(window);
