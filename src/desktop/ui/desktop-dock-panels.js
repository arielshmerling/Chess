/**
 * Collapse / expand Moves and Games side panels (entire sidebar).
 */
(function (global) {
    "use strict";

    function refreshBoardScale() {
        if (window.DesktopBoardScale && typeof window.DesktopBoardScale.refresh === "function") {
            window.DesktopBoardScale.refresh();
        }
    }

    function setSidebarCollapsed(sidebar, collapsed) {
        sidebar.classList.toggle("desktop-play-sidebar--collapsed", collapsed);
        const expandTab = sidebar.querySelector(".desktop-play-sidebar-tab--expand");
        const collapseBtns = sidebar.querySelectorAll(".desktop-play-dock-toggle--collapse");
        if (expandTab) {
            expandTab.hidden = !collapsed;
        }
        collapseBtns.forEach(function (collapseBtn) {
            collapseBtn.hidden = collapsed;
        });
        refreshBoardScale();
    }

    function initDockPanelToggles() {
        document.querySelectorAll(".desktop-play-sidebar").forEach(function (sidebar) {
            const collapseBtns = sidebar.querySelectorAll(".desktop-play-dock-toggle--collapse");
            const expandTab = sidebar.querySelector(".desktop-play-sidebar-tab--expand");
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

    global.DesktopDockPanels = {
        setSidebarCollapsed: setSidebarCollapsed,
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initDockPanelToggles);
    } else {
        initDockPanelToggles();
    }
})(window);
