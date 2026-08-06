/**
 * SEC-05 / ON-39: data-* UI action binder (CSP-safe, no HTML onclick).
 */
"use strict";

const assert = require("assert");
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

describe("bindUiActions", function () {
    it("invokes named data-action handlers for click and submit", function () {
        const src = fs.readFileSync(
            path.join(__dirname, "../src/a11y/bindUiActions.js"),
            "utf8",
        );
        const dom = new JSDOM(
            `<!doctype html><body>
              <button id="chat" data-action="send-chat">send</button>
              <form id="playNowForm" data-action="play-now-submit"><button type="submit">go</button></form>
            </body>`,
            { runScripts: "outside-only", url: "http://localhost/" },
        );
        const { window } = dom;
        let chatCalls = 0;
        let formCalls = 0;
        window.onSendChatButtonClick = function () {
            chatCalls += 1;
        };
        window.startNewGameFromModal = function () {
            formCalls += 1;
        };
        window.eval(src);
        window.document.dispatchEvent(new window.Event("DOMContentLoaded"));

        window.document.getElementById("chat").dispatchEvent(
            new window.MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        assert.strictEqual(chatCalls, 1);

        window.document.getElementById("playNowForm").dispatchEvent(
            new window.Event("submit", { bubbles: true, cancelable: true }),
        );
        assert.strictEqual(formCalls, 1);
        assert.strictEqual(typeof window.ShmerlingBindUiActions.bind, "function");
    });
});
