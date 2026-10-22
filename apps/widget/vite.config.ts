import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

/**
 * Корень рабочего пространства: переменные окружения хранятся одним файлом
 * на весь проект, а Vite по умолчанию ищет их в каталоге приложения.
 */
const WORKSPACE_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Виджет собирается одним самодостаточным ES-модулем: Lit включается в бандл,
 * поэтому на принимающей странице не нужен import map.
 *
 * Код вставки:
 *
 *   <reviews-widget api-key="…"></reviews-widget>
 *   <script type="module" src="/reviews-widget.js"></script>
 *
 * Адрес API вшивается при сборке из `VITE_WIDGET_API_URL`, поэтому в коде
 * его нет. Значение читается из `.env` в корне рабочего пространства - см.
 * `envDir` ниже.
 *
 * Прокси на API здесь намеренно нет. Виджет защищен проверкой заголовка
 * Origin, а браузер не отправляет его для запросов на собственный источник:
 * через прокси заголовок пропал бы и API отвечал бы 403. Обращение напрямую
 * на другой порт повторяет боевой сценарий, где виджет всегда работает с
 * чужого домена.
 */

/** Порт дев-сервера виджета; консоль занимает соседний. */
const WIDGET_DEV_PORT = 5173;

export default defineConfig(({ mode }) => {
  // Собранный без адреса виджет молча пошел бы за отзывами на сайт клиента
  // и не работал бы нигде. Пусть лучше не соберется.
  if (mode === 'production' && !loadEnv(mode, WORKSPACE_ROOT, 'VITE_').VITE_WIDGET_API_URL) {
    throw new Error(
      'Не задан VITE_WIDGET_API_URL - адрес API вшивается в бандл при сборке.\n' +
        'Пример: VITE_WIDGET_API_URL=https://api.widget.clinicstars.ru pnpm build',
    );
  }

  return {
    envDir: WORKSPACE_ROOT,
    server: {
      // Порт задан явно: адрес виджета указан в настройках разработки, и
      // подстановка соседнего свободного порта увела бы его молча.
      port: WIDGET_DEV_PORT,
      strictPort: true,
    },
    build: {
      lib: {
        entry: 'src/reviews-widget.ts',
        formats: ['es'] as const,
        fileName: () => 'reviews-widget.js',
      },
      // Стили живут в шаблонах Lit внутри теневого DOM, отдельный CSS не нужен.
      cssCodeSplit: false,
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
