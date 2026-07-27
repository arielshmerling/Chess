# Manual QA: Shmerling Play UI (Phase 1–3)

**Product surface:** Web `/play` and Desktop Electron Play shell (shared UI).  
**Scope:** Phase 1–2 = single-player vs local Brain. Phase 3 = OnlineMode on `/play` (core play). Classic `/game` remains as fallback.  
**Last updated:** 2026-07-26 (Phase 3 OnlineMode on `/play`)

Use this document as the living checklist. Add Phase 4+ sections at the bottom without rewriting earlier phases.

---

## How to use this checklist

1. **Restart the app/server** before a full pass (`npm start` for web; restart Electron for desktop).
2. **Hard-refresh** the Play page (Cmd+Shift+R / Ctrl+Shift+R) so scripts and CSS reload.
3. For each test: follow **Steps**, then mark **Pass** only if every **Expect** item is true.
4. Record failures with: test id, role (Admin/Partner/Member), browser or Electron, and a short note.
5. Prefer a clean profile or known test users (`e2e_web_member`, `e2e_web_partner`, Admin) when roles matter.

### Roles (quick reference)

| Capability | Admin | Partner | Member |
|---|---|---|---|
| New Play UI (`/play`) | Yes | Yes | Yes |
| Position setup | Yes | Yes | Hidden |
| Brain config panel | Yes | Yes | Hidden |
| Saved games / review sidebar | Yes | Yes | Typically limited / hidden tools |
| Admin menu | Yes | No | No |
| Debug (classic `/game`) | Yes | Yes | No |

---

## Pre-flight

### P0 — Environment ready

**Steps**
1. Confirm MongoDB is running (local or configured remote).
2. Start the web server (`npm start`) or open the desktop app.
3. Log in as the role you intend to test.
4. Open `/play` (web) or the desktop Play window.
5. Hard-refresh once.

**Expect**
- Play shell loads (board frame, action rail, header clocks area).
- No blank screen or console errors that block interaction.
- Idle status invites starting a new game (or similar).

### P1 — Hard refresh after code changes

**Steps**
1. After pulling or receiving Play/session changes, restart the server.
2. Hard-refresh `/play`.

**Expect**
- New session scripts load (`/app/session/*.js`, `/app/play-ui/*.js`).
- No stale cached `desktop-play.js`.

---

## Phase 1 — Play shell modules (feature parity)

Phase 1 carved presentation/policy into `src/play-ui/*` without changing product behavior. These tests confirm the shell still works as a whole.

### 1.1 — New game as White (Play Now / New game)

**Steps**
1. From Home, use **Play Now**, or on `/play` open **New game**.
2. Choose color **White**, engine **Brain 4.3** (or default), allow undo on, a comfortable thinking time (e.g. 5–10s).
3. Start the game.

**Expect**
- Board appears from White’s view (White at bottom).
- Header shows your username vs the Brain label (not a generic “Player” if you are logged in).
- Clocks show; White’s clock is the side to move / running (or ready to run).
- **Resign** enabled on your turn; **Draw** disabled vs engine.
- Status indicates it is your move (or equivalent).

### 1.2 — New game as Black

**Steps**
1. Start a new game as **Black**.
2. Wait for the engine’s first move.

**Expect**
- Board flipped (Black at bottom) if that is the product default for playing Black.
- Engine moves first with animation.
- After the engine move, it is your turn; clocks switch appropriately.
- Header names still correct (you as Black, Brain as White).

### 1.3 — Engine selection persists (Brain 4.2 / 4.3)

**Steps**
1. Start a game with **Brain 4.2**.
2. Finish or leave.
3. Open New game again (or Play Now).

**Expect**
- Engine choice remains **Brain 4.2** (or the last explicit choice), not silently reset to an old default without reason.
- Starting again with **Brain 4.3** then sticks on the next open.

### 1.4 — Drag move (mouse drag preference)

**Steps**
1. Preferences → Mouse control → **Drag**.
2. Start a game as White.
3. Drag a pawn e2→e4.

**Expect**
- Move is applied on the board.
- Moves panel shows the ply.
- Clocks switch after your move.
- Engine replies (animation + move in the list).

### 1.5 — Double-click / click-to-move preference

**Steps**
1. Preferences → Mouse control → **Double-click** (or click-to-move mode as labeled).
2. Start a game as White.
3. Select a piece, then the target square, to play e2–e4.

**Expect**
- Legal targets highlight when configured.
- Move records the same as drag mode.
- Illegal clicks do not corrupt the board.

### 1.6 — Show available moves toggle

**Steps**
1. Preferences → enable **Show available moves**.
2. In a game, select a piece (click-to-move) or begin a drag as applicable.
3. Disable the preference and try again.

**Expect**
- With it on: legal destination hints appear.
- With it off: hints do not appear (or match product rule).

### 1.7 — Thinking time preference

**Steps**
1. Preferences → set thinking time to a low value (e.g. 2s).
2. Play a move and wait for the engine.
3. Increase to a higher value and play another game.

**Expect**
- Engine search duration roughly tracks the preference (not stuck on a hard-coded old value).
- Preference survives refresh.

### 1.8 — Clocks count down for side to move

**Steps**
1. Start a game with a long game clock (e.g. 90 minutes) if configurable.
2. On your turn, watch the active clock for several seconds.
3. Make a move; watch the opponent/engine clock while the engine thinks / after turn switch.

**Expect**
- Only the side to move’s clock decreases.
- After a move, the other side’s clock becomes active.
- Clocks stop when the game ends.

### 1.9 — Flip board

**Steps**
1. During an active game, click **Flip**.
2. Flip again.

**Expect**
- Board orientation reverses (files/ranks and piece placement).
- You can still move your pieces on your turn.
- Flip does not change whose turn it is.

### 1.10 — Last move arrow

**Steps**
1. Play at least one move (and optionally wait for the engine reply).
2. Click **Last move**.
3. Click again to toggle off if that is the behavior.

**Expect**
- An arrow (or last-move highlight) appears for the last ply.
- Toggle clears it without breaking input.

### 1.11 — Moves panel updates

**Steps**
1. Play several plies (you + engine).
2. Scroll the moves list if needed.

**Expect**
- Moves appear in order with sane notation.
- List stays in sync after undo/redo (see Phase 2 tests).
- No duplicate rows for a single ply.

### 1.12 — Action rail enable/disable (idle vs active)

**Steps**
1. On idle Play (no active game): observe Resign / Undo / Redo / Draw / Flip.
2. Start a game: observe again on your turn, while the engine thinks, and after game over.

**Expect**
- Idle: play actions locked as designed; New game available.
- Active your turn: Resign on; Draw off vs engine; Undo/Redo follow allow-undo and history.
- While engine thinks / animating: destructive actions disabled.
- After game over: Resign off; New game still usable.

### 1.13 — Preferences / themes / piece set (smoke)

**Steps**
1. Open Preferences from the Play chrome / account menu.
2. Change piece set or theme if available.
3. Close preferences and confirm the board still plays.

**Expect**
- UI updates without breaking Play.
- Game can still be started and moves played.

### 1.14 — Keyboard shortcuts (smoke)

**Steps**
1. On `/play`, try documented shortcuts (e.g. F2 for new-game related flow if enabled; Cmd/Ctrl+E evaluation if Partner/Admin).
2. Focus a text field (rename saved game if available) and press the same keys.

**Expect**
- Shortcuts work when not typing in an input.
- Shortcuts are ignored (or safely no-op) while typing in inputs.

### 1.15 — Evaluation display (Partner/Admin)

**Steps**
1. As Partner or Admin, start or load a position.
2. Trigger evaluation (Cmd/Ctrl+E or UI control).
3. Click away / dismiss if applicable.

**Expect**
- Evaluation appears in the status/UI without freezing the board.
- Dismiss clears overlay/title as designed.

### 1.16 — Setup vs Config mutual exclusion (Partner/Admin)

**Steps**
1. Open **Position setup**.
2. Observe the **Config** control.
3. Exit setup; open **Config**.
4. Observe **Position setup**.

**Expect**
- Only one of Setup/Config is active at a time.
- While one is open, the other control is disabled (cannot click-switch without exiting).
- Exiting restores normal idle/play chrome.

### 1.17 — Member cannot see Setup / Config

**Steps**
1. Log in as **Member**.
2. Open `/play`.

**Expect**
- Position setup and Brain config entry points are hidden or unavailable.
- New game vs Brain still works.

---

## Phase 1 — Position setup (Partner/Admin)

### 1.18 — Enter position setup from menu

**Steps**
1. From idle Play, open **Position setup**.
2. Clear / place pieces using the setup UI (drag on board / palette as designed).

**Expect**
- Setup mode chrome appears.
- Human play on a live game is off.
- Status indicates setup (not a finished game).

### 1.19 — Setup draw status clears when material becomes sufficient

**Steps**
1. In setup, leave only two kings (insufficient material).
2. Confirm status shows a draw / insufficient material message and kings may show draw highlight.
3. Add a queen (or other piece) so material is sufficient.

**Expect**
- Draw highlights clear from the board.
- **Status line clears** the draw text (returns to setup guidance), not a stuck “Draw — Insufficient material”.

### 1.20 — Validate and play from setup

**Steps**
1. Set a legal middlegame-like position (both kings, sensible pieces).
2. Set side to move / human color via the game-run options if shown.
3. Start **Play** from the position.

**Expect**
- Invalid positions are rejected with a clear alert (not a silent failure).
- Valid positions start an active game with clocks and correct turn.
- Engine moves if it is the AI’s turn.

### 1.21 — Setup and Config do not both stay open

**Steps**
1. Enter setup, then attempt to open config (or the reverse).

**Expect**
- Mutual exclusion holds (see 1.16).

---

## Phase 1 — Brain config (Partner/Admin)

### 1.22 — Open config, change a value, play

**Steps**
1. Open **Config** (brain config panel).
2. Change a visible non-destructive setting if available; save/apply if required.
3. Close config; start a short game.

**Expect**
- Panel opens and closes cleanly.
- Play still works afterward.
- No leftover dialog lock (`dialogOn`) that blocks moves.

---

## Phase 1 — Saved games & review (Partner/Admin)

### 1.23 — Auto-save / manual save after a game

**Steps**
1. Play a few moves; resign or finish.
2. Check the saved games / positions list (Games sidebar).

**Expect**
- A bookmark appears (auto and/or after Save), with a sensible name.
- List can expand to show details.

### 1.24 — Load saved game into review

**Steps**
1. Click a saved game with moves to load it.
2. Confirm review navigation appears (Start / Back / Forward / End / Play).

**Expect**
- Board shows the final (or loaded) position.
- Review nav is visible when moves exist.
- Human play is disabled in review.

### 1.25 — Review Start / Forward / Back / End

**Steps**
1. With a multi-move saved game loaded, click **Start** (ply 0).
2. Click **Forward** several times.
3. Click **Back**.
4. Click **End**.

**Expect**
- Board and moves selection track the ply.
- No engine search starts during review navigation.
- Playback Play/Pause advances without crashing; Stop works.

### 1.26 — Review move-list click to ply

**Steps**
1. In review, click a move in the moves panel.

**Expect**
- Board jumps to that ply.
- Nav buttons update enabled/disabled state.

### 1.27 — Load from start (double-click behavior if present)

**Steps**
1. Double-click a saved game (or use the documented “load from start” affordance).

**Expect**
- Review opens at the start position when that feature exists.
- Forward still replays correctly.

### 1.28 — Edit saved position → setup

**Steps**
1. Use **Edit** on a saved position/game (Partner/Admin).
2. Confirm you enter position setup with that board.
3. Cancel or save as product allows.

**Expect**
- Review mode exits.
- Setup opens with the expected pieces.
- Leaving edit does not leave a half-active game session.

### 1.29 — Delete saved game

**Steps**
1. Delete one bookmark (and multi-select delete if available).
2. Confirm list refresh.

**Expect**
- Item removed.
- Status confirms deletion.
- Board is not left in a broken review state.

### 1.30 — Exit review into new game

**Steps**
1. Load a review.
2. Start **New game**.

**Expect**
- Review chrome clears.
- Fresh game starts; engine and clocks work.
- No stuck review nav bar.

---

## Phase 2 — GameSession / LocalEngineMode (ports-clean active play)

Phase 2 routes active single-player through `GameSession` + `LocalEngineMode` (commands/events). Tests below stress that path.

### 2.1 — Human move → session → engine reply

**Steps**
1. New game as White.
2. Play e2–e4.
3. Wait for the engine.

**Expect**
- Your move appears immediately (board + moves list).
- After paint, clocks switch; engine thinks; reply animates.
- No double status flashes for the same event.
- No second illegal “ghost” engine move.

### 2.2 — Username in header (not “Player”)

**Steps**
1. Log in with a real username.
2. Start a game as White and as Black.

**Expect**
- Header uses your username on your side.
- Brain label on the engine side.
- Refresh mid-game still shows the username (see 2.10).

### 2.3 — Draw button disabled vs engine (capabilities)

**Steps**
1. During an active engine game on your turn, inspect **Draw**.
2. If it is somehow clickable, click it.

**Expect**
- Draw is disabled for local engine mode.
- If clicked via forced enable, user is told draw offers are unavailable vs engine (legacy alert path).

### 2.4 — Resign (human)

**Steps**
1. Play at least one move.
2. Click **Resign** and confirm.

**Expect**
- Status: game over / you resigned (wording may vary).
- **Resigning king**: red square background and **90° rotation**.
- Clocks stop; Resign disables; moves list may show result.
- No duplicate conflicting status lines.

### 2.5 — Leave / Home mid-game resigns after you have moved

**Steps**
1. Play at least one move as White (or two plies if needed for Black).
2. Click Home / Leave.
3. Confirm the resign dialog if shown.

**Expect**
- Dialog explains the game will be resigned when applicable.
- After confirm, game is resigned and you leave Play (or return home).
- Leaving with no human moves may skip resign (product rule).

### 2.6 — Undo / Redo pair

**Steps**
1. New game with **allow undo** on.
2. Play a move; wait for engine reply (full pair).
3. **Undo**.
4. **Redo**.

**Expect**
- Undo removes your move and the engine reply (pair).
- Board, moves list, and clocks match the restored position.
- Redo restores the pair once; further redo stays disabled until another undo.
- Undo disabled while engine is thinking.

### 2.7 — Promotion (human)

**Steps**
1. Set up or play to a position where you can promote (setup→play is fine).
2. Move the pawn to the 8th rank.
3. Choose a piece in the promotion dialog (e.g. Queen).

**Expect**
- Promotion chooser appears only for you (not for the engine side).
- After choice, board shows the piece; moves list updates.
- Engine replies if it is the AI turn.
- No stuck “Choose promotion piece” status.

### 2.8 — Check indication

**Steps**
1. Play (or set up) a position that delivers check without mate.
2. Observe status and king highlight.

**Expect**
- Brief check status (or equivalent).
- Checked king highlighted (gold/check style — not resign red).
- Game continues.

### 2.9 — Checkmate / draw terminal outcomes

**Steps**
1. Deliver checkmate (setup a mate-in-one and play it), **or** reach a clear draw (stalemate / insufficient material from play/setup→play).
2. Observe status, highlights, clocks, and action rail.

**Expect**
- **One** clear terminal status (not double stacked messages).
- Checkmate: mated king red/checkmate style; clocks stop.
- Draw: draw status + draw king highlights as designed.
- Resign disabled; New game available.
- No engine search after the game is over.

### 2.10 — Refresh resumes in-progress game (web)

**Steps**
1. Start a game; play a few moves.
2. Hard-refresh `/play` (or reload).

**Expect**
- Position, moves, clocks, and turn restore.
- Username still correct.
- You can continue; engine still replies on its turn.

### 2.11 — Play from custom position (session attached)

**Steps**
1. Position setup → legal position with **engine to move** (human Black or White to move for engine).
2. Start play.
3. If engine to move, wait; if you to move, play one move.

**Expect**
- Session is active (undo/resign behave; engine runs when appropriate).
- No “stuck idle” where moves don’t trigger the brain.

### 2.12 — Immediate resign (Brain resigns when lost)

**Preconditions:** Preferences → **Immediate resign** enabled; confirm it stays checked after refresh.

**Steps**
1. Enable Immediate resign; hard-refresh; confirm still checked.
2. Reach a position where the Brain is clearly lost / forced mate (use setup→play if needed so it is the engine’s turn in a lost position), **or** play until the engine detects forced loss.
3. Wait for the engine’s turn to resolve.

**Expect**
- Engine **resigns** instead of playing on (when detection fires).
- Status line reports resignation / game over.
- **Visual:** resigning king has **red background** and **90° tilt** (not only the status text).
- Clocks stop; no further engine moves.

### 2.13 — Immediate resign off

**Steps**
1. Disable Immediate resign.
2. Use a similar lost position for the engine.

**Expect**
- Engine still plays a move (may be a losing move) rather than auto-resigning, unless another rule ends the game.

### 2.14 — Browser context menu suppressed on Play

**Steps**
1. On `/play`, right-click the board, empty chrome, and header.
2. Right-click a saved game (Partner/Admin) if the custom menu exists.

**Expect**
- Native browser menu (Back / Reload / Ask Gemini / etc.) does **not** appear on Play.
- Custom app menus (e.g. saved-game context menu) still work when provided.

### 2.15 — Review mode attach/detach does not break next game

**Steps**
1. Load a saved game into review (Partner/Admin).
2. Navigate plies.
3. Start a new engine game.

**Expect**
- Review mode ends cleanly.
- New game engine turns work (session LocalEngineMode re-attached).
- No “engine never moves” regression.

### 2.16 — Out-of-time (if easy to reproduce)

**Steps**
1. If you can set a very short game time, start a game and let a side flag.
2. Otherwise skip and note “not run”.

**Expect**
- Timeout status; clocks stopped; game over.
- Single timeout message (session-driven).

---

## Cross-cutting regression matrix

Run these after any large Play/session change:

| Area | Quick probe |
|---|---|
| New game W/B | 1.1, 1.2 |
| Move + engine | 2.1 |
| Undo/redo | 2.6 |
| Resign visual | 2.4, 2.12 |
| Refresh resume | 2.10 |
| Setup → play | 1.20, 2.11 |
| Review → new game | 1.25, 2.15 |
| Member restrictions | 1.17 |
| Context menu | 2.14 |
| Online invite / moves | 3.1–3.4 |
| Online resign / cancel | 3.5–3.6 |
| Online refresh / classic | 3.7, 3.9 |

---

## Phase 3 — OnlineMode on `/play`

**Prerequisites:** Two logged-in users (e.g. Member A and Member B) in two browsers or profiles. Friends of each other. Server restarted; hard-refresh `/play`.

**Out of scope for Phase 3 (expect deferred / disabled):** draw offers, rematch, chat, watchers on `/play`, reconnect forfeit countdown UI.

### 3.1 — Invite lands both players on `/play`

**Steps**
1. As user A, open Friends and invite user B to a game.
2. As user B, accept the invite.
3. As user A, wait for the accepted / establishing flow to finish.

**Expect**
- Both browsers navigate to a URL under `/play?id=…` (not classic `/game?id=`).
- Play shell loads (board, clocks, action rail, player names).
- User A is White; user B is Black (board orientation matches).

### 3.2 — Waiting for opponent (White)

**Steps**
1. As user A, send an invite and stay on the game page before B accepts (or use a flow where White is alone briefly).
2. Observe status / black player name while waiting.
3. Have B accept and join.

**Expect**
- While waiting: status like “Waiting for opponent…”; black name shows looking-for-opponent (or empty) until join.
- When B joins: black name updates to B’s username; status clears to a normal play hint.
- Resign is available once the opponent is present (or per product rules after join).

### 3.3 — Moves both directions

**Steps**
1. With both players connected on `/play?id=…`, as White play `e2–e4` (or any legal first move).
2. As Black, confirm the move appears animated and play a reply.
3. Continue for at least 3–4 half-moves each.

**Expect**
- Each side sees the opponent’s move animate onto the board.
- Moves table updates for both players.
- No “double move” / echo (your own move does not fire a second time from the network).
- Illegal moves are rejected locally (piece does not stick on an illegal square).

### 3.4 — Server clocks

**Steps**
1. During an online game on `/play`, watch both clocks for a full move cycle (White moves, Black moves).
2. Optionally refresh mid-game (see 3.7) and compare clock values look sane (not reset to full unless game is new).

**Expect**
- Side to move’s clock counts down.
- After a move, clocks switch sides.
- After the opponent’s move, your remaining time looks consistent with play (server-driven timers / moveTime).

### 3.5 — Cancel before the first move

**Steps**
1. Start a fresh online game (invite accepted, **0 moves** played).
2. As either player, use **Resign** or **Home** leave while still at move 0.
3. Observe the other player (if still connected).

**Expect**
- Game cancels (status “Game cancelled” or equivalent).
- No resign result / red king required for a zero-move cancel.
- Opponent is notified or lands in a cancelled / ended state (not stuck waiting forever).

### 3.6 — Resign after moves

**Steps**
1. Play at least one move in an online `/play` game.
2. As one player, resign (confirm dialog if shown).
3. Observe both clients.

**Expect**
- Game ends; status indicates resign / winner.
- Resigned king shows red square + 90° tilt (same visual as SP resign).
- Opponent sees “Opponent resigned” (or equivalent) and the same terminal board.
- Draw / rematch remain unavailable or inert (Phase 4).

### 3.7 — Mid-game refresh / reopen by id

**Steps**
1. Play a few moves online on `/play?id=…`.
2. Hard-refresh the page (or leave and reopen the same id from Friends / Active games).
3. Confirm URL stays or returns to `/play?id=…`.

**Expect**
- Position and move list restore from the server.
- WebSocket reconnects; play can continue.
- Clocks rehydrate to sensible values.
- Local SP sessionStorage resume does **not** overwrite the online game.

### 3.8 — Disconnect messaging (basic)

**Steps**
1. During an online game with moves, close or kill one browser tab / disconnect network briefly for one player.
2. Observe the other player’s status for a few seconds.
3. Reopen / reconnect the disconnected player if practical.

**Expect**
- Connected player sees a disconnect-related status (e.g. “Opponent disconnected”).
- Phase 3 does **not** require full reconnect-forfeit countdown parity with classic `/game`.
- If the opponent rejoins, a rejoined message / status is acceptable when the server sends it.

### 3.9 — Classic `/game` fallback

**Steps**
1. Create or open an online game.
2. Manually navigate one client to `/game?id=<sameId>` (or use a bookmark).
3. Make a move from classic UI; observe the `/play` client (or the reverse).

**Expect**
- Classic `/game` still loads and can play the same OnlineGame.
- Moves still sync across clients (protocol compatible).
- No server crash.

### 3.10 — Active games / Friends reopen → `/play`

**Steps**
1. With an in-progress online game as a participant, open **Active games** list and click the game.
2. From **Friends**, reopen the shared in-progress game if the UI offers it.

**Expect**
- Play UI users land on `/play?id=…`.
- Game resumes as in 3.7.

### 3.11 — Out-of-time online (if easy)

**Steps**
1. If game time can be set very short for online invites, let a side flag.
2. Otherwise skip and note “not run”.

**Expect**
- Flagged side loses; both clients show timeout / game over.
- Clocks stop.

### 3.12 — Single-player regression after OnlineMode

**Steps**
1. After an online session (or on a fresh `/play`), use **Play Now** vs Brain.
2. Play a move; wait for engine reply; resign once.

**Expect**
- LocalEngineMode still runs (engine replies).
- No WebSocket errors blocking SP.
- Undo still works in SP; Draw still disabled vs engine.

### 3.13 — Spectating not on `/play` yet

**Steps**
1. As a third user, open `/play?id=<onlineGameId>` for a game you are not in (or Watch from home).

**Expect**
- Watchers are **not** required to work on `/play` in Phase 3.
- Prefer classic `/watch?id=` for spectating.
- If `/play?id=` is opened as a non-participant, a clear message / redirect is acceptable (no broken empty OnlineMode).

### 3.14 — Promotion in an online game

**Steps**
1. Reach a pawn promotion (or set up via a long game / known line).
2. Promote for the human side; confirm opponent sees the promoted piece.

**Expect**
- Promotion dialog on the promoting player’s client.
- Completed promotion syncs to the opponent.
- Game continues normally.

---

## Phase 4+ (placeholder)

### Phase 4 — Draw / rematch / rejoin forfeit (to be filled)

- [ ] Draw offer / accept / decline on `/play`
- [ ] Rematch offer / accept
- [ ] Reconnect countdown + forfeit parity with classic

### Phase 5 — Watch / full Review mode (to be filled)

---

## Sign-off

| Field | Value |
|---|---|
| Tester | |
| Date | |
| Build / branch | |
| Role(s) tested | |
| Web / Desktop | |
| Phase 1 result | Pass / Fail |
| Phase 2 result | Pass / Fail |
| Phase 3 result | Pass / Fail |
| Notes | |
