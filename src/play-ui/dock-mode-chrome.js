/**
 * Moves-sidebar chrome for Position Setup and Configuration modes.
 *
 * Presentation only — toggles CSS classes and the header run panel. The shell
 * still decides when each mode is entered or left.
 */
(function (global) {
    "use strict";

    const SIDEBAR_SETUP = "desktop-play-sidebar--position-setup";
    const SIDEBAR_CONFIG = "desktop-play-sidebar--brain-config";
    const ACTION_ACTIVE = "desktop-play-action--active";
    const RUN_HIDDEN = "desktop-play-header-run--hidden";

    /**
     * Apply mutually exclusive setup/config chrome on the moves sidebar and
     * action-rail buttons.
     *
     * @param {object} elements
     * @param {HTMLElement|null} [elements.sidebar]
     * @param {HTMLElement|null} [elements.positionSetupBtn]
     * @param {HTMLElement|null} [elements.configurationBtn]
     * @param {object} state
     * @param {boolean} [state.positionSetup]
     * @param {boolean} [state.configuration]
     */
    function applyDockModes(elements, state) {
        const els = elements || {};
        const s = state || {};
        /* Configuration wins if both are requested — matches setConfigurationUi. */
        const configuration = !!s.configuration;
        const positionSetup = !!s.positionSetup && !configuration;

        if (els.sidebar) {
            els.sidebar.classList.toggle(SIDEBAR_SETUP, positionSetup);
            els.sidebar.classList.toggle(SIDEBAR_CONFIG, configuration);
        }
        if (els.positionSetupBtn) {
            els.positionSetupBtn.classList.toggle(ACTION_ACTIVE, positionSetup);
        }
        if (els.configurationBtn) {
            els.configurationBtn.classList.toggle(ACTION_ACTIVE, configuration);
        }
    }

    /**
     * Show or hide the header run panel (Play from loaded / setup position).
     *
     * @param {HTMLElement|null} el
     * @param {boolean} visible
     */
    function setGameRunVisible(el, visible) {
        if (!el) {
            return;
        }
        const show = !!visible;
        el.classList.toggle(RUN_HIDDEN, !show);
        el.setAttribute("aria-hidden", show ? "false" : "true");
    }

    /**
     * Show or hide Partner/Admin-only docks (games list, setup, config).
     *
     * @param {object} elements
     * @param {HTMLElement|null} [elements.gamesSidebar]
     * @param {HTMLElement|null} [elements.setupDock]
     * @param {HTMLElement|null} [elements.configDock]
     * @param {HTMLElement|null} [elements.body]
     * @param {boolean} allowed
     */
    function applyAdvancedToolsVisibility(elements, allowed) {
        const els = elements || {};
        const on = !!allowed;
        if (els.gamesSidebar) {
            els.gamesSidebar.hidden = !on;
            els.gamesSidebar.setAttribute("aria-hidden", on ? "false" : "true");
            els.gamesSidebar.style.display = on ? "" : "none";
        }
        if (els.body) {
            els.body.classList.toggle("desktop-play-no-games-panel", !on);
        }
        if (els.setupDock) {
            els.setupDock.hidden = !on;
            els.setupDock.setAttribute("aria-hidden", on ? "false" : "true");
        }
        if (els.configDock) {
            els.configDock.hidden = !on;
            els.configDock.setAttribute("aria-hidden", on ? "false" : "true");
        }
    }

    const DockModeChrome = {
        SIDEBAR_SETUP: SIDEBAR_SETUP,
        SIDEBAR_CONFIG: SIDEBAR_CONFIG,
        ACTION_ACTIVE: ACTION_ACTIVE,
        RUN_HIDDEN: RUN_HIDDEN,
        applyDockModes: applyDockModes,
        setGameRunVisible: setGameRunVisible,
        applyAdvancedToolsVisibility: applyAdvancedToolsVisibility,
    };

    global.PlayDockModeChrome = DockModeChrome;

    if (typeof module === "object" && module && module.exports) {
        module.exports = DockModeChrome;
    }
})(typeof window !== "undefined" ? window : globalThis);
