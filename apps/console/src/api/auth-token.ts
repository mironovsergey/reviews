const STORAGE_KEY = 'reviews-console-token';

/**
 * Токен сессии хранится в модуле, а не в состоянии React: его читает
 * fetcher, вызываемый из queryFn без доступа к контексту. Хранилище
 * localStorage недоступно в приватном режиме некоторых браузеров, поэтому
 * обращения к нему защищены.
 *
 * Смена значения рассылается подписчикам: появление и пропажа токена меняют
 * состояние сессии, а очистка кэша React Query подписчиков не уведомляет.
 */
let token: string | null = null;

const listeners = new Set<() => void>();

export const getToken = (): string | null => {
  if (token !== null) {
    return token;
  }

  try {
    token = localStorage.getItem(STORAGE_KEY);
  } catch {
    token = null;
  }

  return token;
};

export const setToken = (value: string | null): void => {
  token = value;

  try {
    if (value === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    // Сессия сохраняется до перезагрузки страницы.
  }

  for (const listener of listeners) {
    listener();
  }
};

/** Подписка на смену токена для useSyncExternalStore. */
export const subscribeToken = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};
