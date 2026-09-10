import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Корень рабочего пространства: переменные окружения хранятся одним файлом
 * на весь проект, а Vite по умолчанию ищет их в каталоге приложения.
 */
const WORKSPACE_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Порт дев-сервера консоли; виджет занимает соседний. */
const CONSOLE_DEV_PORT = 5174;

/**
 * Консоль — обычное SPA: собирается в статику, отдается любым сервером.
 *
 * Адрес API вшивается в бандл при сборке из `VITE_CONSOLE_API_URL`. Прокси в
 * разработке не нужен: консоль обращается к API по тому же абсолютному
 * адресу, что и в боевой среде, а API отражает источник запроса.
 */
export default defineConfig(({ mode }) => {
  // Собранная без адреса консоль обращалась бы к собственному поддомену и
  // получала бы 404 на каждый запрос. Пусть лучше не соберется.
  if (mode === 'production' && !loadEnv(mode, WORKSPACE_ROOT, 'VITE_').VITE_CONSOLE_API_URL) {
    throw new Error(
      'Не задан VITE_CONSOLE_API_URL - адрес API вшивается в бандл при сборке.\n' +
        'Пример: VITE_CONSOLE_API_URL=https://api.console.reviews.stackra.ru pnpm build',
    );
  }

  return {
    envDir: WORKSPACE_ROOT,
    plugins: [react()],
    server: {
      // Порт задан явно и жестко: подстановка соседнего свободного порта
      // развела бы адрес консоли с ожидаемым.
      port: CONSOLE_DEV_PORT,
      strictPort: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
