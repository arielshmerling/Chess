/**
 * Snapshot of the in-progress game so a page refresh resumes it instead of
 * starting a new one. sessionStorage scopes it to the tab: closing the tab
 * (or leaving Play) starts fresh.
 */
(function () {
    "use strict";

    const STORAGE_KEY = "shmerling.play.activeGame";
    const SNAPSHOT_VERSION = 1;

    function storage() {
        try {
            return window.sessionStorage || null;
        } catch {
            /* Blocked by browser privacy settings. */
            return null;
        }
    }

    function clear() {
        const store = storage();
        if (!store) {
            return;
        }
        try {
            store.removeItem(STORAGE_KEY);
        } catch {
            /* ignore */
        }
    }

    function save(snapshot) {
        const store = storage();
        if (!store || !snapshot || typeof snapshot.state !== "string") {
            return;
        }
        const payload = Object.assign({ v: SNAPSHOT_VERSION, savedAt: Date.now() }, snapshot);
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
            /* Resume is best effort; quota or private mode must not break play. */
        }
    }

    function isUsable(snapshot) {
        if (!snapshot || snapshot.v !== SNAPSHOT_VERSION) {
            return false;
        }
        if (typeof snapshot.state !== "string" || !snapshot.state) {
            return false;
        }
        if (!Array.isArray(snapshot.moves)) {
            return false;
        }
        try {
            const state = JSON.parse(snapshot.state);
            return !!(state && Array.isArray(state.board) && state.board.length > 0);
        } catch {
            return false;
        }
    }

    function load() {
        const store = storage();
        if (!store) {
            return null;
        }
        let raw = null;
        try {
            raw = store.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
        if (!raw) {
            return null;
        }
        let parsed = null;
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = null;
        }
        if (!isUsable(parsed)) {
            clear();
            return null;
        }
        return parsed;
    }

    window.DesktopPlayResume = {
        save: save,
        load: load,
        clear: clear,
    };
})();
