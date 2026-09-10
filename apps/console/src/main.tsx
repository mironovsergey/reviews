import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './app';
import { ApiError, isUnauthorized } from './api/api-error';
import { getToken, setToken } from './api/auth-token';
import { ErrorBoundary } from './components/error-boundary/error-boundary';
import './styles/tokens.css';
import './styles/global.css';

const MAX_RETRIES = 2;

/**
 * Общая обработка отказов запросов и мутаций.
 *
 * Отказ 401 при сохраненном токене означает, что сервер его не признал: срок
 * истек либо учетная запись отключена. Сессия сбрасывается, и защищенные
 * страницы сами уводят на экран входа - переход выполняется не здесь,
 * маршрутизатор доступен только внутри дерева компонентов.
 *
 * Тот же отказ без токена приходит с экрана входа и означает неверные
 * учетные данные: сбрасывать нечего, а очистка кэша была бы лишней.
 */
const handleError = (error: unknown): void => {
  if (isUnauthorized(error) && getToken() !== null) {
    // Порядок важен: очистка кэша подписчиков не уведомляет, а сброс токена
    // уведомляет, и страницы перечитывают уже опустевший кэш.
    queryClient.clear();
    setToken(null);

    return;
  }

  console.error(error);
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Детерминированные отказы (4xx, несовпадение схемы) не повторяются.
        if (error instanceof ApiError && !error.retryable) {
          return false;
        }

        return failureCount < MAX_RETRIES;
      },
    },
  },
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Корневой элемент #root не найден');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
