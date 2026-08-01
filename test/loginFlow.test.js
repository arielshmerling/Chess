const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const strings = require("../src/strings");

const SOURCE = fs.readFileSync(path.join(__dirname, "../src/loginFlow.js"), "utf8");

const MARKUP = `<!DOCTYPE html><html><body>
<section class="login-screen" id="loginScreen" data-step="username">
  <form method="post" action="/login" class="login-form" id="loginForm" novalidate>
    <p class="login-prompt" id="loginPrompt">Who are you?</p>
    <div class="login-row" id="loginRow">
      <input id="username" name="username" class="login-input login-input--username">
      <input id="password" name="password" type="password" class="login-input login-input--password">
      <button type="submit" class="login-next" id="loginNext"></button>
    </div>
    <p class="login-error" id="loginError"></p>
  </form>
</section>
</body></html>`;

function wait(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

/**
 * @param {(body: object) => { status: number, payload: object }} respond
 */
function mountLoginScreen(respond) {
    const dom = new JSDOM(MARKUP, { runScripts: "outside-only", url: "http://localhost/login" });
    const win = dom.window;
    const requests = [];
    const navigated = [];

    win.ShmerlingStrings = {
        t: function (key, params) {
            return strings.t(key, params, "en");
        },
    };

    win.fetch = function (url, options) {
        const body = JSON.parse(options.body);
        requests.push({ url: url, body: body });
        const result = respond ? respond(body) : { status: 401, payload: { ok: false } };
        return Promise.resolve({
            ok: result.status >= 200 && result.status < 300,
            status: result.status,
            json: function () {
                return Promise.resolve(result.payload);
            },
        });
    };

    /* jsdom forbids replacing window.location, so shadow `window` for the script. */
    const pageWindow = {
        ShmerlingStrings: win.ShmerlingStrings,
        location: {
            href: "http://localhost/login",
            assign: function (url) {
                navigated.push(url);
            },
        },
    };
    win.eval("(function (window) {\n" + SOURCE + "\n})")(pageWindow);

    const doc = win.document;
    return {
        win: win,
        requests: requests,
        navigated: navigated,
        screen: doc.getElementById("loginScreen"),
        prompt: doc.getElementById("loginPrompt"),
        username: doc.getElementById("username"),
        password: doc.getElementById("password"),
        submit: function () {
            doc.getElementById("loginForm").dispatchEvent(
                new win.Event("submit", { bubbles: true, cancelable: true })
            );
        },
    };
}

describe("login flow", function () {
    it("starts on the username step", function () {
        const ui = mountLoginScreen();
        assert.strictEqual(ui.screen.getAttribute("data-step"), "username");
        assert.strictEqual(ui.prompt.textContent, "Who are you?");
        assert.strictEqual(ui.username.tabIndex, 0);
        assert.strictEqual(ui.password.tabIndex, -1);
    });

    it("advances to the password step after a username is entered", async function () {
        const ui = mountLoginScreen();
        ui.username.value = "player";
        ui.submit();

        assert.strictEqual(ui.screen.getAttribute("data-step"), "password");
        assert.strictEqual(ui.password.tabIndex, 0);
        await wait(300);
        assert.strictEqual(ui.prompt.textContent, strings.t("auth.enterPassword", null, "en"));
    });

    it("stays on the username step when nothing is typed", function () {
        const ui = mountLoginScreen();
        ui.username.value = "   ";
        ui.submit();

        assert.strictEqual(ui.screen.getAttribute("data-step"), "username");
        assert.strictEqual(ui.requests.length, 0);
    });

    it("navigates to the redirect target returned by the API", async function () {
        const ui = mountLoginScreen(function () {
            return { status: 200, payload: { ok: true, redirectUrl: "/friends" } };
        });

        ui.username.value = " player ";
        ui.submit();
        ui.password.value = "secret";
        ui.submit();
        await wait(50);

        assert.deepStrictEqual(ui.requests[0].body, { username: "player", password: "secret" });
        assert.deepStrictEqual(ui.navigated, ["/friends"]);
    });

    it("ignores an off-site redirect target", async function () {
        const ui = mountLoginScreen(function () {
            return { status: 200, payload: { ok: true, redirectUrl: "//evil.example/steal" } };
        });

        ui.username.value = "player";
        ui.submit();
        ui.password.value = "secret";
        ui.submit();
        await wait(50);

        assert.deepStrictEqual(ui.navigated, ["/Home"]);
    });

    it("shows Sorry on failure and returns to the username step", async function () {
        this.timeout(10000);
        const ui = mountLoginScreen(function () {
            return { status: 401, payload: { ok: false } };
        });

        ui.username.value = "player";
        ui.submit();
        ui.password.value = "wrong";
        ui.submit();

        await wait(300);
        assert.strictEqual(ui.screen.getAttribute("data-step"), "sorry");
        assert.strictEqual(ui.prompt.textContent, "Sorry");
        assert.strictEqual(ui.password.value, "");
        assert.deepStrictEqual(ui.navigated, []);

        await wait(3100);
        assert.strictEqual(ui.screen.getAttribute("data-step"), "username");
        assert.strictEqual(ui.prompt.textContent, "Who are you?");
        assert.strictEqual(ui.username.value, "");
    });
});
