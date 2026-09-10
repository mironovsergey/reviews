import { defineConfig } from 'vitest/config';

/**
 * Тесты выполняются без контейнера внедрения зависимостей: сервисы
 * создаются вручную с подставными репозиториями. Поэтому метаданные
 * декораторов не требуются, и хватает штатного преобразования Vitest.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
});
