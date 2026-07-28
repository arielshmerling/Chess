/**
 * Characterization / play-ui tests assert English catalog copy.
 * Product default locale is Hebrew; force English for those suites.
 */
const strings = require("../src/strings");
strings.setLocale("en");
