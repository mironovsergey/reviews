import { defineConfig } from 'vitest/config';

// Общей подготовки тесты пакета не требуют: разбор имен выполняется без
// обращения к базе, поэтому setupFiles здесь нет.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
