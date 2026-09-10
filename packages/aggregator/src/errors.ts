/** Базовая ошибка обращения к API агрегатора. */
export class AggregatorError extends Error {
  /** HTTP-статус ответа, если ошибка возникла после его получения. */
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'AggregatorError';
    this.status = status;
  }
}

/**
 * Токен отклонен (401). По этой ошибке синхронизация переводит подключение
 * в состояние needs_reauth, не считая ее временным сбоем.
 */
export class AggregatorAuthError extends AggregatorError {
  constructor(message: string) {
    super(message);
    this.name = 'AggregatorAuthError';
  }
}

/** Превышен лимит запросов (429) и повторы не помогли. */
export class AggregatorRateLimitError extends AggregatorError {
  constructor(message: string) {
    super(message);
    this.name = 'AggregatorRateLimitError';
  }
}

/** Ответ получен, но его структура не соответствует ожидаемой. */
export class AggregatorResponseError extends AggregatorError {
  constructor(message: string) {
    super(message);
    this.name = 'AggregatorResponseError';
  }
}
