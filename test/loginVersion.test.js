const assert = require("assert");
const { describe, it } = require("mocha");

const { version: publishedVersion } = require("../desktop/package.json");
const userController = require("../src/modules/user/controller");

describe("login version", function () {
    it("renders the version used by desktop releases", function () {
        const req = { query: {} };
        const res = {
            locals: { messages: [] },
            render: function (view, locals) {
                assert.strictEqual(view, "login");
                assert.strictEqual(locals.appVersion, publishedVersion);
            },
        };

        userController.showLoginPage(req, res);
    });
});
