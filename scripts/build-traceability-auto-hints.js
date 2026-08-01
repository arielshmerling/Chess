#!/usr/bin/env node
/**
 * Build docs/traceability-auto-hints.json from SRS + test-suite knowledge.
 * Run: node scripts/build-traceability-auto-hints.js
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRS_PATH = path.join(ROOT, "docs/srs-shmerling-chess.md");
const OUT_PATH = path.join(ROOT, "docs/traceability-auto-hints.json");

const ID_RE =
    /\*\*((?:FR|NFR|IF)-[A-Z0-9]+-\d{3}|(?:CON|ASM)-\d{3})\*\*\s*[—–-]\s*(.+)$/gm;

/** @type {Record<string, { auto_tests: string[]; auto_coverage: "full"|"partial"|"none"; notes?: string }>} */
const COVERAGE = {
    "FR-ENV-001": {
        auto_tests: ["package.json — engines node >=24 <25"],
        auto_coverage: "partial",
        notes: "Declared in package.json; no runtime Node version test.",
    },
    "FR-ENV-002": {
        auto_tests: [
            "test/web.api.test.js — before hook ensureWebE2EUsers (MongoDB)",
            "test/webCustomThemes.api.test.js — Mongo-backed API tests",
        ],
        auto_coverage: "partial",
        notes: "API tests require MongoDB; no schema/migration coverage.",
    },
    "FR-ENV-003": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Electron packaging not exercised in automated suite.",
    },

    "FR-AUTH-001": {
        auto_tests: [
            "test/web.api.test.js — GET / and /login return the login form",
            "e2e/web-smoke.spec.js — login → Play Now → board → Home",
        ],
        auto_coverage: "full",
    },
    "FR-AUTH-002": {
        auto_tests: [
            "test/web.api.test.js — POST /login then GET /home reaches welcome",
            "test/web.api.test.js — login is case-insensitive for the username",
        ],
        auto_coverage: "partial",
        notes: "Login success tested; bcrypt hashing not asserted directly.",
    },
    "FR-AUTH-003": {
        auto_tests: [
            "test/web.api.test.js — POST /login then GET /home reaches welcome",
        ],
        auto_coverage: "partial",
        notes: "Session cookie created on login; httpOnly/name/TTL not asserted.",
    },
    "FR-AUTH-004": {
        auto_tests: [
            "test/web.api.test.js — login returnTo restores /friends",
            "e2e/web-smoke.spec.js — login returnTo restores the requested page",
        ],
        auto_coverage: "full",
    },
    "FR-AUTH-005": {
        auto_tests: [
            "test/web.api.test.js — GET /logout then /home redirects to login again",
            "e2e/web-smoke.spec.js — logout clears the authenticated session",
        ],
        auto_coverage: "full",
    },
    "FR-AUTH-006": {
        auto_tests: [
            "test/web.api.test.js — GET /home without session redirects to login",
            "test/web.api.test.js — protected pages without session redirect to login",
            "test/web.api.test.js — protected JSON/API endpoints without session redirect to login",
            "e2e/web-smoke.spec.js — unauthenticated /home redirects to login",
        ],
        auto_coverage: "full",
    },
    "FR-AUTH-007": {
        auto_tests: [
            "test/web.api.test.js — GET /validateUsername reports FOUND and NOT FOUND",
        ],
        auto_coverage: "full",
    },
    "FR-AUTH-008": {
        auto_tests: [
            "test/web.api.test.js — member is blocked from /admin and /register",
        ],
        auto_coverage: "partial",
        notes: "Member blocked from /register; admin user-creation flow not auto-tested.",
    },

    "FR-ROLE-001": {
        auto_tests: [
            "test/playPaths.test.js — user roles resolves session userType with admin precedence",
            "test/playPaths.test.js — canUsePlayAdvancedTools allows Admin and Partner only",
        ],
        auto_coverage: "full",
    },
    "FR-ROLE-002": {
        auto_tests: [
            "test/playPaths.test.js — canAccessPlayPage allows any logged-in user",
            "e2e/web-smoke.spec.js — Play Now opens compact new-game dialog on play page",
        ],
        auto_coverage: "partial",
        notes: "Member play access covered; friends/review/watch not all e2e'd.",
    },
    "FR-ROLE-003": {
        auto_tests: [
            "test/playUi.dockModeChrome.test.js — hides partner docks for members",
            "test/web.api.test.js — member is forbidden from brain-config",
            "e2e/web-smoke.spec.js — member cannot open admin page",
        ],
        auto_coverage: "full",
    },
    "FR-ROLE-004": {
        auto_tests: [
            "test/playPaths.test.js — canUsePlayAdvancedTools allows Admin and Partner only",
            "test/playPaths.test.js — canAccessDebug allows Admin and Partner only",
        ],
        auto_coverage: "full",
    },
    "FR-ROLE-005": {
        auto_tests: [
            "test/webCustomThemes.api.test.js — partner persists a newly created theme",
            "test/webCustomThemes.api.test.js — partner persists edits to a bundled theme",
        ],
        auto_coverage: "full",
    },
    "FR-ROLE-006": {
        auto_tests: [
            "test/playPaths.test.js — canUsePlayAdvancedTools allows Admin and Partner only",
        ],
        auto_coverage: "partial",
        notes: "Admin inherits Partner tools in unit tests; /admin UI not auto-tested.",
    },
    "FR-ROLE-007": {
        auto_tests: [
            "test/playPaths.test.js — user roles resolves session userType with admin precedence",
        ],
        auto_coverage: "full",
    },

    "FR-HOME-001": {
        auto_tests: [
            "test/web.api.test.js — POST /login then GET /home reaches welcome (Play Now)",
            "e2e/web-smoke.spec.js — login → Play Now → board → Home",
        ],
        auto_coverage: "full",
    },
    "FR-HOME-002": {
        auto_tests: [
            "test/playPaths.test.js — uses /mobile-game for mobile user agents",
        ],
        auto_coverage: "partial",
        notes: "Mobile path routing tested; UA redirect from /home not directly asserted.",
    },
    "FR-HOME-003": {
        auto_tests: [
            "test/web.api.test.js — GET /mobile-home with a mobile UA returns the mobile welcome page",
        ],
        auto_coverage: "full",
    },
    "FR-HOME-004": {
        auto_tests: [
            "test/web.api.test.js — authenticated GET /active-games-list and /list return pages",
            "e2e/web-smoke.spec.js — home links reach Active games and All Games list",
        ],
        auto_coverage: "partial",
    },
    "FR-HOME-005": {
        auto_tests: [
            "test/playPaths.test.js — resolveReviewHref uses /play?mode=review when usePlayPage",
        ],
        auto_coverage: "partial",
        notes: "Review href routing only; home→review navigation not e2e'd.",
    },

    "FR-FRN-001": {
        auto_tests: [
            "test/web.api.test.js — authenticated GET /friends returns page",
            "e2e/web-smoke.spec.js — home nav reaches Friends",
        ],
        auto_coverage: "full",
    },
    "FR-FRN-002": {
        auto_tests: [
            "test/web.api.test.js — authenticated GET /api/friends/search finds the other e2e user",
            "test/web.api.test.js — friend invite + accept + remove between e2e users",
        ],
        auto_coverage: "full",
    },
    "FR-FRN-003": {
        auto_tests: [
            "test/web.api.test.js — authenticated POST /api/presence/ping succeeds",
            "test/web.api.test.js — authenticated GET /api/friends/playing-usernames returns list",
        ],
        auto_coverage: "partial",
        notes: "HTTP presence ping tested; WebSocket presence subscription not auto-tested.",
    },
    "FR-FRN-004": {
        auto_tests: [
            "test/web.api.test.js — game-invite without targetUserId returns 400",
        ],
        auto_coverage: "partial",
        notes: "Validation only; full OnlineGame creation via invite not auto-tested.",
    },
    "FR-FRN-005": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Invitee joins as Black — manual / integration only.",
    },
    "FR-FRN-006": {
        auto_tests: [
            "test/playPaths.test.js — resolveOnlineParticipantHref uses /play?id= when usePlayPage",
        ],
        auto_coverage: "partial",
        notes: "Href builder tested; post-accept navigation not e2e'd.",
    },
    "FR-FRN-007": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "FR-FRN-008": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Private online games in public listings not auto-tested.",
    },

    "FR-PLAY-001": {
        auto_tests: [
            "test/web.api.test.js — authenticated GET /play returns the Play shell",
            "e2e/web-smoke.spec.js — Play Now opens compact new-game dialog on play page",
        ],
        auto_coverage: "full",
    },
    "FR-PLAY-002": {
        auto_tests: [
            "test/playUi.statusBar.test.js — applyClockHighlight / applyMatchHeader",
            "test/playUi.actionRail.test.js — mounts buttons, spacers, and accent class",
            "e2e/web-smoke.spec.js — drag e2-e4 records a move on the board",
        ],
        auto_coverage: "partial",
        notes: "Shell subcomponents unit-tested; full integrated layout not asserted.",
    },
    "FR-PLAY-003": {
        auto_tests: [
            "test/playUi.statusBar.test.js — updates match title and player names",
        ],
        auto_coverage: "partial",
        notes: "Header name update logic; left/right White/Black DOM order not asserted.",
    },
    "FR-PLAY-004": {
        auto_tests: [
            "test/session.gameSession.test.js — session LocalEngineMode after human move requests engine",
            "e2e/web-smoke.spec.js — refreshing the play page resumes the game in progress",
        ],
        auto_coverage: "partial",
    },
    "FR-PLAY-005": {
        auto_tests: [
            "test/playPaths.test.js — resolveDeprecatedGameToPlayHref maps bare /game to /play",
            "test/web.api.test.js — GET /game?newGame vs computer redirects to /play",
        ],
        auto_coverage: "full",
    },
    "FR-PLAY-006": {
        auto_tests: [
            "test/runtime.test.js — uses desktop home path when in desktop mode",
        ],
        auto_coverage: "partial",
        notes: "Desktop runtime paths; Electron window open not e2e'd.",
    },
    "FR-PLAY-007": {
        auto_tests: [
            "test/session.phase0.test.js — exposes stable MODE_IDS",
            "test/session.gameSession.test.js — session LocalEngineMode / ReviewMode",
            "test/session.onlineMode.test.js — session OnlineMode (Phase 3)",
            "test/playUi.sessionMode.test.js — sessionTypeLabel / exclusiveDockModes",
        ],
        auto_coverage: "full",
    },
    "FR-PLAY-008": {
        auto_tests: [
            "test/playUi.rightDockMode.test.js — shows chat for online players and read-only chat for watchers",
            "test/playChatPanel.test.js — switches right dock between games, chat, and hidden",
        ],
        auto_coverage: "full",
    },
    "FR-PLAY-009": {
        auto_tests: [
            "test/playUi.rightDockMode.test.js — shows games for Admin/Partner when idle",
            "test/playUi.rightDockMode.test.js — hides games during in-progress SP and restores after GameOver",
            "test/playUi.rightDockMode.test.js — keeps the right dock hidden for Members when not online",
        ],
        auto_coverage: "full",
    },

    "FR-SP-001": {
        auto_tests: [
            "e2e/web-smoke.spec.js — Play Now as Black loads the board",
            "test/session.gameSession.test.js — session LocalEngineMode after a human move",
        ],
        auto_coverage: "partial",
    },
    "FR-SP-002": {
        auto_tests: [
            "test/session.gameSession.test.js — session LocalEngineMode exposes localEngine capabilities",
            "test/adapters.createEnginePort.test.js — selects HTTP when not Electron",
        ],
        auto_coverage: "full",
    },
    "FR-SP-003": {
        auto_tests: [
            "test/mobile.sessionLocalEngine.test.js — makeBrainMove no-ops when clientEngine",
            "test/mobile.sessionLocalEngine.test.js — process(cmd clientEngineMove) keeps processor this binding",
        ],
        auto_coverage: "full",
    },
    "FR-SP-004": {
        auto_tests: [
            "test/mobile.sessionLocalEngine.test.js — onMoveReceived skips makeBrainMove when clientEngine",
        ],
        auto_coverage: "partial",
        notes: "clientEngine path tested; classic server-authoritative WS brain not integration-tested.",
    },
    "FR-SP-005": {
        auto_tests: [
            "e2e/web-smoke.spec.js — Play Now with Brain 4.2 starts a game",
            "test/playUi.phase1Remainder.test.js — promotes legacy engines on web",
        ],
        auto_coverage: "partial",
    },
    "FR-SP-006": {
        auto_tests: [
            "test/playUi.engineTurn.test.js — buildComputeArgs prefers thinkingTimeSeconds over difficulty",
            "test/brainConfigService.test.js — normalizeThinkingTimeSeconds keeps allowed thinking-time values",
        ],
        auto_coverage: "partial",
    },
    "FR-SP-007": {
        auto_tests: [
            "test/web.api.test.js — authenticated POST /api/play/last-game-options persists options",
        ],
        auto_coverage: "partial",
        notes: "Options persist via API; mouse/show-moves UI not e2e'd.",
    },
    "FR-SP-008": {
        auto_tests: [
            "test/web.api.test.js — last-game-options normalizes timeMinutes",
        ],
        auto_coverage: "partial",
    },
    "FR-SP-009": {
        auto_tests: [
            "test/chess.test.js — move validation / checkmate / en passant suites",
            "test/chess.fide-rules.test.js — FIDE rules phases 1–6",
        ],
        auto_coverage: "full",
    },
    "FR-SP-010": {
        auto_tests: [
            "test/session.gameSession.test.js — LocalEngineMode after human move requests engine and applies reply",
        ],
        auto_coverage: "full",
    },
    "FR-SP-011": {
        auto_tests: [
            "test/playUi.clocksController.test.js — counts down only the running side",
            "test/session.gameSession.test.js — emits clocksUpdated after turnChanged",
        ],
        auto_coverage: "full",
    },
    "FR-SP-012": {
        auto_tests: [
            "test/session.gameSession.test.js — undoPair and redoPair emit undone/redone",
            "test/session.phase0.test.js — localEngine capabilities include undo",
        ],
        auto_coverage: "full",
    },
    "FR-SP-013": {
        auto_tests: [
            "test/session.gameSession.test.js — resign emits gameOver",
        ],
        auto_coverage: "partial",
        notes: "Resign ends game in session core; king tilt visual not auto-tested.",
    },
    "FR-SP-014": {
        auto_tests: [
            "test/session.phase0.test.js — localEngine capabilities match single-player Play shell intent",
            "test/playUi.phase1Remainder.test.js — disables draw/undo when mode capabilities forbid them",
        ],
        auto_coverage: "full",
    },
    "FR-SP-015": {
        auto_tests: [
            "test/web.api.test.js — authenticated POST /api/play/last-game-options persists options",
        ],
        auto_coverage: "full",
    },
    "FR-SP-016": {
        auto_tests: [
            "e2e/web-smoke.spec.js — refreshing the play page resumes the game in progress",
        ],
        auto_coverage: "full",
    },
    "FR-SP-017": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "FR-SP-018": {
        auto_tests: [
            "test/playPaths.test.js — keeps SP id and unjoined joinGame on classic (null)",
            "test/web.api.test.js — GET /game?classic=1&newGame still uses classic create path",
        ],
        auto_coverage: "full",
    },
    "FR-SP-019": {
        auto_tests: [
            "test/mobile.sessionLocalEngine.test.js — applyClassicEngineMove animates with skipFinalSync",
            "test/mobile.sessionOnline.test.js — applyClassicRemoteMove animates with skipFinalSync",
        ],
        auto_coverage: "partial",
        notes: "Adapter flag tested; visual flash regression not browser-tested.",
    },
    "FR-SP-020": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Mobile thinking overlay UX not auto-tested.",
    },

    "FR-ONL-001": {
        auto_tests: [
            "test/web.api.test.js — game-invite without targetUserId returns 400",
        ],
        auto_coverage: "partial",
        notes: "Invite API surface only; no public queue exists but not negative-tested.",
    },
    "FR-ONL-002": {
        auto_tests: [
            "test/session.onlineMode.test.js — session OnlineMode connects and sends connection handshake",
            "e2e/web-smoke.spec.js — play page loads Phase 3 OnlineMode session scripts",
        ],
        auto_coverage: "full",
    },
    "FR-ONL-003": {
        auto_tests: [
            "test/session.onlineMode.test.js — sends human moves over transport / applies remote moves",
        ],
        auto_coverage: "full",
    },
    "FR-ONL-004": {
        auto_tests: [
            "test/session.onlineMode.test.js — merges clock snapshots from moveTime and explicit timers",
        ],
        auto_coverage: "partial",
        notes: "Client clock merge logic; server authority not integration-tested.",
    },
    "FR-ONL-005": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "FR-ONL-006": {
        auto_tests: [
            "test/session.onlineMode.test.js — requestResign with no moves calls cancelBeforeMove",
        ],
        auto_coverage: "full",
    },
    "FR-ONL-007": {
        auto_tests: [
            "test/session.onlineMode.test.js — requestResign after a move sends resign info and ends the game",
        ],
        auto_coverage: "full",
    },
    "FR-ONL-008": {
        auto_tests: [
            "test/session.phase0.test.js — drawOfferForward blocks white offer before any move",
            "test/session.onlineMode.test.js — canOfferDraw only after a human move on the opponent turn",
        ],
        auto_coverage: "full",
    },
    "FR-ONL-009": {
        auto_tests: [
            "test/session.onlineMode.test.js — accepts an inbound draw and ends the game",
        ],
        auto_coverage: "full",
    },
    "FR-ONL-010": {
        auto_tests: [
            "test/session.onlineMode.test.js — offerRematch requires game over and notifies on rematch accepted",
            "test/rematchColors.test.js — rematch color seat assignment",
        ],
        auto_coverage: "full",
    },
    "FR-ONL-011": {
        auto_tests: [
            "test/session.onlineMode.test.js — watcher forfeit resigns the disconnected seat",
        ],
        auto_coverage: "partial",
        notes: "Forfeit logic unit-tested; ~60s reconnect countdown not e2e'd.",
    },
    "FR-ONL-012": {
        auto_tests: [
            "test/playUi.phase1Remainder.test.js — reads online id and joinGame from the query string",
        ],
        auto_coverage: "partial",
    },
    "FR-ONL-013": {
        auto_tests: [
            "test/session.gameSession.test.js — selectPromotion completes a pending promotion",
            "test/playUi.engineTurn.test.js — fills a default promotion piece when needed",
        ],
        auto_coverage: "partial",
        notes: "Local promotion flow; opponent sync not integration-tested.",
    },
    "FR-ONL-014": {
        auto_tests: [
            "test/playUi.clocksController.test.js — flags once when a clock reaches zero",
            "test/session.gameSession.test.js — flagTimeout emits gameOver timeout",
        ],
        auto_coverage: "partial",
        notes: "Client flag + session event; server enforcement not integration-tested.",
    },
    "FR-ONL-015": {
        auto_tests: [
            "test/playPaths.test.js — resolveOnlineParticipantHref uses /game?id= when classic UI",
        ],
        auto_coverage: "partial",
    },
    "FR-ONL-016": {
        auto_tests: [
            "test/session.onlineMode.test.js — sends chat info and ignores send for watchers",
            "test/session.onlineMode.test.js — invokes onChatMessage for inbound chat",
            "test/session.phase0.test.js — OnlineGameMessageProcessor.chatHandler forwards to opponent and watchers",
            "test/session.phase0.test.js — accepts a minimal chat info payload",
            "test/session.phase0.test.js — online capabilities require chat",
        ],
        auto_coverage: "full",
    },

    "FR-WAT-001": {
        auto_tests: [
            "test/playPaths.test.js — resolveOnlineWatchHref uses /play?id=&mode=watch when usePlayPage",
        ],
        auto_coverage: "partial",
    },
    "FR-WAT-002": {
        auto_tests: [
            "test/session.onlineMode.test.js — watcher mode blocks resign/draw/rematch",
        ],
        auto_coverage: "full",
    },
    "FR-WAT-003": {
        auto_tests: [
            "test/session.onlineMode.test.js — watcher mode uses WATCH capabilities",
        ],
        auto_coverage: "partial",
        notes: "Watcher session unit-tested; live WS subscription not integration-tested.",
    },
    "FR-WAT-004": {
        auto_tests: [
            "test/mobile.sessionOnline.test.js — shouldAttach for OnlineGame participants and watchers",
            "test/playPaths.test.js — keeps mobile on /watch?id= even when usePlayPage",
        ],
        auto_coverage: "partial",
    },
    "FR-WAT-005": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "FR-WAT-007": {
        auto_tests: [
            "test/session.onlineMode.test.js — sends chat info and ignores send for watchers",
            "test/session.phase0.test.js — watch capabilities allow network, watchers, and read chat",
            "test/playUi.rightDockMode.test.js — shows chat for online players and read-only chat for watchers",
            "test/playChatPanel.test.js — switches right dock between games, chat, and hidden",
        ],
        auto_coverage: "full",
    },

    "FR-REV-001": {
        auto_tests: [
            "test/playPaths.test.js — resolveReviewHref",
            "e2e/play-review.spec.js — Start / Forward / Back move through the saved game",
        ],
        auto_coverage: "partial",
    },
    "FR-REV-002": {
        auto_tests: [
            "test/session.gameSession.test.js — ReviewMode loadNavigation and setPly emit reviewPlyChanged",
            "test/playUi.reviewModel.test.js — navButtonState disables navigation while playing",
        ],
        auto_coverage: "full",
    },
    "FR-REV-003": {
        auto_tests: [
            "test/playUi.movesPanel.test.js — makes plies clickable only when a handler is supplied",
        ],
        auto_coverage: "full",
    },
    "FR-REV-004": {
        auto_tests: [
            "test/mobile.sessionReview.test.js — exposes attach helpers without DOM",
        ],
        auto_coverage: "partial",
        notes: "Mobile review adapter characterized; full /mobile-review page not e2e'd.",
    },
    "FR-REV-005": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "/search PGN library not auto-tested.",
    },
    "FR-REV-006": {
        auto_tests: [
            "e2e/play-saved-games.spec.js — saves a game, lists it, loads it, and deletes it",
            "test/playUi.savedGamesModel.test.js — classification treats entry with/without moves",
        ],
        auto_coverage: "partial",
        notes: "Partner/Admin gating on bookmark UI not fully e2e'd (e2e uses member flows).",
    },
    "FR-REV-007": {
        auto_tests: [
            "test/web.api.test.js — bookmark lifecycle: create, list, update, delete",
            "test/bookmarkStore.test.js — adds/updates/deletes bookmarks on disk",
        ],
        auto_coverage: "full",
    },
    "FR-REV-008": {
        auto_tests: [
            "test/playUi.sessionMode.test.js — sessionTypeLabel prefers setup over config over review over play",
        ],
        auto_coverage: "partial",
        notes: "Mode label priority only; review→engine detach flow not e2e'd.",
    },

    "FR-PRA-001": {
        auto_tests: [
            "test/playPaths.test.js — canAccessDebug allows Admin and Partner only",
        ],
        auto_coverage: "full",
    },
    "FR-PRA-002": {
        auto_tests: [
            "test/session.phase0.test.js — practice capabilities are local self-play (no engine/network)",
        ],
        auto_coverage: "full",
    },
    "FR-PRA-003": {
        auto_tests: [
            "test/playPaths.test.js — resolvePracticeHref uses /play?mode=practice when usePlayPage",
        ],
        auto_coverage: "full",
    },
    "FR-PRA-004": {
        auto_tests: [
            "test/playPaths.test.js — resolvePracticeHref uses classic /game?gameType=3 otherwise",
        ],
        auto_coverage: "full",
    },
    "FR-PRA-005": {
        auto_tests: [
            "test/session.practiceMode.test.js — undo/redo one ply when PracticeMode is attached",
        ],
        auto_coverage: "full",
    },
    "FR-PRA-006": {
        auto_tests: [
            "test/chess.app.test.js — PracticeGame uses Are you sure? quit confirm",
        ],
        auto_coverage: "partial",
        notes: "Quit copy differs for Practice; persist/resign semantics not fully tested.",
    },

    "FR-SET-001": {
        auto_tests: [
            "test/playPaths.test.js — canUsePlayAdvancedTools allows Admin and Partner only",
            "test/web.api.test.js — member is forbidden from brain-config",
        ],
        auto_coverage: "full",
    },
    "FR-SET-002": {
        auto_tests: [
            "test/positionValidation.test.js — requires exactly one white king",
            "test/session.positionSetupMode.test.js — exposes positionSetup id and capabilities",
        ],
        auto_coverage: "partial",
        notes: "Validation messages + mode id; full setup UI placement not e2e'd.",
    },
    "FR-SET-003": {
        auto_tests: [
            "test/playUi.sessionMode.test.js — shouldShowGameRun shows during position setup",
        ],
        auto_coverage: "partial",
    },
    "FR-SET-004": {
        auto_tests: [
            "test/playUi.sessionMode.test.js — exclusiveDockModes clears the other dock when entering one",
            "e2e/play-setup-config.spec.js — Position Setup and Config are mutually exclusive",
        ],
        auto_coverage: "full",
    },
    "FR-SET-005": {
        auto_tests: [
            "test/brainConfigService.test.js — normalizeThinkingTimeSeconds",
            "test/brain41.pawnEval.test.js — brainConfigService sanitizeBrainConfig",
        ],
        auto_coverage: "partial",
        notes: "Config service unit tests; /brain-config page for authorized users not e2e'd.",
    },
    "FR-SET-006": {
        auto_tests: [
            "test/playUi.sessionMode.test.js — blocks practice, online, watch, and network sessions for setup",
        ],
        auto_coverage: "partial",
    },

    "FR-THM-001": {
        auto_tests: [
            "test/themeSchema.test.js — represents Blue and Dark as ordinary catalog entries",
        ],
        auto_coverage: "full",
    },
    "FR-THM-002": {
        auto_tests: [
            "test/webCustomThemes.api.test.js — member can change activeTheme but cannot create themes",
            "test/webCustomThemes.api.test.js — partner persists a newly created theme",
            "test/webCustomThemes.api.test.js — partner keeps a deleted seeded theme deleted",
        ],
        auto_coverage: "full",
    },
    "FR-THM-003": {
        auto_tests: [
            "test/web.api.test.js — UI settings normalizes an invalid piece set",
        ],
        auto_coverage: "partial",
        notes: "Invalid set rejected; explicit catalog of four piece sets not asserted.",
    },
    "FR-THM-004": {
        auto_tests: [
            "test/web.api.test.js — UI settings round-trip gamePreferences.showAvailableMoves",
        ],
        auto_coverage: "partial",
    },
    "FR-THM-005": {
        auto_tests: [
            "test/web.api.test.js — UI settings round-trip",
            "test/web.api.test.js — custom themes GET returns a store with active theme",
        ],
        auto_coverage: "full",
    },
    "FR-THM-006": {
        auto_tests: [
            "test/bookmarkStore.test.js — persists bookmarks to bookmarks.json on disk",
            "test/runtime.test.js — initializes userData paths in desktop mode",
        ],
        auto_coverage: "full",
    },

    "FR-MOB-001": {
        auto_tests: [
            "test/playPaths.test.js — uses /mobile-game for mobile user agents",
            "test/web.api.test.js — GET /mobile-home with a mobile UA",
        ],
        auto_coverage: "partial",
        notes: "Routing to mobile shells; desktop CSS leak not browser-tested.",
    },
    "FR-MOB-002": {
        auto_tests: [
            "test/mobile.sessionLocalEngine.test.js — shouldAttach only for clientEngine SinglePlayerGame",
        ],
        auto_coverage: "full",
    },
    "FR-MOB-003": {
        auto_tests: [
            "test/mobile.sessionOnline.test.js — shouldAttach for OnlineGame participants",
        ],
        auto_coverage: "full",
    },
    "FR-MOB-004": {
        auto_tests: [
            "test/mobile.sessionOnline.test.js — shouldAttach for OnlineGame participants and watchers",
        ],
        auto_coverage: "full",
    },
    "FR-MOB-005": {
        auto_tests: [
            "test/mobile.sessionLocalEngine.test.js — shouldAttach requires published window gameInfo.clientEngine",
            "test/mobile.sessionReview.test.js — sessionApisReady helper",
        ],
        auto_coverage: "partial",
    },
    "FR-THM-007": {
        auto_tests: [
            "test/themeSchema.test.js — keeps deleted seed and bundled themes hidden",
            "test/themeSchema.test.js — allows deleting every catalog theme",
            "test/themeSchema.test.js — selects another catalog entry after deleting the active theme",
            "test/customThemeStore.test.js — keeps a deleted seeded theme deleted after reloading",
            "test/webCustomThemes.api.test.js — partner can delete every theme and restore the catalog",
        ],
        auto_coverage: "full",
    },
    "FR-MOB-006": {
        auto_tests: [
            "test/playPaths.test.js — routes mobile to /mobile-game not /play",
        ],
        auto_coverage: "full",
    },

    "FR-DEP-001": {
        auto_tests: [
            "test/playPaths.test.js — maps bare /game to /play",
        ],
        auto_coverage: "full",
    },
    "FR-DEP-002": {
        auto_tests: [
            "test/playPaths.test.js — maps newGame SP query to /play?newGame=1…",
            "test/web.api.test.js — GET /game?newGame vs computer redirects to /play",
        ],
        auto_coverage: "full",
    },
    "FR-DEP-003": {
        auto_tests: [
            "test/playPaths.test.js — maps practice gameType 3 to /play?mode=practice",
        ],
        auto_coverage: "full",
    },
    "FR-DEP-004": {
        auto_tests: [
            "test/playPaths.test.js — maps online id when onlineGameById is set",
        ],
        auto_coverage: "full",
    },
    "FR-DEP-005": {
        auto_tests: [
            "test/playPaths.test.js — honors classic=1 escape",
            "test/web.api.test.js — GET /game?classic=1 without gameType starts classic SP",
        ],
        auto_coverage: "full",
    },
    "FR-DEP-006": {
        auto_tests: [
            "test/playPaths.test.js — keeps unjoined joinGame on classic / maps already-joined to /play?id=",
        ],
        auto_coverage: "full",
    },
    "FR-DEP-007": {
        auto_tests: [
            "test/playPaths.test.js — defaults to /game when usePlayPage is false",
            "test/web.api.test.js — GET /game?classic=1&newGame still uses classic create path",
        ],
        auto_coverage: "partial",
        notes: "Classic path remains routable; chessboard.js behavior not directly tested.",
    },
    "FR-DEP-008": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Double-slash path normalization not auto-tested.",
    },

    "FR-ADM-001": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Admin /admin UI not auto-tested (only member blocked).",
    },
    "FR-ADM-002": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "FR-ADM-003": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "FR-ADM-004": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "FR-ADM-005": {
        auto_tests: [
            "test/web.api.test.js — member is blocked from /admin and /register",
            "e2e/web-smoke.spec.js — member cannot open admin page",
        ],
        auto_coverage: "partial",
        notes: "Negative tests for members; admin allow-path not tested.",
    },

    "FR-RUL-001": {
        auto_tests: [
            "test/chess.fide-rules.test.js — check, checkmate, stalemate, movement",
            "test/chess.test.js — checkmate / draw / move validation",
        ],
        auto_coverage: "full",
    },
    "FR-RUL-002": {
        auto_tests: [
            "test/chess.fide-rules.test.js — Castling / En passant / Promotion",
            "test/chess.test.js — En passant suite",
        ],
        auto_coverage: "full",
    },
    "FR-RUL-003": {
        auto_tests: [
            "test/chess.fide-rules.test.js — Insufficient material / Threefold / Fifty-move",
        ],
        auto_coverage: "full",
    },
    "FR-RUL-004": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Process constraint (do not modify ChessGame.js); not verifiable by tests.",
    },

    "FR-BRN-001": {
        auto_tests: [
            "test/adapters.brainHttp.test.js — posts compute-move and unwraps move",
            "test/brainHttpApi.test.js — exports compute, evaluate, and abort handlers",
        ],
        auto_coverage: "full",
    },
    "FR-BRN-002": {
        auto_tests: [
            "test/adapters.brainIpc.test.js — invokes brain:computeMove",
            "test/adapters.createEnginePort.test.js — selects IPC when Electron",
        ],
        auto_coverage: "full",
    },
    "FR-BRN-003": {
        auto_tests: [
            "test/adapters.brainHttp.test.js — posts abort-search and swallows errors",
            "test/brainHttpApi.test.js — abortSearch handler delegates to desktopBrainService",
            "test/playUi.engineTurn.test.js — isSearchAbortedError recognizes abort",
        ],
        auto_coverage: "full",
    },
    "FR-BRN-004": {
        auto_tests: [
            "test/openingBook.lookup.test.js — opening book lookup",
            "test/openingBook.lines.test.js — opening book lines",
            "test/openingBook.desktopPath.test.js — restores move prefix when GameState loaded",
        ],
        auto_coverage: "partial",
        notes: "Book data/lookup unit tests; influence on live engine choice not integration-tested.",
    },
    "FR-BRN-005": {
        auto_tests: [
            "test/brainConfigService.test.js — normalizeThinkingTimeSeconds / thinkingTimeSecondsToMs",
            "test/brain41.pawnEval.test.js — sanitizeBrainConfig applies numeric overrides",
        ],
        auto_coverage: "partial",
    },
    "FR-BRN-006": {
        auto_tests: [
            "test/forcedMateDetection.test.js — detectForcedLossMate / opponentDeliversImmediateMate",
            "test/playUi.engineTurn.test.js — resigns on forced loss when immediate resign is on",
        ],
        auto_coverage: "full",
    },

    "FR-I18N-001": {
        auto_tests: [
            "test/strings.test.js — resolves nested keys / interpolates placeholders",
            "test/strings.test.js — bridge t() matches index t()",
        ],
        auto_coverage: "full",
    },
    "FR-I18N-002": {
        auto_tests: [
            "test/strings.test.js — registers fr/de/zh/ar/hi/es with Arabic RTL",
            "test/strings.test.js — supports Japanese catalog and LTR html dir",
        ],
        auto_coverage: "full",
    },
    "FR-I18N-003": {
        auto_tests: [
            "test/strings.test.js — defaults to English",
        ],
        auto_coverage: "full",
    },
    "FR-I18N-004": {
        auto_tests: [
            "test/strings.test.js — reports RTL for Hebrew and LTR for English",
        ],
        auto_coverage: "partial",
        notes: "getHtmlDir/isRtl tested; rendered HTML lang/dir not e2e'd.",
    },
    "FR-I18N-005": {
        auto_tests: [
            "test/strings.test.js — falls back to English when a Hebrew key is missing",
        ],
        auto_coverage: "partial",
        notes: "Fallback path exists; synthetic missing-key scenario lightly covered.",
    },
    "FR-I18N-006": {
        auto_tests: [
            "test/strings.test.js — changeLocale updates active locale without reload",
            "test/strings.test.js — normalizes and resolves request locale from cookie",
        ],
        auto_coverage: "partial",
        notes: "Locale switch helpers tested; Preferences UI combo not e2e'd.",
    },
    "FR-I18N-007": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Process requirement: English is authoring source; other locales may lag until bulk translation.",
    },

    "FR-DATA-001": {
        auto_tests: [
            "test/web.api.test.js — UI settings round-trip",
            "test/web.api.test.js — last-game-options persist",
        ],
        auto_coverage: "partial",
    },
    "FR-DATA-002": {
        auto_tests: [
            "test/gameHistoryStore.test.js — appendCompletedGame appends to played-games.pgn",
        ],
        auto_coverage: "partial",
        notes: "Desktop PGN history store; Mongo Game document shape not directly tested.",
    },
    "FR-DATA-003": {
        auto_tests: [
            "test/web.api.test.js — bookmark lifecycle",
            "test/bookmarkShape.test.js — maps mongoose-like docs to client bookmarks",
        ],
        auto_coverage: "full",
    },
    "FR-DATA-004": {
        auto_tests: [
            "e2e/web-smoke.spec.js — refreshing the play page resumes the game in progress",
        ],
        auto_coverage: "partial",
        notes: "Resume behavior e2e'd; sessionStorage key not asserted.",
    },

    "IF-UI-001": {
        auto_tests: [
            "test/web.api.test.js — authenticated GET /play returns the Play shell",
        ],
        auto_coverage: "partial",
    },
    "IF-UI-002": {
        auto_tests: [
            "test/web.api.test.js — protected pages includes /game",
        ],
        auto_coverage: "partial",
    },
    "IF-UI-003": {
        auto_tests: [
            "test/web.api.test.js — GET /mobile-home with a mobile UA",
            "test/playPaths.test.js — mobile-game routing",
        ],
        auto_coverage: "partial",
    },
    "IF-UI-004": {
        auto_tests: [
            "test/playUi.statusBar.test.js — updates match title and player names",
        ],
        auto_coverage: "partial",
    },

    "IF-HTTP-001": {
        auto_tests: [
            "test/web.api.test.js — login/logout/validateUsername flows",
        ],
        auto_coverage: "full",
    },
    "IF-HTTP-002": {
        auto_tests: [
            "test/web.api.test.js — GET /home, /friends, /play, /mobile-home",
        ],
        auto_coverage: "partial",
        notes: "Several routes covered; /watch /review /mobile-review not in API suite.",
    },
    "IF-HTTP-003": {
        auto_tests: [
            "test/adapters.brainHttp.test.js — compute-move / evaluate-position / abort-search",
            "test/brainHttpApi.test.js — brainApi handlers",
        ],
        auto_coverage: "partial",
        notes: "Adapter/handler unit tests; authenticated HTTP route not supertest'd end-to-end.",
    },
    "IF-HTTP-004": {
        auto_tests: [
            "test/web.api.test.js — GET /gameMoves without active game redirects home",
            "test/web.api.test.js — GET /gameInfo without id returns 400",
        ],
        auto_coverage: "partial",
    },
    "IF-HTTP-005": {
        auto_tests: [
            "test/web.api.test.js — friends/presence API suite",
        ],
        auto_coverage: "full",
    },
    "IF-HTTP-006": {
        auto_tests: [
            "test/web.api.test.js — UI settings and custom themes round-trip",
            "test/webCustomThemes.api.test.js — member vs partner theme APIs",
        ],
        auto_coverage: "full",
    },
    "IF-HTTP-007": {
        auto_tests: [
            "test/web.api.test.js — bookmark lifecycle",
        ],
        auto_coverage: "full",
    },
    "IF-HTTP-008": {
        auto_tests: [
            "test/web.api.test.js — authenticated GET /active-games returns JSON",
            "test/web.api.test.js — authenticated GET /active-games-list returns page",
        ],
        auto_coverage: "partial",
    },

    "IF-WS-001": {
        auto_tests: [
            "test/session.onlineMode.test.js — session WsTransport defaultWsUrl picks ws/wss",
        ],
        auto_coverage: "partial",
        notes: "Client URL builder only; server /ws mount not supertest'd.",
    },
    "IF-WS-002": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "App-channel watch/lobby/presence message types not auto-tested.",
    },
    "IF-WS-003": {
        auto_tests: [
            "test/session.onlineMode.test.js — move/info handling in OnlineMode",
            "test/session.onlineMode.test.js — classifies inbound chat info",
            "test/session.phase0.test.js — accepts a minimal chat info payload",
            "test/mobile.sessionLocalEngine.test.js — clientEngineMove cmd schema and processor",
        ],
        auto_coverage: "partial",
    },
    "IF-WS-004": {
        auto_tests: [
            "test/session.phase0.test.js — WS message schema rejects unknown info kinds",
        ],
        auto_coverage: "full",
    },
    "IF-WS-005": {
        auto_tests: [
            "test/mobile.sessionLocalEngine.test.js — process(cmd clientEngineMove) keeps processor this binding",
        ],
        auto_coverage: "full",
    },

    "IF-IPC-001": {
        auto_tests: [
            "test/adapters.brainIpc.test.js — invokes brain:computeMove / brain:abortSearch",
        ],
        auto_coverage: "full",
    },
    "IF-IPC-002": {
        auto_tests: [
            "test/bookmarkStore.test.js — persists bookmarks to bookmarks.json on disk",
            "test/runtime.test.js — initializes userData paths in desktop mode",
            "test/syncDataPaths.test.js — syncDataPaths in desktop mode",
        ],
        auto_coverage: "full",
    },

    "IF-DATA-001": {
        auto_tests: [
            "test/web.api.test.js — Mongo-backed auth/friends/bookmark tests",
        ],
        auto_coverage: "partial",
    },
    "IF-DATA-002": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "In-memory games manager not directly unit-tested.",
    },
    "IF-DATA-003": {
        auto_tests: [
            "test/bookmarkStore.test.js — local filesystem bookmark store",
            "test/gameHistoryStore.test.js — played-games.pgn in userData",
        ],
        auto_coverage: "full",
    },

    "NFR-SEC-001": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "NFR-SEC-002": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "NFR-SEC-003": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "NFR-SEC-004": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "NFR-SEC-005": {
        auto_tests: [
            "test/web.api.test.js — member forbidden from brain-config / admin routes",
            "test/playPaths.test.js — role gates for advanced tools",
        ],
        auto_coverage: "full",
    },
    "NFR-SEC-006": {
        auto_tests: [
            "test/session.phase0.test.js — WS message schema validation",
            "test/mobile.sessionLocalEngine.test.js — validates clientEngineMove cmd schema",
        ],
        auto_coverage: "partial",
    },

    "NFR-REL-001": {
        auto_tests: [
            "test/session.phase0.test.js — rejects unknown WS info kinds without crashing",
        ],
        auto_coverage: "partial",
    },
    "NFR-REL-002": {
        auto_tests: [
            "test/session.onlineMode.test.js — merges clock snapshots from server payloads",
            "test/session.phase0.test.js — online capabilities imply server-side protocol",
        ],
        auto_coverage: "partial",
    },
    "NFR-REL-003": {
        auto_tests: [
            "test/mobile.sessionLocalEngine.test.js — clientEngineMove processor applies AI plies",
        ],
        auto_coverage: "full",
    },
    "NFR-REL-004": {
        auto_tests: [
            "test/session.onlineMode.test.js — OnlineProtocol message building",
        ],
        auto_coverage: "partial",
    },

    "NFR-PERF-001": {
        auto_tests: [
            "test/brainConfigService.test.js — thinking time normalization",
            "test/brain42.adaptiveDepth.test.js — adaptive depth respects min/max",
        ],
        auto_coverage: "partial",
    },
    "NFR-PERF-002": {
        auto_tests: [
            "test/mobile.sessionLocalEngine.test.js — skipFinalSync animation path",
        ],
        auto_coverage: "partial",
    },
    "NFR-PERF-003": {
        auto_tests: [
            "test/openingBook.desktopPath.test.js — opening book desktop path load",
        ],
        auto_coverage: "partial",
    },

    "NFR-USE-001": {
        auto_tests: [
            "test/playUi.statusBar.test.js — defaultStatusText / renderStatus",
        ],
        auto_coverage: "partial",
    },
    "NFR-USE-002": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "NFR-USE-003": {
        auto_tests: [
            "test/playUi.dockModeChrome.test.js — hides partner docks for members",
            "test/playUi.phase1Remainder.test.js — disables draw/undo when capabilities forbid",
        ],
        auto_coverage: "full",
    },
    "NFR-USE-004": {
        auto_tests: [
            "test/strings.test.js — reports RTL for Hebrew",
        ],
        auto_coverage: "partial",
    },
    "NFR-USE-005": {
        auto_tests: [
            "test/web.api.test.js — unknown HTML routes render the minimal 404 page",
        ],
        auto_coverage: "full",
    },

    "NFR-PORT-001": {
        auto_tests: [
            "test/session.gameSession.test.js — runs in Node harness",
            "test/mobile.sessionLocalEngine.test.js — exposes attach helpers without DOM",
        ],
        auto_coverage: "full",
    },
    "NFR-PORT-002": {
        auto_tests: [
            "test/adapters.createEnginePort.test.js — HTTP vs IPC selection",
        ],
        auto_coverage: "full",
    },

    "NFR-QA-001": {
        auto_tests: [
            "test/session.phase0.test.js — characterization tests label",
            "test/playPaths.test.js — resolveDeprecatedGameToPlayHref characterization",
        ],
        auto_coverage: "partial",
        notes: "Meta-quality gate; many slices have characterization tests but not all.",
    },
    "NFR-QA-002": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Process gate (suites must be green); not encoded per-requirement.",
    },
    "NFR-QA-003": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Manual QA checklist maintenance; not auto-verifiable.",
    },

    "CON-001": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Process constraint.",
    },
    "CON-002": {
        auto_tests: [
            "test/playPaths.test.js — keeps classic /game path when usePlayPage is false",
        ],
        auto_coverage: "partial",
    },
    "CON-003": {
        auto_tests: [
            "test/playPaths.test.js — resolveDeprecatedGameToPlayHref soft-redirect mappings",
        ],
        auto_coverage: "partial",
    },
    "CON-004": {
        auto_tests: [
            "test/adapters.createEnginePort.test.js — adapter-injected engine port",
        ],
        auto_coverage: "partial",
    },
    "CON-005": {
        auto_tests: [
            "test/playPaths.test.js — mobile routes to /mobile-game not desktop /play",
        ],
        auto_coverage: "partial",
    },
    "CON-006": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Friend-invite-only policy not negative-tested (no public queue test).",
    },
    "CON-007": {
        auto_tests: [
            "test/session.onlineMode.test.js — sends chat info and ignores send for watchers",
            "test/playUi.rightDockMode.test.js — shows chat for online players and read-only chat for watchers",
        ],
        auto_coverage: "full",
        notes: "Retired constraint — Prefer-Play chat is implemented (FR-ONL-016 / FR-PLAY-008 / FR-WAT-007).",
    },
    "CON-008": {
        auto_tests: [
            "test/playPaths.test.js — keeps SP id reopen on classic (null redirect)",
        ],
        auto_coverage: "partial",
    },
    "CON-009": {
        auto_tests: [],
        auto_coverage: "none",
        notes: "Module format constraint; not test-asserted.",
    },
    "CON-010": {
        auto_tests: [
            "test/adapters.createEnginePort.test.js — injects HTTP/IPC without fetch hard-code",
        ],
        auto_coverage: "partial",
    },

    "ASM-001": {
        auto_tests: [
            "test/web.api.test.js — requires DATABASE_URL + SESSION_SECRET (file header)",
        ],
        auto_coverage: "partial",
        notes: "Tests assume operator-provided env; not validating secret strength.",
    },
    "ASM-002": {
        auto_tests: [],
        auto_coverage: "none",
    },
    "ASM-003": {
        auto_tests: [
            "test/adapters.brainIpc.test.js — IPC brain adapter",
        ],
        auto_coverage: "partial",
        notes: "IPC adapter mocked; real Electron binary pairing not tested.",
    },
};

function extractRequirements(markdown) {
    /** @type {{ id: string; statement: string }[]} */
    const items = [];
    let m;
    while ((m = ID_RE.exec(markdown)) !== null) {
        const id = m[1];
        let statement = m[2].trim();
        statement = statement.replace(/\s*\*\([^)]*\)\*?\s*\.?\s*$/, "").trim();
        statement = statement.replace(/\*\*/g, "");
        if (statement.length > 120) {
            statement = statement.slice(0, 117) + "…";
        }
        items.push({ id, statement });
    }
    return items;
}

function main() {
    const srs = fs.readFileSync(SRS_PATH, "utf8");
    const extracted = extractRequirements(srs);

    const requirements = extracted.map(({ id, statement }) => {
        const hit = COVERAGE[id];
        if (!hit) {
            return {
                id,
                statement,
                auto_tests: [],
                auto_coverage: "none",
                notes: "No mapping entry — review manually.",
            };
        }
        const row = {
            id,
            statement,
            auto_tests: hit.auto_tests,
            auto_coverage: hit.auto_coverage,
        };
        if (hit.notes) row.notes = hit.notes;
        return row;
    });

    const counts = { full: 0, partial: 0, none: 0 };
    for (const r of requirements) {
        counts[r.auto_coverage]++;
    }

    const out = {
        generated: new Date().toISOString().slice(0, 10),
        srs_version: "1.9",
        srs_path: "docs/srs-shmerling-chess.md",
        test_scripts: {
            default: "npm test (chess rules core)",
            app: "npm run test:app",
            web_api: "npm run test:web:api",
            e2e: "npm run test:e2e",
            all: "npm run test:all",
        },
        summary: {
            total_requirements: requirements.length,
            auto_coverage_full: counts.full,
            auto_coverage_partial: counts.partial,
            auto_coverage_none: counts.none,
        },
        requirements,
    };

    fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");

    const unmapped = extracted.filter(({ id }) => !COVERAGE[id]).map((x) => x.id);
    if (unmapped.length) {
        console.warn("WARNING: extracted IDs missing COVERAGE entries:", unmapped.join(", "));
    }

    const extra = Object.keys(COVERAGE).filter(
        (id) => !extracted.some((r) => r.id === id),
    );
    if (extra.length) {
        console.warn("WARNING: COVERAGE keys not in SRS:", extra.join(", "));
    }

    console.log(
        `Wrote ${OUT_PATH} — ${requirements.length} requirements (${counts.full} full, ${counts.partial} partial, ${counts.none} none)`,
    );
}

main();
