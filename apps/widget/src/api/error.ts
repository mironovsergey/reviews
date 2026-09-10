/**
 * Ошибка слоя API, пригодная для показа пользователю.
 *
 * Поле `message` содержит текст на русском языке, предназначенный
 * интерфейсу; исходная причина сохраняется в `cause`.
 */
export class ApiError extends Error {
  /** HTTP-статус ответа; undefined для сетевых сбоев и нарушений контракта. */
  readonly status: number | undefined;

  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiError';
    this.status = options?.status;
  }
}

/**
 * Возвращает текст, допустимый для показа пользователю.
 *
 * Сообщения {@link ApiError} составлены для интерфейса. Любая другая ошибка
 * является непредвиденной, и ее текст показу не подлежит.
 */
export const userMessage = (error: unknown, fallback: string): string => {
  return error instanceof ApiError ? error.message : fallback;
};

/** Отмена запроса не является ошибкой: так задача прерывает устаревший запуск. */
export const isAbort = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === 'AbortError';
};
