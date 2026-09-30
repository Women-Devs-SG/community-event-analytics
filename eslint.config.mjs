import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Import boundaries between src/ folders (see docs/architecture.md). Imports flow
// one way: main.tsx -> dashboards/ -> features/ -> summary/, analytics/, data/ -> shared/.
// Flat config replaces rule options per file, so each zone lists all its patterns.
const folders = (...names) => `(^|/)(${names.join('|')})(/|$)`;
const buildOnly = {
  regex: '(^|/)(generate|google-sheets)$',
  message: 'Build-only module: it reads source settings and credentials and must never reach the browser bundle.',
};
const noUi = {
  regex: folders('features', 'dashboards'),
  message: 'data/, analytics/, and summary/ run at build time too; keep UI code out of them.',
};
const sharedOnly = {
  regex: folders('features', 'dashboards', 'data', 'analytics', 'summary'),
  message: 'shared/ holds dependency-free helpers; it may import only config and other shared files.',
};
const noDashboards = { regex: folders('dashboards'), message: 'Features must not import dashboards.' };
const noOtherFeature = {
  regex: '^\\.\\./[^./][^/]*',
  message: 'Features must not import other features; pass values in from the dashboard instead.',
};
const restrict = (...patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });
const buildOnlyImporters = ['src/summary/generate.ts', 'src/summary/summary.test.ts'];

export default defineConfig([
  globalIgnores([
    'node_modules/',
    'dist/',
    'coverage/',
    'public/dashboard-summary.json',
    'data-source-excel/',
    '.claude/',
    '.env',
    '.env.*',
  ]),
  {
    files: ['**/*.{js,mjs,cjs}', 'apps-script/**/*.gs'],
    extends: [js.configs.recommended],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    // Check hook correctness without introducing React Compiler migration rules.
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  { files: ['src/**/*.{ts,tsx}'], ignores: buildOnlyImporters, rules: restrict(buildOnly) },
  {
    files: ['src/{data,analytics,summary}/**/*.ts'],
    ignores: buildOnlyImporters,
    rules: restrict(buildOnly, noUi),
  },
  { files: buildOnlyImporters, rules: restrict(noUi) },
  { files: ['src/shared/**/*.ts'], rules: restrict(buildOnly, sharedOnly) },
  { files: ['src/features/**/*.ts'], rules: restrict(buildOnly, noDashboards, noOtherFeature) },
  {
    files: ['*.{js,mjs,cjs}', 'scripts/**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps-script/**/*.gs'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        console: 'readonly',
        PropertiesService: 'readonly',
        SpreadsheetApp: 'readonly',
        UrlFetchApp: 'readonly',
        ContentService: 'readonly',
      },
    },
  },
  // Formatting belongs to Prettier; avoid conflicting stylistic rules.
  prettier,
]);
