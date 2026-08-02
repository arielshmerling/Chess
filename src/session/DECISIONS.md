/**
 * Locked product / architecture decisions for the modular game rewrite.
 * Branch: refactor/modular-game-architecture
 *
 * Phase 0 artifact — do not delete; update only when the product owner revises a decision.
 */

# Decisions (locked)

1. **Desktop online (Electron)**  
   Infrastructure must allow online play later (same capabilities as web, different host).  
   **Near term:** keep existing desktop behavior (local engine / offline).  
   Connecting Electron to the online database is a later phase.

2. **First online slice on `/play` (Phase 3)**  
   Core play only: connect, moves both ways, server clocks, resign, game over,  
   waiting / cancel-before-move, basic disconnect messaging.  
   **Phase 4:** Draw / rematch / reconnect-forfeit on `/play`.  
   Chat / watchers remain later.

3. **Classic UI (`/game`, `chessboard.js`)**  
   Keep working in parallel for comparison and because mobile still depends on it.  
   Remove only when web + desktop modes are at 100% parity on the new shells.

4. **Mobile**  
   Phase 8+: consume the shared session package mode-by-mode.  
   **Slice 1:** `/mobile-review` → `ReviewMode`.  
   **Slice 2:** `/mobile-game` SP (`clientEngine`) → `LocalEngineMode`.  
   **Slice 3–4:** `/mobile-game` OnlineGame participants and watch OnlineMode  
   (watcher) via `mobile-session-online.js`.  
   **Deferred:** mobile watch **visual** shell (classic web UI look may still appear;  
   session path is the Phase 8 deliverable).  
   Keep Play desktop-only until a full mobile Play shell exists.  
   Do not load desktop Play CSS/DOM on mobile.

7. **Engine transport (Phase 9)**  
   Session / LocalEngineMode use an injected `EnginePort`.  
   Web = `src/adapters/brainHttp.js`; Electron = `src/adapters/brainIpc.js`;  
   `desktop-engine.js` is only a facade via `createEnginePort`.

8. **Classic SP `/game?id=` reopen (Phase 10)**  
   **Won’t migrate** to `/play`. Play single-player is client  
   `LocalEngineMode` (local UUID / sessionStorage), not server `SinglePlayerGame`.  
   Rare classic SP reopen links stay on `/game` until final classic cutover.

5. **Module format**  
   Keep IIFE / `<script>` tags for shells (lowest risk). Bundler/ESM later if needed.

6. **`ChessGame.js`**  
   Stable domain exception: **do not modify** this file in this program of work  
   (even though it is large). Wrap / call it; do not rewrite it.

# Migration rules (non-negotiable)

- Strangler: one mode / one vertical slice at a time.
- Characterization tests before extraction when touching protocol or authority.
- No phase “done” without agreed unit/API/e2e green for that slice.
- Session core must not assume web-only `fetch('/api/…')` — inject adapters  
  (`HttpApi` vs future `IpcApi`) so desktop can grow into online later.
