const assert = require("assert");
const { JSDOM } = require("jsdom");

const StatusBar = require("../src/play-ui/status-bar");

describe("play-ui status bar", function () {
    describe("defaultStatusText", function () {
        it("guides empty idle board when advanced tools are on", function () {
            assert.strictEqual(
                StatusBar.defaultStatusText({
                    hasGame: true,
                    gameActive: false,
                    boardHasPieces: false,
                    canPlayAdvancedTools: true,
                }),
                "Choose New game or Position setup from the sidebar",
            );
        });

        it("asks for Play settings when a bookmark board is loaded", function () {
            assert.strictEqual(
                StatusBar.defaultStatusText({
                    hasGame: true,
                    gameActive: false,
                    boardHasPieces: true,
                    review: false,
                }),
                "Set move, color, engine, and think time in the header, then press Play",
            );
        });

        it("returns game over / in progress while a match is live", function () {
            assert.strictEqual(
                StatusBar.defaultStatusText({
                    hasGame: true,
                    gameActive: true,
                    gameOver: true,
                }),
                "Game over",
            );
            assert.strictEqual(
                StatusBar.defaultStatusText({
                    hasGame: true,
                    gameActive: true,
                    gameOver: false,
                }),
                "Game in progress",
            );
        });
    });

    describe("renderStatus", function () {
        it("applies event classes and falls back to default text", function () {
            const dom = new JSDOM(
                "<body><div id=\"status\" class=\"desktop-play-status-bar--check\"></div></body>",
            );
            const el = dom.window.document.getElementById("status");

            StatusBar.renderStatus(el, {
                message: "Check",
                kind: "check",
                defaultText: "idle",
            });
            assert.strictEqual(el.textContent, "Check");
            assert.ok(el.classList.contains("desktop-play-status-bar--event"));
            assert.ok(el.classList.contains("desktop-play-status-bar--check"));

            StatusBar.renderStatus(el, { message: null, defaultText: "idle" });
            assert.strictEqual(el.textContent, "idle");
            assert.ok(!el.classList.contains("desktop-play-status-bar--event"));
            assert.ok(!el.classList.contains("desktop-play-status-bar--check"));
        });
    });

    describe("applyClockHighlight / applyMatchHeader", function () {
        it("highlights the side to move unless a non-info alert is active", function () {
            const dom = new JSDOM(`
                <body>
                  <div id="black"></div>
                  <div id="white"></div>
                </body>
            `);
            const black = dom.window.document.getElementById("black");
            const white = dom.window.document.getElementById("white");

            StatusBar.applyClockHighlight(
                { headerBlack: black, headerWhite: white },
                { hasGame: true, gameOver: false, suppressForAlert: false, turn: "white" },
            );
            assert.ok(white.classList.contains("desktop-play-header-clock--active"));
            assert.ok(!black.classList.contains("desktop-play-header-clock--active"));

            StatusBar.applyClockHighlight(
                { headerBlack: black, headerWhite: white },
                { hasGame: true, gameOver: false, suppressForAlert: true, turn: "white" },
            );
            assert.ok(!white.classList.contains("desktop-play-header-clock--active"));
        });

        it("updates match title and player names", function () {
            const dom = new JSDOM(`
                <body>
                  <h1 id="title"></h1>
                  <span id="white"></span>
                  <span id="black"></span>
                </body>
            `);
            StatusBar.applyMatchHeader(
                {
                    titleEl: dom.window.document.getElementById("title"),
                    whiteNameEl: dom.window.document.getElementById("white"),
                    blackNameEl: dom.window.document.getElementById("black"),
                },
                {
                    title: "Play Mode",
                    updateNames: true,
                    whiteName: "Alice",
                    blackName: "Bob",
                },
            );
            assert.strictEqual(dom.window.document.getElementById("title").textContent, "Play Mode");
            assert.strictEqual(dom.window.document.getElementById("white").textContent, "Alice");
            assert.strictEqual(dom.window.document.getElementById("black").textContent, "Bob");
        });
    });

    describe("create", function () {
        it("shows a timed event then restores default text", function () {
            const dom = new JSDOM("<body><div id=\"status\"></div></body>");
            const timers = [];
            const status = StatusBar.create({
                getElement: function () {
                    return dom.window.document.getElementById("status");
                },
                getDefaultText: function () {
                    return "idle";
                },
                timers: {
                    setTimeout: function (fn) {
                        timers.push(fn);
                        return 1;
                    },
                    clearTimeout: function () {},
                },
            });

            status.show("Check", 2000, "check");
            const el = dom.window.document.getElementById("status");
            assert.strictEqual(el.textContent, "Check");
            assert.ok(status.isNonInfoAlert());
            assert.strictEqual(timers.length, 1);

            timers[0]();
            assert.strictEqual(el.textContent, "idle");
            assert.ok(!status.isNonInfoAlert());
        });
    });
});
