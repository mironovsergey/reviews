import { z } from 'zod';
import { API_BASE_URL } from './config';
import { ApiError } from './api-error';
import { getToken } from './auth-token';

/**
 * Тело ошибки Nest. При отказе валидации поле message содержит массив
 * строк, в остальных случаях - одну строку.
 */
const ErrorBodySchema = z.object({
  message: z.union([z.string(), z.array(z.string())]).optional(),
});

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

/** Собирает из тела ответа текст, пригодный для показа пользователю. */
const extractMessage = (body: unknown, status: number): string => {
  const parsed = ErrorBodySchema.safeParse(body);

  if (parsed.success && parsed.data.message !== undefined) {
    const { message } = parsed.data;

    return Array.isArray(message) ? message.join('. ') : message;
  }

  return `Ошибка запроса (${status})`;
};

/**
 * Выполняет запрос к API и проверяет ответ Zod-схемой.
 *
 * Токен сессии подставляется автоматически. При сбое выбрасывается
 * {@link ApiError}; отмена запроса через `signal` пробрасывается без
 * изменений, чтобы React Query не считал ее ошибкой.
 */
export const fetcher = async <T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> => {
  // Шаг 1. Сборка заголовков: тип содержимого нужен только при наличии тела.
  const headers: Record<string, string> = {};
  const token = getToken();

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Шаг 2. Сетевой запрос. Отмена пробрасывается, прочие сбои оборачиваются.
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (exception: unknown) {
    if (exception instanceof DOMException && exception.name === 'AbortError') {
      throw exception;
    }

    throw new ApiError('Не удалось связаться с сервером', {
      retryable: true,
      cause: exception,
    });
  }

  // Шаг 3. Разбор тела. Пустой ответ не является ошибкой и обрабатывается
  // схемой.
  const body: unknown = await response.json().catch(() => null);

  // Шаг 4. Проверка статуса. Повторению подлежат только временные сбои.
  if (!response.ok) {
    throw new ApiError(extractMessage(body, response.status), {
      retryable: response.status >= 500,
      status: response.status,
    });
  }

  // Шаг 5. Проверка данных доменной схемой.
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ApiError(`Неожиданный ответ сервера: ${z.prettifyError(result.error)}`, {
      retryable: false,
    });
  }

  return result.data;
};
