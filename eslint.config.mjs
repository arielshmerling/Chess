import globals from "globals";
import pluginJs from "@eslint/js";


/** @type {import('eslint').Linter.Config[]} */
export default [

  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "commonjs", ecmaVersion: 2024 },
    rules: {
      "no-multiple-empty-lines": "error",
      "no-duplicate-imports": "error",
      semi: "error",
      curly: "error",
      quotes: "error",
      "prefer-const": "error",
      "no-unused-vars": ["error", { "ignoreRestSiblings": true }],
      "no-undef": "error"
    },
  },
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, }
    }
  },

  pluginJs.configs.recommended,

];