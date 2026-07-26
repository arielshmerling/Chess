/**
 * Session layer contracts (Phase 0).
 *
 * These typedefs are the seam between platform shells (web / desktop / later mobile)
 * and mode plugins. UI must not talk to WebSocket or ChessGame directly once Phase 2+
 * is complete; it issues SessionCommands and listens for SessionEvents.
 *
 * Runtime: documentation + shared constants only. No orchestration yet.
 *
 * @module session/contracts
 */

"use strict";

/**
 * Stable mode ids (prefer these over constructor names / magic numbers in new code).
 * @readonly
 * @enum {string}
 */
const MODE_IDS = Object.freeze({
    LOCAL_ENGINE: "localEngine",
    ONLINE: "online",
    PRACTICE: "practice",
    REVIEW: "review",
    WATCH: "watch",
    POSITION_SETUP: "positionSetup",
});

/**
 * Capability flags a mode exposes to the shell (action rail, dialogs, panels).
 * @typedef {object} ModeCapabilities
 * @property {boolean} undo
 * @property {boolean} redo
 * @property {boolean} resign
 * @property {boolean} draw
 * @property {boolean} rematch
 * @property {boolean} engine
 * @property {boolean} network
 * @property {boolean} reviewNav
 * @property {boolean} positionSetup
 * @property {boolean} watchers
 * @property {boolean} chat
 */

/**
 * Commands the shell may invoke on GameSession (UI → session).
 * Implementations live in later phases; this is the contract surface.
 *
 * @typedef {object} SessionCommands
 * @property {(options: object) => Promise<void>|void} start
 * @property {(gameId: string) => Promise<void>|void} load
 * @property {(gameId: string) => Promise<void>|void} join
 * @property {(move: object) => Promise<void>|void} playMove
 * @property {(piece: *) => Promise<void>|void} selectPromotion
 * @property {() => Promise<void>|void} resign
 * @property {() => Promise<void>|void} offerDraw
 * @property {() => Promise<void>|void} acceptDraw
 * @property {() => Promise<void>|void} declineDraw
 * @property {() => Promise<void>|void} offerRematch
 * @property {() => Promise<void>|void} acceptRematch
 * @property {() => Promise<void>|void} declineRematch
 * @property {() => Promise<void>|void} undo
 * @property {() => Promise<void>|void} redo
 * @property {() => void} flipBoard
 * @property {() => Promise<void>|void} leave
 */

/**
 * Events the session emits toward the shell (session → UI).
 * Shells subscribe; they must not assume engine or WS details.
 *
 * @typedef {object} SessionEvents
 * @property {(state: object) => void} [boardChanged]
 * @property {(move: object, meta?: object) => void} [moveApplied]
 * @property {({ white: number, black: number }) => void} [clocksUpdated]
 * @property {(side: "white"|"black") => void} [turnChanged]
 * @property {(status: string) => void} [statusChanged]
 * @property {(result: object) => void} [gameOver]
 * @property {(payload?: object) => void} [opponentDisconnected]
 * @property {(payload?: object) => void} [opponentRejoined]
 * @property {(payload?: object) => void} [drawOffered]
 * @property {(message: string, kind?: string) => void} [info]
 * @property {(message: string) => void} [error]
 * @property {(caps: ModeCapabilities) => void} [capabilitiesChanged]
 */

/**
 * Mode plugin contract. One cohesive module per game mode.
 *
 * @typedef {object} GameMode
 * @property {string} id - One of MODE_IDS values
 * @property {() => ModeCapabilities} capabilities
 * @property {(session: object) => void} attach
 * @property {() => void} detach
 */

/**
 * Transport port for networked modes (web today; desktop later).
 * Implementations: browser WebSocket, future Electron bridge, etc.
 *
 * @typedef {object} MatchTransport
 * @property {(url: string) => void} connect
 * @property {() => void} close
 * @property {(message: object) => void} send
 * @property {(handler: (message: object) => void) => void} onMessage
 * @property {(handler: () => void) => void} [onClose]
 * @property {(handler: (err: Error) => void) => void} [onError]
 */

/**
 * Engine port (HTTP on web Play, IPC on Electron).
 *
 * @typedef {object} EnginePort
 * @property {(request: object) => Promise<object>} computeMove
 * @property {(request: object) => Promise<object>} [evaluatePosition]
 * @property {() => Promise<void>|void} [abortSearch]
 */

module.exports = {
    MODE_IDS,
};
