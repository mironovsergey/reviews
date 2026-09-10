import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { ConsoleApiEnv } from '../env';
import type { Workspace, WorkspaceDocument } from '@reviews/database';
import { WidgetService } from './widget.service';

const WORKSPACE_ID = new Types.ObjectId();

const workspace = (allowedDomains: string[] = []): WorkspaceDocument =>
  ({
    _id: WORKSPACE_ID,
    name: 'Клиника',
    apiKey: 'public-key',
    allowedDomains,
    isActive: true,
  }) as WorkspaceDocument;

/** Из конфигурации сервису нужен единственный адрес скрипта виджета. */
const appConfig = (widgetScriptUrl: string): ConfigService<ConsoleApiEnv, true> =>
  ({ get: vi.fn((): string => widgetScriptUrl) }) as unknown as ConfigService<ConsoleApiEnv, true>;

const build = (options: { found?: WorkspaceDocument | null; scriptUrl?: string } = {}) => {
  const workspaceModel = {
    findById: vi.fn().mockResolvedValue(options.found === undefined ? workspace() : options.found),
    findOneAndUpdate: vi
      .fn()
      .mockImplementation((_filter: unknown, update: { $set: { allowedDomains: string[] } }) =>
        Promise.resolve(options.found === null ? null : workspace(update.$set.allowedDomains)),
      ),
  };

  return {
    service: new WidgetService(
      workspaceModel as unknown as Model<Workspace>,
      appConfig(options.scriptUrl ?? '/reviews-widget.js'),
    ),
    workspaceModel,
  };
};

describe('код вставки', () => {
  it('содержит ключ кабинета и адрес скрипта', async () => {
    const { service } = build({ scriptUrl: 'https://widget.example.ru/reviews-widget.js' });

    const result = await service.getSettings(WORKSPACE_ID);

    expect(result.snippet).toContain('api-key="public-key"');
    expect(result.snippet).toContain('src="https://widget.example.ru/reviews-widget.js"');
  });

  it('не содержит адреса API: он подставлен в скрипт при сборке', async () => {
    const { service } = build();

    expect((await service.getSettings(WORKSPACE_ID)).snippet).not.toContain('api-url');
  });

  it('отказывает, если кабинет отсутствует', async () => {
    const { service } = build({ found: null });

    await expect(service.getSettings(WORKSPACE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('нормализация доменов', () => {
  it.each([
    ['example.com', 'example.com'],
    ['https://example.com/path', 'example.com'],
    ['  EXAMPLE.COM  ', 'example.com'],
    ['https://sub.example.com:8443/x', 'sub.example.com'],
  ])('приводит «%s» к «%s»', async (input, expected) => {
    const { service, workspaceModel } = build();

    await service.updateDomains(WORKSPACE_ID, [input]);

    expect(workspaceModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: WORKSPACE_ID },
      { $set: { allowedDomains: [expected] } },
      expect.anything(),
    );
  });

  it('отбрасывает повторы и пустые строки', async () => {
    const { service, workspaceModel } = build();

    await service.updateDomains(WORKSPACE_ID, ['example.com', 'https://example.com', '  ', '']);

    expect(workspaceModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: WORKSPACE_ID },
      { $set: { allowedDomains: ['example.com'] } },
      expect.anything(),
    );
  });

  it('отвергает значение, не являющееся именем узла', async () => {
    const { service } = build();

    await expect(service.updateDomains(WORKSPACE_ID, ['не домен!'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('допускает пустой список: он запрещает виджет повсюду', async () => {
    const { service, workspaceModel } = build();

    await service.updateDomains(WORKSPACE_ID, []);

    expect(workspaceModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: WORKSPACE_ID },
      { $set: { allowedDomains: [] } },
      expect.anything(),
    );
  });

  it('отказывает, если кабинет отсутствует', async () => {
    const { service } = build({ found: null });

    await expect(service.updateDomains(WORKSPACE_ID, ['example.com'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
