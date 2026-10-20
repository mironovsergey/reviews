import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { model, Query, Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReviewTarget, ReviewTargetSchema, Workspace, WorkspaceSchema } from '@reviews/database';
import type { ConsoleApiEnv } from '../env';
import { WidgetService } from './widget.service';

const WORKSPACE_ID = new Types.ObjectId();
const TARGET_ID = new Types.ObjectId();
const SCRIPT_URL = 'https://widget.example.ru/reviews-widget.js';

/**
 * Настоящие модели без подключения к базе.
 *
 * Запросы строит сам Mongoose, а перехватывается только их выполнение.
 * Поэтому проверяется фактически собранный запрос, а служба получает модели
 * без приведения типов.
 */
const workspaceModel = model(Workspace.name, WorkspaceSchema);
const targetModel = model(ReviewTarget.name, ReviewTargetSchema);

/** Значения, переданные в конструктор, ConfigService читает раньше окружения. */
const config = new ConfigService<ConsoleApiEnv, true>({ WIDGET_SCRIPT_URL: SCRIPT_URL });

const service = new WidgetService(workspaceModel, targetModel, config);

const STORED_WORKSPACE = {
  _id: WORKSPACE_ID,
  name: 'Клиника',
  apiKey: 'public-key',
  allowedDomains: ['example.com'],
};

const STORED_TARGET = {
  _id: TARGET_ID,
  workspaceId: WORKSPACE_ID,
  externalId: 101,
  externalUuid: 'external-uuid',
  kind: 'doctor',
  name: 'Иванова Мария',
};

/**
 * Перехватывает выполнение запросов и собирает их для проверки.
 *
 * Ответ зависит от модели запроса: запись кабинета или цели либо null,
 * если такой записи нет.
 */
const intercept = (found: { workspace: boolean; target: boolean }): Query<unknown, unknown>[] => {
  const queries: Query<unknown, unknown>[] = [];

  vi.spyOn(Query.prototype, 'exec').mockImplementation(function (this: Query<unknown, unknown>) {
    queries.push(this);

    if (this.model.modelName === Workspace.name) {
      return Promise.resolve(found.workspace ? workspaceModel.hydrate(STORED_WORKSPACE) : null);
    }

    return Promise.resolve(found.target ? targetModel.hydrate(STORED_TARGET) : null);
  });

  return queries;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('код вставки для клиники или врача', () => {
  it('содержит ключ кабинета, идентификатор цели и адрес скрипта', async () => {
    intercept({ workspace: true, target: true });

    const result = await service.getTargetSnippet(WORKSPACE_ID, String(TARGET_ID));

    expect(result.targetId).toBe(String(TARGET_ID));
    expect(result.snippet).toBe(
      `<reviews-widget api-key="public-key" target-id="${String(TARGET_ID)}"></reviews-widget>\n` +
        `<script type="module" src="${SCRIPT_URL}"></script>`,
    );
  });

  it('ищет цель только в кабинете пользователя', async () => {
    const queries = intercept({ workspace: true, target: true });

    await service.getTargetSnippet(WORKSPACE_ID, String(TARGET_ID));

    const targetQuery = queries.find((query) => query.model.modelName === ReviewTarget.name);

    expect(targetQuery?.getFilter()).toEqual({ _id: TARGET_ID, workspaceId: WORKSPACE_ID });
  });

  it('отказывает, если цель не найдена в кабинете', async () => {
    intercept({ workspace: true, target: false });

    await expect(service.getTargetSnippet(WORKSPACE_ID, String(TARGET_ID))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('отказывает, если кабинет отсутствует', async () => {
    intercept({ workspace: false, target: true });

    await expect(service.getTargetSnippet(WORKSPACE_ID, String(TARGET_ID))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('код вставки для всего кабинета', () => {
  it('не содержит атрибута цели', async () => {
    intercept({ workspace: true, target: true });

    const result = await service.getSettings(WORKSPACE_ID);

    expect(result.snippet).toBe(
      '<reviews-widget api-key="public-key"></reviews-widget>\n' +
        `<script type="module" src="${SCRIPT_URL}"></script>`,
    );
  });
});
