import { vi } from 'vitest';

/**
 * Подставная модель Mongoose для проверок сервисов.
 *
 * Запросы Mongoose строятся цепочкой (`find().sort().limit()`) и ожидаются
 * как промис, поэтому подстановка возвращает объект, чьи методы возвращают
 * его же, а `then` отдает заранее заданный результат.
 */
export const queryResult = <T>(result: T) => {
  const query = {
    select: vi.fn(() => query),
    sort: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: <R>(resolve: (value: T) => R) => Promise.resolve(result).then(resolve),
  };

  return query;
};

/** Возвращает функцию модели, отдающую цепочку запроса с заданным результатом. */
export const modelQuery = <T>(result: T) => vi.fn(() => queryResult(result));
