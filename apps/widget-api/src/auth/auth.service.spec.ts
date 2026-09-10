import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { ReviewFilter, Workspace, WorkspaceDocument } from '@reviews/database';
import { AuthService } from './auth.service';

const WORKSPACE_ID = new Types.ObjectId();
const API_KEY = 'public-widget-key';

/** Условия вывода не заданы: ими распоряжается кабинет, а не опознание. */
const NO_FILTER: ReviewFilter = { minRating: null };

const workspace = (
  allowedDomains: string[] = ['example.com'],
  reviewFilter: ReviewFilter = NO_FILTER,
): WorkspaceDocument =>
  ({
    _id: WORKSPACE_ID,
    name: 'Доктор Плюс',
    apiKey: API_KEY,
    allowedDomains,
    isActive: true,
    reviewFilter,
  }) as WorkspaceDocument;

/** Опознанный кабинет без условий вывода. */
const IDENTIFIED = { id: WORKSPACE_ID, reviewFilter: NO_FILTER };

const build = (found: WorkspaceDocument | null = workspace()) => {
  const workspaceModel = { findOne: vi.fn().mockResolvedValue(found) };

  return {
    service: new AuthService(workspaceModel as unknown as Model<Workspace>),
    workspaceModel,
  };
};

describe('опознание кабинета по ключу', () => {
  it('возвращает кабинет по ключу и разрешенному домену', async () => {
    const { service } = build();

    await expect(service.authenticateWidget(API_KEY, 'https://example.com')).resolves.toEqual(
      IDENTIFIED,
    );
  });

  it('ищет только действующие кабинеты', async () => {
    const { service, workspaceModel } = build();

    await service.authenticateWidget(API_KEY, 'https://example.com');

    expect(workspaceModel.findOne).toHaveBeenCalledWith({ apiKey: API_KEY, isActive: true });
  });

  it('отвергает отсутствующий и пустой ключ', async () => {
    const { service, workspaceModel } = build();

    await expect(
      service.authenticateWidget(undefined, 'https://example.com'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.authenticateWidget('', 'https://example.com')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    // Пустой ключ отсекается до обращения к базе.
    expect(workspaceModel.findOne).not.toHaveBeenCalled();
  });

  it('отвергает неизвестный ключ', async () => {
    const { service } = build(null);

    await expect(
      service.authenticateWidget('чужой-ключ', 'https://example.com'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('проверка источника запроса', () => {
  it('сверяет с доменом только имя узла', async () => {
    const { service } = build();

    // Порт и путь в Origin не участвуют в сверке.
    await expect(service.authenticateWidget(API_KEY, 'https://example.com:8443')).resolves.toEqual(
      IDENTIFIED,
    );
  });

  it('не различает схему источника', async () => {
    const { service } = build();

    await expect(service.authenticateWidget(API_KEY, 'http://example.com')).resolves.toEqual(
      IDENTIFIED,
    );
  });

  it('отвергает посторонний домен', async () => {
    const { service } = build();

    await expect(service.authenticateWidget(API_KEY, 'https://evil.test')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('отвергает поддомен разрешенного домена', async () => {
    const { service } = build();

    // Совпадение требуется точное: www.example.com разрешением не является.
    await expect(
      service.authenticateWidget(API_KEY, 'https://www.example.com'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('отвергает запрос без заголовка Origin', async () => {
    const { service } = build();

    await expect(service.authenticateWidget(API_KEY, undefined)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('отвергает непригодное значение Origin', async () => {
    const { service } = build();

    await expect(service.authenticateWidget(API_KEY, 'не-адрес')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('отвергает кабинет без разрешенных доменов', async () => {
    const { service } = build(workspace([]));

    await expect(service.authenticateWidget(API_KEY, 'https://example.com')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('приводит кириллический домен к punycode, как это делает URL', async () => {
    const { service } = build(workspace(['xn--80apagcdp.xn--p1ai']));

    // Значение Origin браузер передает в punycode, поэтому в списке доменов
    // кабинета кириллица в исходном виде не совпала бы.
    await expect(service.authenticateWidget(API_KEY, 'https://клиника.рф')).resolves.toEqual(
      IDENTIFIED,
    );
  });
});

describe('условия вывода вместе с опознанием', () => {
  it('возвращает условия кабинета без отдельного запроса', async () => {
    const { service, workspaceModel } = build(workspace(['example.com'], { minRating: 4 }));

    await expect(service.authenticateWidget(API_KEY, 'https://example.com')).resolves.toEqual({
      id: WORKSPACE_ID,
      reviewFilter: { minRating: 4 },
    });

    // Запись кабинета читается один раз: условия достаются вместе с ключом.
    expect(workspaceModel.findOne).toHaveBeenCalledTimes(1);
  });
});
