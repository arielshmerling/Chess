"use strict";

const assert = require("assert");
const RightDockMode = require("../src/play-ui/right-dock-mode");

describe("PlayRightDockMode", function () {
    it("shows chat for online players and read-only chat for watchers", function () {
        assert.deepStrictEqual(
            RightDockMode.resolve({
                onlineSession: true,
                watcher: false,
                canPlayAdvancedTools: true,
                gameActive: true,
            }),
            { mode: "chat", readOnly: false },
        );
        assert.deepStrictEqual(
            RightDockMode.resolve({
                onlineSession: true,
                watcher: true,
                canPlayAdvancedTools: false,
                gameActive: true,
            }),
            { mode: "chat", readOnly: true },
        );
    });

    it("shows games for Admin/Partner when idle", function () {
        assert.deepStrictEqual(
            RightDockMode.resolve({
                onlineSession: false,
                canPlayAdvancedTools: true,
                gameActive: false,
                gameOver: false,
            }),
            { mode: "games", readOnly: false },
        );
    });

    it("hides games during in-progress SP and restores after GameOver", function () {
        assert.deepStrictEqual(
            RightDockMode.resolve({
                onlineSession: false,
                canPlayAdvancedTools: true,
                gameActive: true,
                gameOver: false,
            }),
            { mode: "hidden", readOnly: false },
        );
        assert.deepStrictEqual(
            RightDockMode.resolve({
                onlineSession: false,
                canPlayAdvancedTools: true,
                gameActive: true,
                gameOver: true,
            }),
            { mode: "games", readOnly: false },
        );
    });

    it("keeps the right dock hidden for Members when not online", function () {
        assert.deepStrictEqual(
            RightDockMode.resolve({
                onlineSession: false,
                canPlayAdvancedTools: false,
                gameActive: false,
            }),
            { mode: "hidden", readOnly: false },
        );
        assert.deepStrictEqual(
            RightDockMode.resolve({
                onlineSession: false,
                canPlayAdvancedTools: false,
                gameActive: true,
                gameOver: true,
            }),
            { mode: "hidden", readOnly: false },
        );
    });
});
