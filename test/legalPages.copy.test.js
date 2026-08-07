/**
 * Legal pages (ON-44): privacy/terms/contact English copy is published, not placeholders.
 */
"use strict";

const assert = require("assert");
const { t } = require("../src/strings");

describe("legal pages copy (ON-44)", function () {
    it("privacy policy covers controller, bases, retention, rights, and transfers", function () {
        const keys = [
            "site.privacy.controllerBody",
            "site.privacy.basesBody",
            "site.privacy.retentionBody",
            "site.privacy.rightsBody",
            "site.privacy.transfersBody",
        ];
        keys.forEach(function (key) {
            const text = t(key);
            assert.notStrictEqual(text, key);
            assert.ok(!/will be published here/i.test(text), key);
            assert.ok(String(text).length > 40, key);
        });
        assert.match(t("site.privacy.controllerBody"), /Ariel Shmerling/);
    });

    it("terms and contact are not placeholders", function () {
        assert.ok(!/will be published here/i.test(t("site.footer.termsBody")));
        assert.ok(!/will be published here/i.test(t("site.footer.contactBody")));
        assert.match(t("site.contactPage.controllerBody"), /Ariel Shmerling/);
        assert.match(t("site.terms.fairPlayBody"), /fair/i);
    });
});
