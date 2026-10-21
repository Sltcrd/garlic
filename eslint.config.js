'use strict';
const js = require('@eslint/js');
const globals = require('globals');

/*
 * The renderer files are classic scripts that share globals through <script> tags (see each index.html),
 * so cross-file `no-undef` / `no-unused-vars` would be pure noise there. The main process and the
 * tooling are real CommonJS modules and are linted strictly.
 */
module.exports = [
  { ignores: ['node_modules/**', 'dist/**', 'out/**', 'docs/img/**'] },
  js.configs.recommended,
  {
    files: ['src/main/**/*.js', 'src/preload/**/*.js', 'scripts/**/*.js', 'bin/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, fetch: 'readonly', WebSocket: 'readonly' } },
    rules: {
      'no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'warn'
    }
  },
  {
    files: ['src/renderer/**/*.js', 'src/shared/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser, I18N: 'writable', I18N_EN: 'writable', I18nDom: 'writable', module: 'readonly', require: 'readonly' } },
    rules: { 'no-undef': 'off', 'no-unused-vars': 'off', 'no-empty': ['error', { allowEmptyCatch: true }], 'no-var': 'error', eqeqeq: ['warn', 'always', { null: 'ignore' }] }
  },
  { files: ['src/renderer/shared/pdf-loader.js'], languageOptions: { sourceType: 'module' } }
];
