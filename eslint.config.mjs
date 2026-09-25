import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

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
