/**
 * Characterization notes for game transports and entry points.
 * Source of truth for Phase 0; keep in sync when protocol changes.
 */

# Protocol & entry points

## Game type numbers (`gamesManager.GameTypes`)

| Id | Name | Factory? | Primary UI today |
|----|------|----------|------------------|
| 1 | AI / SinglePlayer | yes | `/play` (shell) or classic `/game` |
| 2 | Online | yes | `/play` (Play UI users) or classic `/game` |
| 3 | Practice / Debug | yes | classic `/game` (Admin/Partner) |
| 4 | Review | no (mode) | classic `/review`, `/mobile-review`; shell has bookmark review |
| 5 | Research | no (legacy) | removed from home; setup lives in Play shell |

## Web entry points (inventory)

| Entry | Typical URL / trigger | Today lands on |
|-------|----------------------|----------------|
| Play Now (AI) | `/play?newGame=1` | Play shell + New Game dialog |
| Resume AI | `/play` + sessionStorage snapshot | Play shell |
| Friend invite (create) | friends API → open game | `/play?id=` (Play UI) or `/game?id=` |
| Friend invite (join) | `/game?gameType=2&joinGame=` then redirect | `/play?id=` (Play UI) or classic `/game` |
| Active game reopen | `/play?id=` or `/game?id=` | Play shell OnlineMode or classic |
| Debug | `/game?gameType=3` | classic `/game` |
| Review | `/review?id=` | classic `game.ejs` / mobile-review |
| Watch | `/watch?id=` | classic `game.ejs` |
| Desktop Electron | `/app/play` | Play shell (local SP) |

**Phase 3 (done for core):** online invite/join/`?id=` for Play UI users → `/play` with `OnlineMode` + `WsTransport`. Classic `/game` remains. Draw/rematch/chat/watch stay Phase 4.

## WebSocket app channel (`app.ws("/ws")`)

### App-level (before game init)

| Client → server | Effect |
|-----------------|--------|
| `{ type: "connection", data: { gameId, userId, … } }` | `game.init(ws, userId)` |
| `{ type: "watch", data: { gameId, username } }` | `addWatcher` |
| `{ type: "subscribeLobby" }` | lobby fanout |
| `{ type: "presenceSubscribe" }` | friend presence |

### Game messages (after init) — validated by `validateWebSocketMessage`

| `type` | `info` / payload | Notes |
|--------|------------------|-------|
| `move` | `data` move object, `isWhite`, `gameId`, `username` | Server validates; Online may flip for black **player view** |
| `info` | `chat` | Max 2000 chars |
| `info` | `outOfTime` | `loser`: white\|black |
| `info` | `clockSync` | whiteTimer, blackTimer |
| `info` | `game over` | Terminal notice |
| `info` | `move accepted` | Clocks + moveTime (SP brain path) |
| `info` | `resign`, `offer draw`, `draw accepted`, `draw declined` | Online / SP handlers differ |
| `info` | `offer rematch`, `rematch accepted`, `rematch declined` | |
| `cmd` | `undo`, `redo` | Classic SP / research-ish |
| `cmd` | `setState` | Full game state (SP) |

Server also emits non-schema informal infos used by clients, e.g.:

- `move validated successfully` / `move validation failed`
- `opponent joined` / `Opponent disconnected` / `opponent rejoined`
- `Opponent resigned` / `Opponent failed to reconnect`
- `Game cancelled`

## Online draw offer rules (`OnlineGameMessageProcessor.drawOfferForward`)

- Rejected if game is `game over` or `cancelled`.
- White may offer only after ≥1 move and **not** on white’s turn.
- Black may offer only after ≥2 moves and **not** on black’s turn.
- Otherwise forwarded to opponent (+ watchers).

## Coordinate caveat (rewrite seam)

Classic online path: black **player view** may send/receive flipped moves (`GameBase` / `flipMove`).  
Play shell OnlineMode uses the same player-view convention as classic (`WhitePlayerView === humanIsWhite`), so the wire protocol stays compatible without a server change.  
A future canonical-on-the-wire migration can still flip only at the transport adapter.

## Play shell single-player (no WS)

1. Local `ChessGame` in the browser/renderer.  
2. Human move → update board/clocks/moves table.  
3. Engine via `DesktopEngine` → HTTP `/api/brain/compute-move` (web) or IPC (Electron).  
4. Resume snapshot: `sessionStorage` key `shmerling.play.activeGame` (web).  
5. **Do not edit `ChessGame.js`.**

## Desktop future online

Adapters must be injectable (`WsTransport` + auth/session to remote DB).  
Do not hard-code “desktop = local only” into `GameSession` — only into the current default mode wiring.

## Phase 3 OnlineMode (Play shell)

Modules: `onlineProtocol.js`, `wsTransport.js`, `onlineMode.js`.  
Shell: `/play?id=` loads `/gameInfo` + `/gameMoves`, attaches OnlineMode, connects `/ws`.  
Resign with zero moves → `POST /cancel-before-move`. Otherwise WS `info: resign`.  
Opponent move → animate + `playMove(..., { source: "network" })` (no echo).  
Deferred to Phase 4: draw offers, rematch, chat, watchers UI, reconnect forfeit countdown.
