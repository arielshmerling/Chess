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
| 3 | Practice / Debug | yes | `/play?mode=practice` (Admin/Partner Prefer-Play) or classic `/game?gameType=3` |
| 4 | Review | no (mode) | `/play?mode=review` (Prefer-Play) or classic `/review`, `/mobile-review`; shell also has bookmark review |
| 5 | Research | no (legacy) | removed from home; setup lives in Play shell |

## Web entry points (inventory)

| Entry | Typical URL / trigger | Today lands on |
|-------|----------------------|----------------|
| Play Now (AI) | `/play?newGame=1` | Play shell + New Game dialog |
| Resume AI | `/play` + sessionStorage snapshot | Play shell |
| Friend invite (create) | friends API → open game | `/play?id=` (Play UI) or `/game?id=` |
| Friend invite (join) | `/game?gameType=2&joinGame=` then redirect | `/play?id=` (Play UI) or classic `/game` |
| Active game reopen | `/play?id=` or `/game?id=` | Play shell OnlineMode or classic |
| Debug | `/play?mode=practice` (Prefer-Play Admin/Partner) or `/game?gameType=3` | PracticeMode on Play shell, or classic `/game` |
| Review | `/review?id=` → Prefer-Play redirects to `/play?mode=review&id=&type=` | Play shell ReviewMode; classic `game.ejs` / mobile-review fallback |
| Watch | `/watch?id=` → Prefer-Play redirects to `/play?id=&mode=watch` | Play shell (watch) or classic `game.ejs` |
| Desktop Electron | `/app/play` | Play shell (local SP) |

**Phase 3 (done for core):** online invite/join/`?id=` for Play UI users → `/play` with `OnlineMode` + `WsTransport`. Classic `/game` remains.

**Phase 4 (done):** draw / rematch (with color) / reconnect countdown on `/play`.

**Phase 5 (done for Prefer-Play desktop web):** live watch + history/PGN review on `/play`.

**Phase 6 (done for Prefer-Play):** Practice / Debug on `/play` (`PracticeMode`).

**Phase 7 (done):** Position Setup + Configuration as session modes; refuse online/watch leak.

**Phase 8 (review + mobile SP + mobile online participants):**  
`/mobile-review` → `ReviewMode`. `/mobile-game` SP (`clientEngine`) → `LocalEngineMode`.  
`/mobile-game` OnlineGame participants → `OnlineMode` (MatchTransport; classic WS deferred).  
Watch on mobile still classic.

**Phase 9 (in progress):** brain transport via `src/adapters` (`brainHttp` / `brainIpc` / `createEnginePort`); session core stays fetch-free.

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

## Phase 4 OnlineMode extensions

- Draw: `offer draw` / `draw accepted` / `draw declined` (offer only after you have moved, on opponent’s turn).  
- Rematch: `offer rematch` / accept → new `gameId` → `POST /rematch` + reload online game on `/play`.  
- Disconnect: 1s grace, then 60s status countdown; on expiry sync `/gameInfo` (cancel or forfeit).  
Still deferred: chat, watchers on `/play`.
