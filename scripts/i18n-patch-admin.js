#!/usr/bin/env node
/**
 * Localize admin.ejs + admin-generate-state.ejs user-facing strings.
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function write(rel, s) {
    fs.writeFileSync(path.join(ROOT, rel), s, "utf8");
    console.log("updated", rel);
}

function patchAdmin() {
    let s = fs.readFileSync(path.join(ROOT, "src/views/admin.ejs"), "utf8");

    s = s
        .replace('aria-label="Admin sections"', 'aria-label="<%= t(\'site.adminPage.sectionsAria\') %>"')
        .replace(
            /Opening book:\s*\n\s*<strong><%= typeof openingBookEntryCount !== 'undefined' \? openingBookEntryCount : 0 %><\/strong>\s*\n\s*game lines/,
            `<%= t('site.adminPage.openingBookLabel') %>
            <strong><%= typeof openingBookEntryCount !== 'undefined' ? openingBookEntryCount : 0 %></strong>
            <%= t('site.adminPage.gameLines') %>`,
        )
        .replace("<p>No games in the database yet.</p>", "<p><%= t('site.adminPage.noGamesInDb') %></p>")
        .replace('aria-label="Games pagination"', 'aria-label="<%= t(\'site.adminPage.gamesPaginationAria\') %>"')
        .replace(
            `<tr id="admin-table-head-row">
                  <th>#</th>
                  <th>Username</th>
                  <th>Type</th>
                  <th>Email</th>
                  <th>Password</th>
                  <th>Level</th>
                  <th>Elo</th>
                  <th>Joined</th>
                  <th>Last login</th>
                  <th>Active games</th>
                  <th>Friends</th>
                  <th>Bookmarks</th>
                </tr>`,
            `<tr id="admin-table-head-row">
                  <th><%= t('site.adminPage.colNum') %></th>
                  <th><%= t('site.adminPage.colUsername') %></th>
                  <th><%= t('site.adminPage.colType') %></th>
                  <th><%= t('site.adminPage.colEmail') %></th>
                  <th><%= t('site.adminPage.colPassword') %></th>
                  <th><%= t('site.adminPage.colLevel') %></th>
                  <th><%= t('site.adminPage.colElo') %></th>
                  <th><%= t('site.adminPage.colJoined') %></th>
                  <th><%= t('site.adminPage.colLastLogin') %></th>
                  <th><%= t('site.adminPage.colActiveGames') %></th>
                  <th><%= t('site.adminPage.colFriends') %></th>
                  <th><%= t('site.adminPage.colBookmarks') %></th>
                </tr>`,
        );

    if (!s.includes("function t(key, params)")) {
        s = s.replace(
            "  (function () {\n    var ADMIN_TAB_CONFIG = [",
            `  (function () {
    function t(key, params) {
      if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
        return window.ShmerlingStrings.t(key, params);
      }
      return key;
    }
    var ADMIN_TAB_CONFIG = [`,
        );
    }

    s = s.replace(
        `var ADMIN_TAB_CONFIG = [
      {
        headers: ["#", "Username", "Type", "Email", "Password", "Level", "Elo", "Joined", "Last login", "Active games", "Friends", "Bookmarks"],
        emptyMsg: "No users yet."
      },
      { headers: ["#", "Id", "Type", "Status"], emptyMsg: "No data yet." },
      { headers: ["#", "Name", "Available", "Notes"], emptyMsg: "No data yet." },
      { headers: ["Note"], emptyMsg: "Use Generate to open the opening-book and state generation page." }
    ];`,
        `var ADMIN_TAB_CONFIG = [
      {
        headers: [
          t("site.adminPage.colNum"),
          t("site.adminPage.colUsername"),
          t("site.adminPage.colType"),
          t("site.adminPage.colEmail"),
          t("site.adminPage.colPassword"),
          t("site.adminPage.colLevel"),
          t("site.adminPage.colElo"),
          t("site.adminPage.colJoined"),
          t("site.adminPage.colLastLogin"),
          t("site.adminPage.colActiveGames"),
          t("site.adminPage.colFriends"),
          t("site.adminPage.colBookmarks")
        ],
        emptyMsg: t("site.adminPage.emptyUsers")
      },
      {
        headers: [t("site.adminPage.colNum"), t("site.adminPage.colId"), t("site.adminPage.colType"), t("site.adminPage.colStatus")],
        emptyMsg: t("site.adminPage.emptyData")
      },
      {
        headers: [t("site.adminPage.colNum"), t("site.adminPage.colName"), t("site.adminPage.colAvailable"), t("site.adminPage.colNotes")],
        emptyMsg: t("site.adminPage.emptyData")
      },
      {
        headers: [t("site.adminPage.colNote")],
        emptyMsg: t("site.adminPage.emptyStates")
      }
    ];`,
    );

    const pairs = [
        ['label.setAttribute("title", "Click to edit");', 'label.setAttribute("title", t("site.adminPage.clickToEdit"));'],
        ['var msg = "Update failed";', 'var msg = t("site.adminPage.updateFailed");'],
        ['var errMsg = "Update failed";', 'var errMsg = t("site.adminPage.updateFailed");'],
        ['showSiteAlert(msg, "Could not save")', 'showSiteAlert(msg, t("site.adminPage.couldNotSave"))'],
        ['showSiteAlert(errMsg, "Could not save")', 'showSiteAlert(errMsg, t("site.adminPage.couldNotSave"))'],
        ['label.setAttribute("title", "Click to set a new password (4–30 characters)");', 'label.setAttribute("title", t("site.adminPage.setPasswordTitle"));'],
        ['label.textContent = "Set password";', 'label.textContent = t("site.adminPage.setPassword");'],
        [
            'showSiteAlert("Password must be between 4 and 30 characters.", "Invalid password")',
            'showSiteAlert(t("site.adminPage.passwordLengthInvalid"), t("site.adminPage.invalidPassword"))',
        ],
        ['label.textContent = "Saved";', 'label.textContent = t("site.adminPage.saved");'],
        ['inp.placeholder = "New password";', 'inp.placeholder = t("site.adminPage.newPasswordPlaceholder");'],
        [
            'var PLAYER_LEVELS = ["Rookie", "Skilled", "Elite", "Grand Master"];',
            'var PLAYER_LEVELS = [t("site.register.rookie"), t("site.register.skilled"), t("site.register.elite"), t("site.register.grandMaster")];',
        ],
        [
            'var USER_TYPES = ["Admin", "Partner", "Member"];',
            'var USER_TYPES = [t("site.adminPage.userTypeAdmin"), t("site.adminPage.userTypePartner"), t("site.adminPage.userTypeMember")];',
        ],
        [': "Member",', ': t("site.adminPage.userTypeMember"),'],
        ['label.setAttribute("title", "Click to change user type");', 'label.setAttribute("title", t("site.adminPage.clickChangeUserType"));'],
        ['sel.setAttribute("aria-label", "User type");', 'sel.setAttribute("aria-label", t("site.adminPage.userTypeAria"));'],
        [
            `var msg = newType === "Admin"
            ? "Grant admin privileges to this user? They will be able to access admin tools and manage accounts."
            : state.userType === "Admin"
              ? "Change this user from Admin to " + newType + "? They will lose access to the admin area."
              : "Change this user to " + newType + "?";
          showSiteConfirm(msg, { title: "Change user type" })`,
            `var msg = newType === t("site.adminPage.userTypeAdmin")
            ? t("site.adminPage.grantAdminConfirm")
            : state.userType === t("site.adminPage.userTypeAdmin")
              ? t("site.adminPage.demoteAdminConfirm", { type: newType })
              : t("site.adminPage.changeUserTypeConfirm", { type: newType });
          showSiteConfirm(msg, { title: t("site.adminPage.changeUserTypeTitle") })`,
        ],
        ['label.setAttribute("title", "Click to change level");', 'label.setAttribute("title", t("site.adminPage.clickChangeLevel"));'],
        ['sel.setAttribute("aria-label", "Player level");', 'sel.setAttribute("aria-label", t("site.adminPage.playerLevelAria"));'],
        ['attachRoleDropdown(tdRole, u.id, u.userType || (u.admin ? "Admin" : "Member"));', 'attachRoleDropdown(tdRole, u.id, u.userType || (u.admin ? t("site.adminPage.userTypeAdmin") : t("site.adminPage.userTypeMember")));'],
        ['link(1, "First");', 'link(1, t("site.adminPage.first"));'],
        [
            'link(prev10Page, "<img src=\\"/images/prev.png\\" alt=\\"Previous\\">", "pageNavIcon pageNavStep10", "Previous 10 pages");',
            'link(prev10Page, "<img src=\\"/images/prev.png\\" alt=\\"" + t("site.adminPage.previous") + "\\">", "pageNavIcon pageNavStep10", t("site.adminPage.previous10Pages"));',
        ],
        [
            'link(prev5Page, "<img src=\\"/images/prev.png\\" alt=\\"Previous\\">", "pageNavIcon pageNavStep5", "Previous 5 pages");',
            'link(prev5Page, "<img src=\\"/images/prev.png\\" alt=\\"" + t("site.adminPage.previous") + "\\">", "pageNavIcon pageNavStep5", t("site.adminPage.previous5Pages"));',
        ],
        [
            'link(next5Page, "<img src=\\"/images/next.png\\" alt=\\"Next\\">", "pageNavIcon pageNavStep5", "Next 5 pages");',
            'link(next5Page, "<img src=\\"/images/next.png\\" alt=\\"" + t("site.adminPage.next") + "\\">", "pageNavIcon pageNavStep5", t("site.adminPage.next5Pages"));',
        ],
        [
            'link(next10Page, "<img src=\\"/images/next.png\\" alt=\\"Next\\">", "pageNavIcon pageNavStep10", "Next 10 pages");',
            'link(next10Page, "<img src=\\"/images/next.png\\" alt=\\"" + t("site.adminPage.next") + "\\">", "pageNavIcon pageNavStep10", t("site.adminPage.next10Pages"));',
        ],
        ['link(totalPages, "Last");', 'link(totalPages, t("site.adminPage.last"));'],
        ['thNum.title = "Sort by row number";', 'thNum.title = t("site.adminPage.sortByRowNumber");'],
        [
            'thNum.innerHTML = "<span class=\\"th-label\\">#</span><span class=\\"sort-icon\\" aria-hidden=\\"true\\"></span>";',
            'thNum.innerHTML = "<span class=\\"th-label\\">" + t("site.adminPage.colNum") + "</span><span class=\\"sort-icon\\" aria-hidden=\\"true\\"></span>";',
        ],
        ['th.title = "Sort by " + trimKey;', 'th.title = t("site.adminPage.sortBy", { key: trimKey });'],
        ['thAct.textContent = "Action";', 'thAct.textContent = t("site.adminPage.colAction");'],
        ['a.textContent = "Delete";', 'a.textContent = t("site.adminPage.delete");'],
    ];

    for (const [from, to] of pairs) {
        if (!s.includes(from)) {
            console.warn("skip missing:", from.slice(0, 60));
            continue;
        }
        s = s.split(from).join(to);
    }

    write("src/views/admin.ejs", s);
}

function patchGenerate() {
    let s = fs.readFileSync(path.join(ROOT, "src/views/admin-generate-state.ejs"), "utf8");

    s = s
        .replace(
            "<h2 class=\"panel-title\">Opening book &amp; state generation</h2>",
            "<h2 class=\"panel-title\"><%= t('site.adminPage.generateTitle') %></h2>",
        )
        .replace(
            '<a href="/admin" class="admin-generate-state-link-back">← Back to admin</a>',
            '<a href="/admin" class="admin-generate-state-link-back"><%= t(\'site.adminPage.backToAdmin\') %></a>',
        )
        .replace(
            /<p class="admin-generate-state-intro">[\s\S]*?<\/p>/,
            `<p class="admin-generate-state-intro"><%= t('site.adminPage.generateIntro') %></p>`,
        )
        .replace(
            '<legend class="admin-generate-state-legend">Target</legend>',
            '<legend class="admin-generate-state-legend"><%= t(\'site.adminPage.target\') %></legend>',
        )
        .replace(
            "<span>MongoDB — append rows to the <code>State</code> collection</span>",
            "<span><%= t('site.adminPage.targetMongo') %></span>",
        )
        .replace(
            "<span>Line file — write opening book (<code>opening-book-lines.txt</code>)</span>",
            "<span><%= t('site.adminPage.targetBook') %></span>",
        )
        .replace(">Start generation</button>", "><%= t('site.adminPage.startGeneration') %></button>")
        .replace(">Stop</button>", "><%= t('site.adminPage.stop') %></button>")
        .replace(">Idle.</div>", "><%= t('site.adminPage.idle') %></div>");

    if (!s.includes("function t(key, params)")) {
        s = s.replace(
            "(function () {\n  var statusEl",
            `(function () {
  function t(key, params) {
    if (window.ShmerlingStrings && typeof window.ShmerlingStrings.t === "function") {
      return window.ShmerlingStrings.t(key, params);
    }
    return key;
  }
  var statusEl`,
        );
    }

    const pairs = [
        ['statusEl.textContent = "Starting…";', 'statusEl.textContent = t("site.adminPage.starting");'],
        [
            'statusEl.textContent = "Running (" + data.mode + ")…";',
            'statusEl.textContent = t("site.adminPage.running", { mode: data.mode });',
        ],
        [
            'logLine("Reading " + data.fileCount + " file(s)…");',
            'logLine(t("site.adminPage.readingFiles", { count: data.fileCount }));',
        ],
        [
            'logLine("Replaying " + data.totalGames + " games…");',
            'logLine(t("site.adminPage.replayingGames", { count: data.totalGames }));',
        ],
        [
            'statusEl.textContent = data.message || "Writing opening book…";',
            'statusEl.textContent = data.message || t("site.adminPage.writingOpeningBook");',
        ],
        [
            'statusEl.textContent = "Reading PGN " + data.fileIndex + " / " + data.fileTotal + " (" + (data.gamesLoaded || 0) + " games)";',
            'statusEl.textContent = t("site.adminPage.readingPgn", { index: data.fileIndex, total: data.fileTotal, games: data.gamesLoaded || 0 });',
        ],
        [
            'statusEl.textContent = "Replay game " + data.current + " / " + data.total + " (completed ok: " + data.gamesCompleted + ")";',
            'statusEl.textContent = t("site.adminPage.replayGameProgress", { current: data.current, total: data.total, completed: data.gamesCompleted });',
        ],
        ['var parts = ["Stopped."];', 'var parts = [t("site.adminPage.stopped")];'],
        [
            'parts.push("Existing opening book was not modified.");',
            'parts.push(t("site.adminPage.bookUnchanged"));',
        ],
        [
            'parts.push(data.entryCount + " game line(s) in " + (data.file || "opening book") + ".");',
            'parts.push(t("site.adminPage.bookLinesInFile", { count: data.entryCount, file: data.file || t("site.adminPage.openingBookDefault") }));',
        ],
        [
            'parts.push("Cancelled before reading PGNs.");',
            'parts.push(t("site.adminPage.cancelledBeforeRead"));',
        ],
        [
            'parts.push("Cancelled after read; replay was skipped (nothing written).");',
            'parts.push(t("site.adminPage.cancelledAfterRead"));',
        ],
        [
            'parts.push(data.gamesCompleted + " game(s) had new state rows saved.");',
            'parts.push(t("site.adminPage.mongoGamesSaved", { count: data.gamesCompleted }));',
        ],
        [
            'statusEl.textContent = "Done. " + (data.entryCount != null ? data.entryCount + " game lines → " : "") + (data.file || "opening book");',
            `statusEl.textContent = data.entryCount != null
              ? t("site.adminPage.doneBook", { count: data.entryCount, file: data.file || t("site.adminPage.openingBookDefault") })
              : t("site.adminPage.doneBookFileOnly", { file: data.file || t("site.adminPage.openingBookDefault") });`,
        ],
        [
            `statusEl.textContent = "Done. MongoDB State collection updated"
              + (data.gamesCompleted != null ? " (" + data.gamesCompleted + " games replayed ok)" : "") + ".";`,
            `statusEl.textContent = t("site.adminPage.doneMongo", {
                detail: data.gamesCompleted != null
                  ? t("site.adminPage.doneMongoDetail", { count: data.gamesCompleted })
                  : ""
              });`,
        ],
        [
            'statusEl.textContent = "Error: " + (data.message || "Unknown");',
            'statusEl.textContent = t("site.adminPage.errorPrefix", { message: data.message || t("site.adminPage.unknownError") });',
        ],
        [
            'statusEl.textContent = "Connection closed (check server logs or try again).";',
            'statusEl.textContent = t("site.adminPage.connectionClosed");',
        ],
    ];

    for (const [from, to] of pairs) {
        if (!s.includes(from)) {
            console.warn("generate skip:", from.slice(0, 60));
            continue;
        }
        s = s.split(from).join(to);
    }

    write("src/views/admin-generate-state.ejs", s);
}

patchAdmin();
patchGenerate();
console.log("admin i18n patch done");
