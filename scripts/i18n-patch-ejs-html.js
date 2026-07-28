#!/usr/bin/env node
/** Patch remaining EJS templates and HTML shells for i18n. */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function patch(rel, pairs) {
    const file = path.join(ROOT, rel);
    let s = fs.readFileSync(file, "utf8");
    let changed = false;
    for (const [from, to] of pairs) {
        if (!s.includes(from)) continue;
        s = s.split(from).join(to);
        changed = true;
    }
    if (changed) {
        fs.writeFileSync(file, s);
        console.log("patched", rel);
    }
}

patch("src/views/game.ejs", [
    [">Bookmarks</div>", "><%= t('classic.bookmarks') %></div>"],
    [">Bookmark</button>", "><%= t('classic.bookmarkAlertTitle') %></button>"],
    [">White</th>", "><%= t('common.white') %></th>"],
    [">Black</th>", "><%= t('common.black') %></th>"],
]);

patch("src/views/mobile-welcome.ejs", [
    [">Play</button>", "><%= t('site.mobileWelcome.play') %></button>"],
    [">Library</button>", "><%= t('site.mobileWelcome.library') %></button>"],
    [">Friends</button>", "><%= t('site.mobileWelcome.friends') %></button>"],
    ["Home — Chess", "<%= t('site.mobileWelcome.title') %>"],
]);

patch("src/views/mobile-game.ejs", [
    [">Moves</span>", "><%= t('site.mobileGame.moves') %></span>"],
    [">Resign</button>", "><%= t('site.mobileGame.resign') %></button>"],
]);

patch("src/views/admin.ejs", [
    [">Users</", "><%= t('site.adminPage.users') %></"],
    [">Administration</", "><%= t('site.adminPage.title') %></"],
]);

patch("src/views/error.ejs", [
    ["An error occurred", "<%= t('site.error.body') %>"],
]);

patch("src/desktop/ui/error.html", [
    ["Something went wrong", "{{TITLE}}"],
    ["An error occurred.", "{{BODY}}"],
    ["Back to main", "{{BACK}}"],
]);

// error.html uses static text - patch with data-i18n approach via script at bottom
let errHtml = fs.readFileSync(path.join(ROOT, "src/desktop/ui/error.html"), "utf8");
if (!errHtml.includes("ShmerlingStrings")) {
    errHtml = errHtml.replace(
        "<title>",
        '<script src="/app/strings/en.js"></script><script src="/app/strings/en-extra.js"></script><script src="/app/strings/index.js"></script><title>',
    );
    errHtml = errHtml.replace(
        "</body>",
        `<script>
(function () {
  var t = window.ShmerlingStrings && window.ShmerlingStrings.t;
  if (!t) return;
  document.title = t("desktop.error.title");
  var h = document.querySelector("h1");
  if (h) h.textContent = t("desktop.error.title");
  var p = document.querySelector("p");
  if (p) p.textContent = t("desktop.error.body");
  var a = document.querySelector("a");
  if (a) a.textContent = t("desktop.error.back");
})();
</script></body>`,
    );
    fs.writeFileSync(path.join(ROOT, "src/desktop/ui/error.html"), errHtml);
    console.log("patched src/desktop/ui/error.html");
}

let logHtml = fs.readFileSync(path.join(ROOT, "desktop/log-window.html"), "utf8");
if (!logHtml.includes("ShmerlingStrings")) {
    logHtml = logHtml.replace(
        "<head>",
        `<head>
  <script src="/strings/en.js"></script>
  <script src="/strings/en-extra.js"></script>
  <script src="/strings/index.js"></script>`,
    );
    logHtml = logHtml.replace(
        "</body>",
        `<script>
(function () {
  var t = window.ShmerlingStrings && window.ShmerlingStrings.t;
  if (!t) return;
  document.title = t("site.log.title");
  var clearBtn = document.getElementById("clearBtn");
  if (clearBtn) clearBtn.textContent = t("site.log.clear");
  var latestBtn = document.getElementById("latestBtn");
  if (latestBtn) latestBtn.textContent = t("site.log.latest");
  var empty = document.getElementById("emptyState");
  if (empty) empty.textContent = t("site.log.waiting");
})();
</script></body>`,
    );
    fs.writeFileSync(path.join(ROOT, "desktop/log-window.html"), logHtml);
    console.log("patched desktop/log-window.html");
}

console.log("EJS/HTML patch pass done");
