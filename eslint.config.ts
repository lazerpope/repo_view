import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import pluginVue from "eslint-plugin-vue"
import css from "@eslint/css"
import { defineConfig } from "eslint/config"
import stylistic from "@stylistic/eslint-plugin"

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,vue}"],
    plugins: { js, "@stylistic": stylistic, }, extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // No semicolons
      "@stylistic/semi": ["error", "never"],

      // 4 spaces
      "@stylistic/indent": ["error", 4],

      // Don't allow tabs
      "@stylistic/no-tabs": "error",

      // Maximum line length
      "@stylistic/max-len": [
        "error",
        {
          code: 100,
          tabWidth: 4,
          ignoreUrls: true,
        },
      ],
    },
  },
  tseslint.configs.recommended,
  pluginVue.configs["flat/essential"],
  { files: ["**/*.vue"], 
    languageOptions: { parserOptions: { parser: tseslint.parser } } ,
  rules: {
            // 4 spaces inside <template>
            "vue/html-indent": ["error", 4],
        },},
  { files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] },
])
