#!/usr/bin/env node
/**
 * Final i18n pass: remaining EJS, friends, chessboard, desktop chrome, serverValidations.
 * Run after: node scripts/i18n-build-en-extra.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function write(rel, content) {
    fs.writeFileSync(path.join(ROOT, rel), content, "utf8");
    console.log("updated", rel);
}

function patch(rel, pairs) {
    let s = read(rel);
    let changed = false;
    for (const [from, to] of pairs) {
        if (!s.includes(from)) continue;
        s = s.split(from).join(to);
        changed = true;
    }
    if (changed) write(rel, s);
}

const FRIENDS_T_HELPER = `(function () {
  function t(key, params) {
    if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
      return window.ShmerlingStrings.t(key, params);
    }
    return key;
  }
`;

function patchFriendsEjs() {
    let s = read("src/views/friends.ejs");
    s = s
        .split("<h1 class=\"hero-greeting\">Friends</h1>")
        .join("<h1 class=\"hero-greeting\"><%= t('site.friendsPage.title') %></h1>")
        .split("<p class=\"hero-tagline\">Find new chess mates</p>")
        .join("<p class=\"hero-tagline\"><%= t('site.friendsPage.tagline') %></p>")
        .split("<h2 class=\"panel-title\">My friends</h2>")
        .join("<h2 class=\"panel-title\"><%= t('site.friendsPage.myFriends') %></h2>")
        .split("<p>No friends yet</p>")
        .join("<p><%= t('site.friendsPage.noFriendsYet') %></p>")
        .split("<h2 class=\"panel-title\">Find players</h2>")
        .join("<h2 class=\"panel-title\"><%= t('site.friendsPage.findPlayers') %></h2>")
        .split("<div class=\"panel-subtitle\">Search by username</div>")
        .join("<div class=\"panel-subtitle\"><%= t('site.friendsPage.searchByUsername') %></div>")
        .split("for=\"friendSearchInput\">Username</label>")
        .join("for=\"friendSearchInput\"><%= t('site.username').replace(':', '') %></label>")
        .split('placeholder="Type to search…"')
        .join('placeholder="<%= t(\'site.friendsPage.searchPlaceholder\') %>"')
        .split("Enter at least one character to search")
        .join("<%= t('site.friendsPage.enterCharToSearch') %>");

    if (!s.includes("function t(key, params)")) {
        s = s.replace(
            "<script nonce=\"<%= typeof cspNonce !== 'undefined' ? cspNonce : '' %>\">\n(function () {",
            `<script nonce="<%= typeof cspNonce !== 'undefined' ? cspNonce : '' %>">\n${FRIENDS_T_HELPER}`,
        );
    }

    const jsReplacements = [
        ['|| "Request failed"', '|| t("site.friendsPage.requestFailed")'],
        ['return "Playing"', 'return t("site.friendsPage.playing")'],
        ['return "Online"', 'return t("site.friendsPage.online")'],
        ['return "Pending friendship offer"', 'return t("site.friendsPage.pendingFriendshipOffer")'],
        ['return "Offline"', 'return t("site.friendsPage.offline")'],
        ['return "Joining"', 'return t("site.friendsPage.joining")'],
        ['return "Rejoin"', 'return t("site.friendsPage.rejoin")'],
        ['primary.textContent = "Invite"', 'primary.textContent = t("site.friendsPage.invite")'],
        ['var offerLabel = "Friend request"', 'var offerLabel = t("site.friendsPage.friendRequest")'],
        ['"(wants to be friends)"', 't("site.friendsPage.wantsToBeFriends")'],
        ['">Accept</button>', '">' + "' + t(\"site.friendsPage.accept\") + '" + '</button>'],
        ['">Decline</button>', '">' + "' + t(\"site.friendsPage.decline\") + '" + '</button>'],
        ['"(pending friendship offer)"', 't("site.friendsPage.pendingOfferSuffix")'],
        ['">Invite</button>', '">' + "' + t(\"site.friendsPage.invite\") + '" + '</button>'],
        ['">Withdraw</button>', '">' + "' + t(\"site.friendsPage.withdraw\") + '" + '</button>'],
        ['var pendTitle = "Waiting for your friend to respond"', 'var pendTitle = t("site.friendsPage.waitingFriendRespond")'],
        ['title="Cancel the game invite before removing this friend">Remove</button>', 'title="' + "' + t(\"site.friendsPage.cancelBeforeRemove\") + '" + '">' + "' + t(\"site.friendsPage.remove\") + '" + '</button>'],
        ['">Remove</button>', '">' + "' + t(\"site.friendsPage.remove\") + '" + '</button>'],
        ['searchPlaceholder.textContent = "No matching users"', 'searchPlaceholder.textContent = t("site.friendsPage.noMatchingUsers")'],
        ['<span class="friends-tag">Friends</span>', '<span class="friends-tag">\' + t("site.friendsPage.friendsTag") + \'</span>'],
        ['<span class="friends-tag">Offer sent</span>', '<span class="friends-tag">\' + t("site.friendsPage.offerSent") + \'</span>'],
        ['<span class="friends-tag">Offer received — see Your friends</span>', '<span class="friends-tag">\' + t("site.friendsPage.offerReceivedTag") + \'</span>'],
        ['">Add friend</button>', '">' + "' + t(\"site.friendsPage.addFriend\") + '" + '</button>'],
        ['searchPlaceholder.textContent = "Enter at least one character to search"', 'searchPlaceholder.textContent = t("site.friendsPage.enterCharToSearch")'],
        ['showSiteAlert(e.message || "Could not accept", "Could not accept")', 'showSiteAlert(e.message || t("site.friendsPage.couldNotAccept"), t("site.friendsPage.couldNotAccept"))'],
        ['showSiteAlert(e.message || "Could not decline", "Could not decline")', 'showSiteAlert(e.message || t("site.friendsPage.couldNotDecline"), t("site.friendsPage.couldNotDecline"))'],
        ['showSiteConfirm("Remove this friend from your list?"', 'showSiteConfirm(t("site.friendsPage.removeFriendConfirm")'],
        ['title: "Remove friend"', 'title: t("site.friendsPage.removeFriendTitle")'],
        ['confirmLabel: "Remove"', 'confirmLabel: t("site.friendsPage.remove")'],
        ['cancelLabel: "Cancel"', 'cancelLabel: t("site.cancel")'],
        ['showSiteAlert(e.message || "Could not remove", "Could not remove")', 'showSiteAlert(e.message || t("site.friendsPage.couldNotRemove"), t("site.friendsPage.couldNotRemove"))'],
        ['showSiteAlert(e.message || "Could not cancel invite", "Game invite")', 'showSiteAlert(e.message || t("site.friendsPage.couldNotCancelInvite"), t("site.friendsPage.gameInvite"))'],
        ['showSiteConfirm("Withdraw this friendship offer?"', 'showSiteConfirm(t("site.friendsPage.withdrawOfferConfirm")'],
        ['title: "Withdraw offer"', 'title: t("site.friendsPage.withdrawOfferTitle")'],
        ['confirmLabel: "Withdraw"', 'confirmLabel: t("site.friendsPage.withdraw")'],
        ['showSiteAlert(e.message || "Could not withdraw offer", "Could not withdraw")', 'showSiteAlert(e.message || t("site.friendsPage.couldNotWithdraw"), t("site.friendsPage.couldNotWithdraw"))'],
        ['showSiteAlert(e.message || "Could not send invite", "Could not send invite")', 'showSiteAlert(e.message || t("site.friendsPage.couldNotSendInvite"), t("site.friendsPage.couldNotSendInvite"))'],
        ['showSiteAlert(e.message || "Could not send game invite", "Game invite")', 'showSiteAlert(e.message || t("site.friendsPage.couldNotSendGameInvite"), t("site.friendsPage.gameInvite"))'],
    ];
    for (const [from, to] of jsReplacements) {
        s = s.split(from).join(to);
    }
    write("src/views/friends.ejs", s);
}

function patchChessboardFinish() {
    let s = read("src/chessboard.js");
    const pairs = [
        ['title: "Online", mod:', 'title: t("classic.playerOnline"), mod:'],
        ['title: "Disconnected", mod:', 'title: t("classic.playerDisconnectedStatus"), mod:'],
        ['title: "Offline", mod:', 'title: t("classic.playerOffline"), mod:'],
        [
            'const DISCONNECT_COUNTDOWN_TOOLTIP = "Waiting for opponent to rejoin";',
            'function getDisconnectCountdownTooltip() { return t("classic.waitingOpponentRejoin"); }',
        ],
        ['return "Timeout: 1 sec";', 'return t("classic.timeoutOneSec");'],
        ['return "Timeout: " + s + " sec";', 'return t("classic.timeoutSecs", { count: s });'],
        [
            'const detail = "Reconnect timed out with no moves played.";',
            'const detail = t("classic.reconnectTimeoutNoMoves");',
        ],
        ['el.textContent = "Game ID: " + id;', 'el.textContent = t("mobile.gameId", { id: id });'],
        ['img.alt = "White piece";', 'img.alt = t("classic.whitePieceAlt");'],
        ['img.alt = "Black piece";', 'img.alt = t("classic.blackPieceAlt");'],
        ['eraserBtn.setAttribute("title", "Eraser");', 'eraserBtn.setAttribute("title", t("classic.eraserTitle"));'],
        [
            'eraserBtn.setAttribute("aria-label", "Eraser – remove piece from square");',
            'eraserBtn.setAttribute("aria-label", t("classic.eraserAria"));',
        ],
        ['selectBtn.setAttribute("title", "Select");', 'selectBtn.setAttribute("title", t("classic.selectTitle"));'],
        [
            'selectBtn.setAttribute("aria-label", "Select – drag pieces to move them");',
            'selectBtn.setAttribute("aria-label", t("classic.selectAria"));',
        ],
        ['resetBtn.setAttribute("title", "Reset");', 'resetBtn.setAttribute("title", t("desktop.brainConfig.reset"));'],
        [
            'resetBtn.setAttribute("aria-label", "Reset – clear all pieces");',
            'resetBtn.setAttribute("aria-label", t("classic.resetAria"));',
        ],
        [
            'defaultPosBtn.setAttribute("title", "Default position");',
            'defaultPosBtn.setAttribute("title", t("desktop.positionSetup.startingPosition"));',
        ],
        [
            'defaultPosBtn.setAttribute("aria-label", "Default position – set up standard starting position");',
            'defaultPosBtn.setAttribute("aria-label", t("classic.defaultPositionAria"));',
        ],
        ['statusEl.textContent = "Loading...";', 'statusEl.textContent = t("classic.loading");'],
        ['titleBar.textContent = "Brain Config";', 'titleBar.textContent = t("classic.researchBrainConfig");'],
        ['engineLabel.textContent = "Engine";', 'engineLabel.textContent = t("classic.engineLabel");'],
        [
            ': "New game started — go to Home to watch.";',
            ': t("mobile.newGameWatchFromHome");',
        ],
    ];
    for (const [from, to] of pairs) {
        s = s.split(from).join(to);
    }
    s = s.replace(/DISCONNECT_COUNTDOWN_TOOLTIP/g, "getDisconnectCountdownTooltip()");
    write("src/chessboard.js", s);
}

function patchRemainingEjs() {
    const playNow = [
        ['class="play-now-modal-title">New game</', "class=\"play-now-modal-title\"><%= t('site.playNow.title') %></"],
        ['class="play-now-modal-title">Start a new Game</', "class=\"play-now-modal-title\"><%= t('site.playNow.startTitle') %></"],
        [">Playing color</label>", "><%= t('site.playNow.playingColor') %></label>"],
        [">White</span>", "><%= t('common.white') %></span>"],
        [">Black</span>", "><%= t('common.black') %></span>"],
        [">Engine</label>", "><%= t('common.engine') %></label>"],
        [">Time (min)</label>", "><%= t('site.playNow.timeMin') %></label>"],
        [">Difficulty (1–5)</label>", "><%= t('site.playNow.difficulty') %></label>"],
        [">Mouse preference</label>", "><%= t('site.playNow.mousePreference') %></label>"],
        [">Drag</span>", "><%= t('site.playNow.drag') %></span>"],
        [">Double click</span>", "><%= t('site.playNow.doubleClick') %></span>"],
        [">Show available moves</span>", "><%= t('site.playNow.showAvailableMoves') %></span>"],
        [">Private</span>", "><%= t('site.playNow.private') %></span>"],
        ['onclick="closePlayNowModal()">Cancel</button>', 'onclick="closePlayNowModal()"><%= t(\'site.cancel\') %></button>'],
        ['class="play-now-btn-start">Start</button>', 'class="play-now-btn-start"><%= t(\'common.start\') %></button>'],
        ['value="brain43" selected>Brain 4.3</option>', 'value="brain43" selected><%= t(\'play.newGameDialog.brain43\') %></option>'],
        ['value="brain42">Brain 4.2</option>', 'value="brain42"><%= t(\'play.newGameDialog.brain42\') %></option>'],
        ['value="brain41">Brain 4.1</option>', 'value="brain41"><%= t(\'play.newGameDialog.brain41\') %></option>'],
        ['value="brain4">Brain 4.0</option>', 'value="brain4"><%= t(\'play.newGameDialog.brain4\') %></option>'],
        ['value="brain3">Brain 3</option>', 'value="brain3"><%= t(\'site.playNow.brain3\') %></option>'],
        ['value="brain2">Brain 2</option>', 'value="brain2"><%= t(\'site.playNow.brain2\') %></option>'],
    ];

    for (const rel of ["src/views/game.ejs", "src/views/mobile-welcome.ejs", "src/views/mobile-game.ejs"]) {
        patch(rel, playNow);
    }

    patch("src/views/mobile-welcome.ejs", [
        [">Play computer</span>", "><%= t('site.playNow.playComputer') %></span>"],
        ['data-tab="games">Games</button>', 'data-tab="games"><%= t(\'play.shell.games\') %></button>'],
        ['href="/active-games-list">Browse all</a>', 'href="/active-games-list"><%= t(\'site.playNow.browseAll\') %></a>'],
        ["Your history", "<%= t('site.playNow.yourHistory') %>"],
        ['href="/list">Full list</a>', 'href="/list"><%= t(\'site.playNow.fullList\') %></a>'],
        ["Game library", "<%= t('site.playNow.gameLibrary') %>"],
        ['href="/search">Open library search</a>', 'href="/search"><%= t(\'site.playNow.openLibrarySearch\') %></a>'],
    ]);

    patch("src/views/partials/topbar.ejs", [
        [">Human Vs. Computer</div>", "><%= t('classic.humanVsComputer') %></div>"],
        [">New Game 2 Players</div>", "><%= t('classic.newGameTwoPlayers') %></div>"],
        [">Resign</div>", "><%= t('play.actions.resign') %></div>"],
        [">Undo</div>", "><%= t('play.actions.undo') %></div>"],
        [">Save</div>", "><%= t('play.actions.save') %></div>"],
        [">Load</div>", "><%= t('classic.load') %></div>"],
        [">Position Setup</div>", "><%= t('play.actions.positionSetup') %></div>"],
        [">Settings</div>", "><%= t('classic.settings') %></div>"],
        [">Help</div>", "><%= t('classic.help') %></div>"],
        ['class="button admin-confirm-ok site-confirm-ok">Confirm</button>', 'class="button admin-confirm-ok site-confirm-ok"><%= t(\'site.confirm\') %></button>'],
    ]);

    patch("src/views/register.ejs", [
        ['onclick="selectOption(this)">Rookie</div>', 'onclick="selectOption(this)"><%= t(\'site.register.rookie\') %></div>'],
        ['onclick="selectOption(this)">Skilled</div>', 'onclick="selectOption(this)"><%= t(\'site.register.skilled\') %></div>'],
        ['onclick="selectOption(this)">Elite</div>', 'onclick="selectOption(this)"><%= t(\'site.register.elite\') %></div>'],
        ['onclick="selectOption(this)">Grand Master</div>', 'onclick="selectOption(this)"><%= t(\'site.register.grandMaster\') %></div>'],
    ]);

    patch("src/views/admin.ejs", [
        ['<h2 class="panel-title">Admin</h2>', '<h2 class="panel-title"><%= t(\'site.adminPage.title\') %></h2>'],
        ['id="admin-tab-games" aria-controls="admin-panel-main" aria-selected="false" tabindex="-1">Games</button>', 'id="admin-tab-games" aria-controls="admin-panel-main" aria-selected="false" tabindex="-1"><%= t(\'site.adminPage.games\') %></button>'],
        ['id="admin-tab-engines" aria-controls="admin-panel-main" aria-selected="false" tabindex="-1">Engines</button>', 'id="admin-tab-engines" aria-controls="admin-panel-main" aria-selected="false" tabindex="-1"><%= t(\'site.adminPage.engines\') %></button>'],
        ['id="admin-tab-states" aria-controls="admin-panel-main" aria-selected="false" tabindex="-1">States</button>', 'id="admin-tab-states" aria-controls="admin-panel-main" aria-selected="false" tabindex="-1"><%= t(\'site.adminPage.states\') %></button>'],
        ['<span class="admin-add-user-label">Add user</span>', '<span class="admin-add-user-label"><%= t(\'site.adminPage.addUser\') %></span>'],
        ['<span class="admin-add-user-label">Generate</span>', '<span class="admin-add-user-label"><%= t(\'site.adminPage.generate\') %></span>'],
    ]);

    patch("src/views/active-games-list.ejs", [
        ["Active games", "<%= t('site.activeGamesList.title') %>"],
        ["All games in progress", "<%= t('site.activeGamesList.tagline') %>"],
        ["Live games", "<%= t('site.activeGamesList.liveGames') %>"],
        [">Live</span>", "><%= t('site.welcome.live') %></span>"],
        [">Game</th>", "><%= t('site.activeGamesList.game') %></th>"],
        [">Started</th>", "><%= t('site.activeGamesList.started') %></th>"],
        [">Moves</th>", "><%= t('site.activeGames.moves') %></th>"],
        [">Status</th>", "><%= t('site.activeGames.status') %></th>"],
        ["No games at the moment", "<%= t('site.welcome.noGamesNow') %>"],
    ]);

    patch("src/views/list.ejs", [
        ["All Games", "<%= t('site.list.title') %>"],
        [">Action</th>", "><%= t('site.list.action') %></th>"],
        [">Delete</a>", "><%= t('common.delete') %></a>"],
        ["No completed games yet", "<%= t('site.welcome.noCompleted') %>"],
    ]);

    patch("src/views/mobile-game.ejs", [
        ['class="mobile-moves-panel__title">Moves</h2>', 'class="mobile-moves-panel__title"><%= t(\'site.mobileGame.moves\') %></h2>'],
        [">White</th>", "><%= t('common.white') %></th>"],
        [">Black</th>", "><%= t('common.black') %></th>"],
    ]);

    patch("src/views/mobile-review.ejs", [
        ['class="mobile-moves-panel__title">Moves</h2>', 'class="mobile-moves-panel__title"><%= t(\'site.mobileGame.moves\') %></h2>'],
        [">White</th>", "><%= t('common.white') %></th>"],
        [">Black</th>", "><%= t('common.black') %></th>"],
    ]);

    patch("src/views/partials/home-friends-welcome.ejs", [
        ['<h3 class="panel-title">Friends</h3>', '<h3 class="panel-title"><%= t(\'site.friends\') %></h3>'],
    ]);

    patch("src/views/layouts/boilerplate.ejs", [
        ["<title>Chessboard</title>", "<title><%= t('play.appTitle') %></title>"],
    ]);
}

function patchDesktopChrome() {
    let s = read("src/desktop/ui/desktop-chrome.js");
    s = s
        .split('<span class="desktop-theme-name">Blue</span>')
        .join('<span class="desktop-theme-name">\' + t("desktop.chrome.themeBlue") + \'</span>')
        .split('<span class="desktop-theme-name">Dark</span>')
        .join('<span class="desktop-theme-name">\' + t("desktop.chrome.themeDark") + \'</span>')
        .split("Customize theme…")
        .join('" + t("desktop.chrome.customizeTheme") + "')
        .split('aria-label="Built-in themes"')
        .join('aria-label="\' + t("desktop.chrome.builtInThemesAria") + \'"')
        .split('aria-label="Saved custom themes"')
        .join('aria-label="\' + t("desktop.chrome.savedCustomThemesAria") + \'"')
        .split('aria-label="Piece sets"')
        .join('aria-label="\' + t("desktop.chrome.pieceSetsAria") + \'"')
        .split('aria-label="Shmerling Chess home"')
        .join('aria-label="\' + t("desktop.chrome.homeAria") + \'"');
    write("src/desktop/ui/desktop-chrome.js", s);
}

function patchServerValidations() {
    let s = read("src/serverValidations.js");
    if (!s.includes('require("./strings")')) {
        s = s.replace(
            'const BaseJoi = require("joi");',
            'const BaseJoi = require("joi");\nconst { t } = require("./strings");',
        );
        s = s.replace(
            'messages: { "string.escapeHTML": "{{#label}} must not include HTML." },',
            'messages: { "string.escapeHTML": t("validation.noHtml").replace(/\\{\\{label\\}\\}/g, "{{#label}}") },',
        );
        write("src/serverValidations.js", s);
    }
}

patchFriendsEjs();
patchChessboardFinish();
patchRemainingEjs();
patchDesktopChrome();
patchServerValidations();
console.log("i18n finish pass complete");
