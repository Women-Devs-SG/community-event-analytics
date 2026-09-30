import { defineConfig } from 'vite';

// base './' so the built site works at any GitHub Pages path
export default defineConfig({
  base: './',
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.ts', 'src/vite-env.d.ts'],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      // Floors sit just below the measured baseline so coverage can only ratchet up.
      // Raise them when coverage improves; never lower them to make a change pass.
      thresholds: {
        statements: 45,
        branches: 35,
        functions: 40,
        lines: 46,
        // Disclosure controls are a privacy boundary and must stay fully covered.
        'src/analytics/privacy.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
