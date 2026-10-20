import { NotFoundException } from '@nestjs/common';
import { model, Query, Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Workspace, WorkspaceSchema } from '@reviews/database';
import { ReviewFilterService } from './review-filter.service';

const WORKSPACE_ID = new Types.ObjectId();

/**
 * Настоящая модель без подключения к базе.
 *
 * Запросы строит сам Mongoose, а перехватывается только их выполнение.
 * Поэтому проверяются фактически собранные условия и изменения, а служба
 * получает модель без приведения типов.
 */
const workspaceModel = model(Workspace.name, WorkspaceSchema);

/** Запись кабинета в том виде, в каком она лежит в базе. */
const storedWorkspace = (reviewFilter?: { minRating: number | null }): Record<string, unknown> => ({
  _id: WORKSPACE_ID,
  name: 'Клиника',
  apiKey: 'public-key',
  ...(reviewFilter === undefined ? {} : { reviewFilter }),
});

/**
 * Перехватывает выполнение запросов и собирает их для проверки.
 *
 * Ответом служит документ, восстановленный из записи тем же способом, что и
 * при чтении из базы, вместе со значениями по умолчанию. Значение null
 * соответствует отсутствующему кабинету.
 */
const interceptQueries = (stored: Record<string, unknown> | null): Query<unknown, unknown>[] => {
  const queries: Query<unknown, unknown>[] = [];

  vi.spyOn(Query.prototype, 'exec').mockImplementation(function (this: Query<unknown, unknown>) {
    queries.push(this);

    return Promise.resolve(stored === null ? null : workspaceModel.hydrate(stored));
  });

  return queries;
};

const service = new ReviewFilterService(workspaceModel);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('чтение условий вывода', () => {
  it('возвращает условия кабинета', async () => {
    interceptQueries(storedWorkspace({ minRating: 4 }));

    expect(await service.get(WORKSPACE_ID)).toEqual({ minRating: 4 });
  });

  it('ищет запись по идентификатору кабинета', async () => {
    const queries = interceptQueries(storedWorkspace());

    await service.get(WORKSPACE_ID);

    expect(queries[0]?.getFilter()).toEqual({ _id: WORKSPACE_ID });
  });

  it('сообщает об отсутствии ограничений для записи, созданной до появления условий', async () => {
    interceptQueries(storedWorkspace());

    expect(await service.get(WORKSPACE_ID)).toEqual({ minRating: null });
  });

  it('отказывает, если кабинет отсутствует', async () => {
    interceptQueries(null);

    await expect(service.get(WORKSPACE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('изменение условий вывода', () => {
  it('записывает условие по пути вложенного поля, не заменяя остальные', async () => {
    const queries = interceptQueries(storedWorkspace({ minRating: 3 }));

    await service.update(WORKSPACE_ID, { minRating: 3 });

    expect(queries[0]?.getUpdate()).toEqual({ $set: { 'reviewFilter.minRating': 3 } });
  });

  it('снимает ограничение значением null', async () => {
    const queries = interceptQueries(storedWorkspace({ minRating: null }));

    await service.update(WORKSPACE_ID, { minRating: null });

    expect(queries[0]?.getUpdate()).toEqual({ $set: { 'reviewFilter.minRating': null } });
  });

  it('изменяет только запись кабинета пользователя', async () => {
    const queries = interceptQueries(storedWorkspace({ minRating: 3 }));

    await service.update(WORKSPACE_ID, { minRating: 3 });

    expect(queries[0]?.getFilter()).toEqual({ _id: WORKSPACE_ID });
  });

  it('возвращает условия из измененной записи', async () => {
    const queries = interceptQueries(storedWorkspace({ minRating: 5 }));

    expect(await service.update(WORKSPACE_ID, { minRating: 5 })).toEqual({ minRating: 5 });
    expect(queries[0]?.getOptions()).toMatchObject({ returnDocument: 'after' });
  });

  it('не изменяет запись, если условия не переданы', async () => {
    const queries = interceptQueries(storedWorkspace({ minRating: 2 }));

    expect(await service.update(WORKSPACE_ID, {})).toEqual({ minRating: 2 });
    expect(queries.map((query) => query.getUpdate() ?? null)).toEqual([null]);
  });

  it('отказывает, если кабинет отсутствует', async () => {
    interceptQueries(null);

    await expect(service.update(WORKSPACE_ID, { minRating: 3 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
