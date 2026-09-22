import css from '@eslint/css'
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const scriptFiles = ['**/*.{js,mjs,cjs,ts,mts,cts,vue}']
const typescriptFiles = ['**/*.{ts,mts,cts,vue}']
const vueFiles = ['**/*.vue']

export default defineConfig([
    {
        ignores: ['dist/**', 'node_modules/**', 'bin/**'],
    },
    {
        ...js.configs.recommended,
        files: scriptFiles,
        languageOptions: {
            globals: { ...globals.browser, ...globals.node },
        },
    },
    ...tseslint.configs.recommended.map((config) => ({
        ...config,
        files: typescriptFiles,
    })),
    ...pluginVue.configs['flat/essential'].map((config) => ({
        ...config,
        files: vueFiles,
    })),
    {
        files: vueFiles,
        languageOptions: {
            parserOptions: { parser: tseslint.parser },
        },
    },
    {
        files: ['**/*.css'],
        plugins: { css },
        language: 'css/css',
        extends: ['css/recommended'],
        rules: {
            'css/use-baseline': 'off',
        },
    },
    prettier,
    {
        files: scriptFiles,
        plugins: { '@stylistic': stylistic },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
            '@stylistic/no-tabs': 'error',
            '@stylistic/semi': ['error', 'never'],
        },
    },
])
