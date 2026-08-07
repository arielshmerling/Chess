/**
 * Suites whose individual cases routinely exceed ~1s (engine search, real timers).
 * @deprecated Prefer require("./suite-manifest").heavy — kept for older references.
 */
"use strict";

module.exports = require("./suite-manifest").heavy;
