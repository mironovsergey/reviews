import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default defineConfig(
  globalIgnores(['**/dist/**', '**/node_modules/**']),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,mts,cts}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [tseslint.configs.recommended],
  },
  {
    files: ['apps/*/src/**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Модули Nest объявляются классами без членов: их наполняют декораторы.
    files: ['apps/console-api/**/*.ts', 'apps/widget-api/**/*.ts', 'apps/sync-worker/**/*.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    files: ['apps/console/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
  },
  prettier,
);
