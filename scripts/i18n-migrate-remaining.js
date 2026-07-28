#!/usr/bin/env node
/**
 * Applies i18n migrations to chessboard.js, EJS views, and misc JS files.
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

function patchChessboard() {
    let s = read("src/chessboard.js");

    if (!s.includes("function t(key, params)")) {
        s = s.replace(
            "/*global axios, ChessGame*/",
            `/*global axios, ChessGame, ShmerlingT*/
function t(key, params) {
    if (typeof ShmerlingT === "function") {
        return ShmerlingT(key, params);
    }
    return key;
}`,
        );
    }

    s = s.replace(
        /const Labels = \{[\s\S]*?\};/,
        `const Labels = {
    get LOAD_GAME() { return t("classic.loadGame"); },
    get LOAD() { return t("classic.load"); },
    get ENTER_GAME_STATE() { return t("classic.enterGameState"); },
    get CANCEL() { return t("common.cancel"); },
    get YES() { return t("common.yes"); },
    get NO() { return t("common.no"); },
    get REMATCH() { return t("classic.rematch"); },
    get RESIGN() { return t("play.actions.resign"); },
    get DRAW() { return t("classic.drawOffer"); },
    get UNDO() { return t("play.actions.undo"); },
    get REDO() { return t("play.actions.redo"); },
    get LAST_MOVE() { return t("classic.lastMove"); },
    get HOME() { return t("play.actions.exit"); },
    get FLIP() { return t("play.actions.flip"); },
    get BOOKMARKS() { return t("classic.bookmarks"); },
    get OK() { return t("common.ok"); },
    get BOOKMARK_ALERT_TITLE() { return t("classic.bookmarkAlertTitle"); },
};`,
    );

    s = s.replace(
        /function getResearchBookmarkPositionValidationMessage\(purpose\) \{[\s\S]*?\n\}/,
        `function getResearchBookmarkPositionValidationMessage(purpose) {
    const api = typeof ShmerlingPositionValidation !== "undefined"
        ? ShmerlingPositionValidation
        : null;
    if (!api || typeof api.getMessage !== "function") {
        return null;
    }
    const mapped =
        purpose === "save" ? "saveBookmark" : purpose === "add" ? "addBookmark" : purpose;
    return api.getMessage(game, mapped);
}`,
    );

    const displayReplacements = [
        ['displayMessage("Promotion!")', 'displayMessage(t("classic.promotion"))'],
        ['displayMessage("Check", 2000)', 'displayMessage(t("classic.check"), 2000)'],
        [
            "displayMessage(`Checkmate! ${game.colorName(turn)} wins!`, 5000)",
            'displayMessage(t("classic.checkmateWins", { winner: game.colorName(turn) }), 5000)',
        ],
        [
            "displayMessage(`Draw! ${reason}`, 5000)",
            'displayMessage(t("classic.drawReason", { reason: reason }), 5000)',
        ],
        [
            'displayMessage("The opponent disconnected")',
            'displayMessage(t("classic.opponentDisconnected"))',
        ],
        [
            "displayMessage(`The opponent resigned, ${winner} wins `)",
            'displayMessage(t("classic.opponentResignedWins", { winner: winner }))',
        ],
        [
            'displayMessage("Something went wrong")',
            'displayMessage(t("classic.somethingWentWrong"))',
        ],
        [
            'displayMessage(name + " rejoined")',
            'displayMessage(t("classic.playerRejoined", { name: name }))',
        ],
        [
            'displayMessage("A player rejoined")',
            'displayMessage(t("classic.aPlayerRejoined"))',
        ],
        [
            'displayMessage("The opponent rejoined")',
            'displayMessage(t("classic.opponentRejoined"))',
        ],
        [
            'displayMessage("Rematch offer accepted")',
            'displayMessage(t("classic.rematchOfferAccepted"))',
        ],
        [
            'displayMessage("Rematch offer declined")',
            'displayMessage(t("classic.rematchOfferDeclined"))',
        ],
        [
            'displayMessage(side + " offers draw")',
            'displayMessage(t("classic.sideOffersDraw", { side: side }))',
        ],
        [
            'displayMessage("Draw offer declined")',
            'displayMessage(t("classic.drawOfferDeclined"))',
        ],
        [
            'displayMessage(watcherName + " is watching the game")',
            'displayMessage(t("classic.watcherWatching", { name: watcherName }))',
        ],
        [
            'displayMessage("Draw offer sent")',
            'displayMessage(t("classic.drawOfferSent"))',
        ],
        [
            'displayMessage("Rematch offer sent")',
            'displayMessage(t("classic.rematchOfferSent"))',
        ],
        [
            'displayMessage("New Game Started")',
            'displayMessage(t("classic.newGameStarted"))',
        ],
        [
            'displayMessage("Game Over")',
            'displayMessage(t("classic.gameOver"))',
        ],
        [
            'displayMessage("Game cancelled")',
            'displayMessage(t("classic.gameCancelled"))',
        ],
        [
            'displayMessage(`You resigned, ${!currentPlayerIsWhite ? "White" : "Black"} wins `)',
            'displayMessage(t("classic.youResignedWins", { winner: !currentPlayerIsWhite ? t("common.white") : t("common.black") }))',
        ],
        [
            'displayMessage(humanHasMoved ? `You resigned, ${!currentPlayerIsWhite ? "White" : "Black"} wins ` : "Game cancelled")',
            'displayMessage(humanHasMoved ? t("classic.youResignedWins", { winner: !currentPlayerIsWhite ? t("common.white") : t("common.black") }) : t("classic.gameCancelled"))',
        ],
        [
            'displayMessage(`Time\'s up! ${loser} lost`)',
            'displayMessage(t("play.status.timesUpLost", { loser: loser }))',
        ],
        [
            'displayMessage("Moves copied to clipboard!")',
            'displayMessage(t("classic.movesCopied"))',
        ],
        [
            'displayMessage("Failed to copy moves")',
            'displayMessage(t("classic.failedCopyMoves"))',
        ],
        [
            'alertMessageBox("Failed to load brain config.")',
            'alertMessageBox(t("classic.failedLoadBrainConfig"))',
        ],
        [
            'alertMessageBox("Failed to save brain config.")',
            'alertMessageBox(t("classic.failedSaveBrainConfig"))',
        ],
        [
            'messageBox("Offer a Draw?", offerDraw, offerCanceled)',
            'messageBox(t("classic.offerDrawConfirm"), offerDraw, offerCanceled)',
        ],
        [
            'messageBox("Opponent sent a draw offer, accept?", acceptDraw, declineDraw)',
            'messageBox(t("classic.drawOfferAccept"), acceptDraw, declineDraw)',
        ],
        [
            'messageBox("Opponenet offer a rematch, agree?", acceptRematch, declineRematch)',
            'messageBox(t("classic.rematchOfferAccept"), acceptRematch, declineRematch)',
        ],
    ];

    for (const [from, to] of displayReplacements) {
        s = s.split(from).join(to);
    }

    s = s.replace(
        /const MOBILE_OPT_CAPTION = \{[\s\S]*?\};/,
        `const MOBILE_OPT_CAPTION = {
    get resign() { return t("classic.mobileResign"); },
    get rematch() { return t("classic.mobileRematch"); },
    get draw() { return t("classic.mobileDraw"); },
    get flip() { return t("classic.mobileFlip"); },
    get lastMove() { return t("classic.mobileLastMove"); },
    get movesList() { return t("classic.mobileMovesList"); },
};`,
    );

    write("src/chessboard.js", s);
}

function patchEjsFile(rel, replacements) {
    let s = read(rel);
    for (const [from, to] of replacements) {
        if (!s.includes(from)) {
            console.warn("skip missing in", rel, from.slice(0, 40));
            continue;
        }
        s = s.split(from).join(to);
    }
    write(rel, s);
}

function patchEjsViews() {
    const common = [
        ['aria-label="Home"', 'aria-label="<%= t(\'site.homeAria\') %>"'],
        [">Home</a>", "><%= t('site.home') %></a>"],
        [">Search</a>", "><%= t('site.search') %></a>"],
        [">Friends</a>", "><%= t('site.friends') %></a>"],
        [">Groups</a>", "><%= t('site.groups') %></a>"],
        [">Debug</a>", "><%= t('site.debug') %></a>"],
        [">Account</button>", "><%= t('site.account') %></button>"],
        [">Preferences</button>", "><%= t('site.preferences') %></button>"],
        [">Administrate</a>", "><%= t('site.administrate') %></a>"],
        [">Log out</a>", "><%= t('site.logOut') %></a>"],
        ["> Log out </a>", "> <%= t('site.logOut') %> </a>"],
        ["> Log in </a>", "> <%= t('site.logIn') %> </a>"],
        ["> Admin </a>", "> <%= t('site.admin') %> </a>"],
        ['>Confirm</h3>', "><%= t('site.confirm') %></h3>"],
        ['>Cancel</button>', "><%= t('site.cancel') %></button>"],
        ['>Notice</h3>', "><%= t('site.notice') %></h3>"],
        ['>OK</button>', "><%= t('site.ok') %></button>"],
    ];

    patchEjsFile("src/views/partials/topbar.ejs", common);
    patchEjsFile("src/views/partials/site-dialogs.ejs", [
        ['>Confirm</h3>', "><%= t('site.confirm') %></h3>"],
        ['>Cancel</button>', "><%= t('site.cancel') %></button>"],
        ['>Notice</h3>', "><%= t('site.notice') %></h3>"],
        ['>OK</button>', "><%= t('site.ok') %></button>"],
    ]);

    patchEjsFile("src/views/welcome.ejs", [
        ['alt="Shmerling Chess Club"', 'alt="<%= t(\'play.appTitle\') %>"'],
        ["Welcome Back", "<%= t('site.welcome.greeting') %>"],
        ["Your move awaits", "<%= t('site.welcome.tagline') %>"],
        [">Play Now!</span>", "><%= t('site.welcome.playNow') %></span>"],
        ["Active Games", "<%= t('site.welcome.activeGames') %>"],
        [">Live</span>", "><%= t('site.welcome.live') %></span>"],
        ['title="View all active games"', 'title="<%= t(\'site.welcome.viewAllActive\') %>"'],
        [">Show All</a>", "><%= t('site.welcome.showAll') %></a>"],
        ["Most recent first", "<%= t('site.welcome.mostRecent') %>"],
        ['aria-label="Active games"', 'aria-label="<%= t(\'site.welcome.activeGamesAria\') %>"'],
        ["No games at the moment", "<%= t('site.welcome.noGamesNow') %>"],
        ["My Games", "<%= t('site.welcome.myGames') %>"],
        ['title="View All Games"', 'title="<%= t(\'site.welcome.viewAllGames\') %>"'],
        ["Your recent completed games", "<%= t('site.welcome.recentCompleted') %>"],
        ["No completed games yet", "<%= t('site.welcome.noCompleted') %>"],
    ]);

    patchEjsFile("src/views/login.ejs", [
        ["Username:", "<%= t('site.username') %>"],
        ["Password:", "<%= t('site.password') %>"],
        [">Login</button>", "><%= t('site.login') %></button>"],
    ]);

    patchEjsFile("src/views/register.ejs", [
        ["Username:", "<%= t('site.username') %>"],
        ["Password:", "<%= t('site.password') %>"],
        ["Email:", "<%= t('site.email') %>"],
        [">Register</button>", "><%= t('site.register') %></button>"],
    ]);
}

function patchMisc() {
    let form = read("src/formValidations.js");
    if (!form.includes("ShmerlingT")) {
        form =
            `(function () {
    function t(key, params) {
        if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
            return window.ShmerlingStrings.t(key, params);
        }
        return key;
    }
` + form.slice(form.indexOf("\n") + 1);
    }
    const formReplacements = [
        ['"Please fill in a valid email"', 't("validation.validEmail")'],
        ['"Please ensure Password fields are identical."', 't("validation.passwordsMustMatch")'],
        ['"Please choose a username"', 't("validation.chooseUsername")'],
        ['"This username is not available"', 't("validation.usernameNotAvailable")'],
        ['"Password must not contain Whitespaces."', 't("validation.passwordNoWhitespace")'],
        ['"Password must have at least one Uppercase Character."', 't("validation.passwordUppercase")'],
        ['"Password must have at least one Lowercase Character."', 't("validation.passwordLowercase")'],
        ['"Password must contain at least one Digit."', 't("validation.passwordDigit")'],
        ['"Password must contain at least one Special Symbol."', 't("validation.passwordSymbol")'],
        ['"Password must be 8-30 Characters Long."', 't("validation.passwordLength")'],
    ];
    for (const [from, to] of formReplacements) {
        form = form.split(from).join(to);
    }
    write("src/formValidations.js", form);

    let active = read("src/activeGamesHome.js");
    if (!active.includes("ShmerlingT")) {
        active = active.replace(
            '(function () {\n    "use strict";',
            `(function () {
    "use strict";

    function t(key, params) {
        if (typeof ShmerlingT === "function") {
            return ShmerlingT(key, params);
        }
        return key;
    }`,
        );
    }
    active = active
        .split('first.whitePlayerName || "White"')
        .join('first.whitePlayerName || t("common.white")')
        .split('first.blackPlayerName || "Black"')
        .join('first.blackPlayerName || t("common.black")')
        .split('<span class="active-meta-label">Moves</span>')
        .join('<span class="active-meta-label">\' + t("site.activeGames.moves") + \'</span>')
        .split('<span class="active-meta-label">Turn</span>')
        .join('<span class="active-meta-label">\' + t("site.activeGames.turn") + \'</span>')
        .split('<span class="active-meta-label">Status</span>')
        .join('<span class="active-meta-label">\' + t("site.activeGames.status") + \'</span>')
        .split('first.Status || "In progress"')
        .join('first.Status || t("site.activeGames.inProgress")')
        .split('var turn = first.turn === "black" ? "Black" : "White";')
        .join('var turn = first.turn === "black" ? t("common.black") : t("common.white");');
    write("src/activeGamesHome.js", active);

    let controller = read("src/modules/user/controller.js");
    if (!controller.includes("require(\"../../strings\")")) {
        controller = controller.replace(
            /^/,
            'const { t } = require("../../strings");\n',
        );
    }
    controller = controller
        .split('"Wrong username or password"')
        .join('t("auth.wrongCredentials")')
        .split('"User added Successfully"')
        .join('t("auth.userAdded")')
        .split('"Could not save bookmark"')
        .join('t("auth.couldNotSaveBookmark")')
        .split('"Invalid user id"')
        .join('t("auth.invalidUserId")');
    write("src/modules/user/controller.js", controller);

    let play = read("src/desktop/ui/desktop-play.js");
    play = play
        .split('message: "Draw offers are not available when playing against the engine."')
        .join('message: t("classic.drawOffersNotVsEngine")')
        .split('title: "Rematch",')
        .join('title: t("play.status.rematchTitle"),');
    write("src/desktop/ui/desktop-play.js", play);
}

function patchLayouts() {
    const snippet =
        '  <script src="/strings/en-extra.js"></script>\n  <script src="/app/strings/en-extra.js"></script>\n';
    for (const rel of [
        "src/views/layouts/boilerplate.ejs",
        "src/views/layouts/mobile-welcome-boilerplate.ejs",
        "src/views/layouts/mobile-game-boilerplate.ejs",
        "src/desktop/ui/play.html",
    ]) {
        let s = read(rel);
        if (s.includes("en-extra.js")) {
            continue;
        }
        s = s.replace(
            /(<script src="\/strings\/en\.js"><\/script>\n)/,
            '$1  <script src="/strings/en-extra.js"></script>\n',
        );
        s = s.replace(
            /(<script src="\/app\/strings\/en\.js"><\/script>\n)/,
            '$1  <script src="/app/strings/en-extra.js"></script>\n',
        );
        write(rel, s);
    }
}

patchChessboard();
patchEjsViews();
patchMisc();
patchLayouts();
console.log("i18n migration complete");
