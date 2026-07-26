const assert = require("assert");
const { JSDOM } = require("jsdom");

const DockModeChrome = require("../src/play-ui/dock-mode-chrome");

describe("play-ui dock mode chrome", function () {
    let dom;
    let sidebar;
    let setupBtn;
    let configBtn;
    let runEl;

    beforeEach(function () {
        dom = new JSDOM(`
            <body>
              <aside id="sidebar"></aside>
              <button id="setup"></button>
              <button id="config"></button>
              <div id="run" class="desktop-play-header-run--hidden" aria-hidden="true"></div>
              <aside id="games"></aside>
              <section id="setupDock"></section>
              <section id="configDock"></section>
            </body>
        `);
        const doc = dom.window.document;
        sidebar = doc.getElementById("sidebar");
        setupBtn = doc.getElementById("setup");
        configBtn = doc.getElementById("config");
        runEl = doc.getElementById("run");
    });

    describe("applyDockModes", function () {
        it("marks position setup on the sidebar and button", function () {
            DockModeChrome.applyDockModes(
                {
                    sidebar: sidebar,
                    positionSetupBtn: setupBtn,
                    configurationBtn: configBtn,
                },
                { positionSetup: true, configuration: false },
            );

            assert.ok(sidebar.classList.contains(DockModeChrome.SIDEBAR_SETUP));
            assert.ok(!sidebar.classList.contains(DockModeChrome.SIDEBAR_CONFIG));
            assert.ok(setupBtn.classList.contains(DockModeChrome.ACTION_ACTIVE));
            assert.ok(!configBtn.classList.contains(DockModeChrome.ACTION_ACTIVE));
        });

        it("lets configuration win when both are requested", function () {
            DockModeChrome.applyDockModes(
                {
                    sidebar: sidebar,
                    positionSetupBtn: setupBtn,
                    configurationBtn: configBtn,
                },
                { positionSetup: true, configuration: true },
            );

            assert.ok(sidebar.classList.contains(DockModeChrome.SIDEBAR_CONFIG));
            assert.ok(!sidebar.classList.contains(DockModeChrome.SIDEBAR_SETUP));
            assert.ok(configBtn.classList.contains(DockModeChrome.ACTION_ACTIVE));
            assert.ok(!setupBtn.classList.contains(DockModeChrome.ACTION_ACTIVE));
        });

        it("clears both when idle", function () {
            DockModeChrome.applyDockModes(
                {
                    sidebar: sidebar,
                    positionSetupBtn: setupBtn,
                    configurationBtn: configBtn,
                },
                { positionSetup: true, configuration: false },
            );
            DockModeChrome.applyDockModes(
                {
                    sidebar: sidebar,
                    positionSetupBtn: setupBtn,
                    configurationBtn: configBtn,
                },
                { positionSetup: false, configuration: false },
            );

            assert.ok(!sidebar.classList.contains(DockModeChrome.SIDEBAR_SETUP));
            assert.ok(!sidebar.classList.contains(DockModeChrome.SIDEBAR_CONFIG));
        });
    });

    describe("setGameRunVisible", function () {
        it("toggles the hidden class and aria-hidden", function () {
            DockModeChrome.setGameRunVisible(runEl, true);
            assert.ok(!runEl.classList.contains(DockModeChrome.RUN_HIDDEN));
            assert.strictEqual(runEl.getAttribute("aria-hidden"), "false");

            DockModeChrome.setGameRunVisible(runEl, false);
            assert.ok(runEl.classList.contains(DockModeChrome.RUN_HIDDEN));
            assert.strictEqual(runEl.getAttribute("aria-hidden"), "true");
        });
    });

    describe("applyAdvancedToolsVisibility", function () {
        it("hides partner docks for members", function () {
            const doc = dom.window.document;
            DockModeChrome.applyAdvancedToolsVisibility(
                {
                    gamesSidebar: doc.getElementById("games"),
                    setupDock: doc.getElementById("setupDock"),
                    configDock: doc.getElementById("configDock"),
                    body: doc.body,
                },
                false,
            );

            assert.strictEqual(doc.getElementById("games").hidden, true);
            assert.strictEqual(doc.getElementById("setupDock").hidden, true);
            assert.strictEqual(doc.getElementById("configDock").hidden, true);
            assert.ok(doc.body.classList.contains("desktop-play-no-games-panel"));
        });

        it("shows partner docks when allowed", function () {
            const doc = dom.window.document;
            DockModeChrome.applyAdvancedToolsVisibility(
                {
                    gamesSidebar: doc.getElementById("games"),
                    setupDock: doc.getElementById("setupDock"),
                    configDock: doc.getElementById("configDock"),
                    body: doc.body,
                },
                false,
            );
            DockModeChrome.applyAdvancedToolsVisibility(
                {
                    gamesSidebar: doc.getElementById("games"),
                    setupDock: doc.getElementById("setupDock"),
                    configDock: doc.getElementById("configDock"),
                    body: doc.body,
                },
                true,
            );

            assert.strictEqual(doc.getElementById("games").hidden, false);
            assert.strictEqual(doc.getElementById("games").style.display, "");
            assert.ok(!doc.body.classList.contains("desktop-play-no-games-panel"));
        });
    });
});
