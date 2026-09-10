interface ApiErrorOptions {
  retryable: boolean;
  status?: number;
  cause?: unknown;
}

/**
 * Ошибка слоя API. Признак `retryable` определяет допустимость повтора
 * запроса: детерминированные сбои (HTTP 4xx, некорректный ответ,
 * несовпадение схемы) повтору не подлежат, сетевые и 5xx подлежат.
 */
export class ApiError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options: ApiErrorOptions) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.retryable = options.retryable;
    this.status = options.status;
  }
}

/** Сессия недействительна: консоль возвращает пользователя на экран входа. */
export const isUnauthorized = (error: unknown): boolean => {
  return error instanceof ApiError && error.status === 401;
};
