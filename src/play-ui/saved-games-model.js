/**
 * Saved games and saved positions: reading, classifying, and labelling the
 * entries the sidebar shows.
 *
 * Pure data helpers — no DOM, no storage. Entries come from the bookmark API,
 * where moves may be JSON strings and the board state may be a string or an
 * object depending on how the entry was written.
 */
(function (global) {
    "use strict";

    const UNKNOWN_PLAYERS = { white: "White", black: "Black" };
    const DEFAULT_ENGINE_NAME = "Engine";
    const DEFAULT_ENGINE_ID = "brain43";

    /**
     * @param {object} entry
     * @returns {string} Bookmark id, or "" when the entry has none.
     */
    function entryId(entry) {
        return entry && (entry._id || entry.id) ? String(entry._id || entry.id) : "";
    }

    /**
     * @param {object} entry
     * @returns {Array<object>} Moves as objects; unparsable entries yield [].
     */
    function parseMoves(entry) {
        if (!entry || !Array.isArray(entry.moves)) {
            return [];
        }
        return entry.moves.map(function (m) {
            return typeof m === "string" ? JSON.parse(m) : m;
        });
    }

    /** A saved position is an entry with no moves. */
    function isPosition(entry) {
        return parseMoves(entry).length === 0;
    }

    function isGame(entry) {
        return !isPosition(entry);
    }

    /**
     * @param {Array<object>} entries
     * @param {"games"|"positions"} filter - Anything other than "positions" means games.
     * @returns {Array<object>}
     */
    function filterEntries(entries, filter) {
        const positionsOnly = filter === "positions";
        return (entries || []).filter(function (entry) {
            return positionsOnly ? isPosition(entry) : isGame(entry);
        });
    }

    /**
     * @param {Date|string|number} date
     * @returns {string} Localised date and time, or "" when unusable.
     */
    function formatDate(date) {
        if (!date) {
            return "";
        }
        const d = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(d.getTime())) {
            return "";
        }
        return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    }

    /**
     * @param {object} entry
     * @returns {object|null} Board state, from either `state` or the older `gameState`.
     */
    function stateFromEntry(entry) {
        if (!entry) {
            return null;
        }
        const raw = entry.state != null ? entry.state : entry.gameState;
        if (raw == null) {
            return null;
        }
        if (typeof raw === "string") {
            try {
                return JSON.parse(raw);
            } catch {
                return null;
            }
        }
        if (typeof raw === "object") {
            return raw;
        }
        return null;
    }

    /**
     * @param {object} entry
     * @returns {"white"|"black"|null}
     */
    function turnFromEntry(entry) {
        const state = stateFromEntry(entry);
        if (!state || (state.turn !== "white" && state.turn !== "black")) {
            return null;
        }
        return state.turn;
    }

    function formatTurn(entry) {
        const turn = turnFromEntry(entry);
        if (!turn) {
            return "Next move: —";
        }
        return "Next move: " + (turn === "white" ? "White" : "Black");
    }

    /**
     * Player names for an entry. Older entries stored no names, so those fall back
     * to "Player" against the engine the game was played with.
     *
     * @param {object} entry
     * @param {(engineId: string) => string} [engineLabel]
     * @returns {{ white: string, black: string }}
     */
    function resolvePlayers(entry, engineLabel) {
        if (!entry) {
            return Object.assign({}, UNKNOWN_PLAYERS);
        }
        if (entry.whitePlayerName && entry.blackPlayerName) {
            return { white: entry.whitePlayerName, black: entry.blackPlayerName };
        }
        const engineName =
            typeof engineLabel === "function"
                ? engineLabel(entry.engine || DEFAULT_ENGINE_ID)
                : DEFAULT_ENGINE_NAME;
        return { white: "Player", black: engineName };
    }

    function formatPlayers(entry, engineLabel) {
        const names = resolvePlayers(entry, engineLabel);
        return names.white + " vs. " + names.black;
    }

    /**
     * Multi-line tooltip: when it was saved, who played, and the id.
     * @param {object} entry
     * @param {(engineId: string) => string} [engineLabel]
     * @returns {string}
     */
    function formatInfoTooltip(entry, engineLabel) {
        const parts = [];
        const when = formatDate(entry && entry.date);
        if (when) {
            parts.push("Saved: " + when);
        }
        const players = formatPlayers(entry, engineLabel);
        if (players) {
            parts.push(players);
        }
        const id = entryId(entry);
        if (id) {
            parts.push("Game ID: " + id);
        }
        return parts.join("\n");
    }

    const SavedGamesModel = {
        entryId: entryId,
        parseMoves: parseMoves,
        isPosition: isPosition,
        isGame: isGame,
        filterEntries: filterEntries,
        formatDate: formatDate,
        stateFromEntry: stateFromEntry,
        turnFromEntry: turnFromEntry,
        formatTurn: formatTurn,
        resolvePlayers: resolvePlayers,
        formatPlayers: formatPlayers,
        formatInfoTooltip: formatInfoTooltip,
    };

    global.PlaySavedGamesModel = SavedGamesModel;

    /* Node (unit tests) — browsers load this file as a plain script. */
    if (typeof module === "object" && module && module.exports) {
        module.exports = SavedGamesModel;
    }
})(typeof window !== "undefined" ? window : globalThis);
