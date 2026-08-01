"use strict";

const assert = require("assert");
const { JSDOM } = require("jsdom");
const PlayChatPanel = require("../src/play-ui/play-chat-panel");

describe("PlayChatPanel", function () {
    it("appends chat lines and clears them", function () {
        const dom = new JSDOM('<div id="msgs"></div>');
        const msgs = dom.window.document.getElementById("msgs");
        PlayChatPanel.appendMessage(msgs, {
            username: "alice",
            text: "hello",
            mine: true,
        });
        assert.strictEqual(msgs.children.length, 1);
        assert.match(msgs.textContent, /alice/);
        assert.match(msgs.textContent, /hello/);
        assert.ok(msgs.children[0].classList.contains("desktop-play-chat-line--mine"));
        PlayChatPanel.clear(msgs);
        assert.strictEqual(msgs.children.length, 0);
    });

    it("switches right dock between games, chat, and hidden", function () {
        const dom = new JSDOM(`
            <body>
              <aside id="sidebar"></aside>
              <section id="games"></section>
              <section id="chat"></section>
              <input id="input" />
            </body>
        `);
        const doc = dom.window.document;
        const els = {
            sidebar: doc.getElementById("sidebar"),
            body: doc.body,
            gamesDock: doc.getElementById("games"),
            chatDock: doc.getElementById("chat"),
            chatInput: doc.getElementById("input"),
        };

        PlayChatPanel.setRightDockMode(els, "games");
        assert.strictEqual(els.gamesDock.hidden, false);
        assert.strictEqual(els.chatDock.hidden, true);
        assert.strictEqual(els.sidebar.hidden, false);
        assert.ok(!els.body.classList.contains("desktop-play-chat-active"));

        PlayChatPanel.setRightDockMode(els, "chat", { readOnly: true });
        assert.strictEqual(els.gamesDock.hidden, true);
        assert.strictEqual(els.chatDock.hidden, false);
        assert.ok(els.body.classList.contains("desktop-play-chat-active"));
        assert.ok(els.chatInput.readOnly);
        assert.ok(els.chatInput.disabled);

        PlayChatPanel.setRightDockMode(els, "hidden");
        assert.strictEqual(els.sidebar.hidden, true);
        assert.ok(els.body.classList.contains("desktop-play-no-games-panel"));
    });
});
