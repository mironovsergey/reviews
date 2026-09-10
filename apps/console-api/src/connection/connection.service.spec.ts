import {
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import {
  Connection,
  ConnectionDocument,
  ConnectionStatus,
  Review,
  ReviewTarget,
  SyncState,
} from '@reviews/database';
import {
  AggregatorAuthError,
  AggregatorClient,
  AggregatorError,
  TokenCipher,
} from '@reviews/aggregator';
import { ConnectionService } from './connection.service';

const WORKSPACE_ID = new Types.ObjectId();
const CONNECTION_ID = new Types.ObjectId();
const EXPIRES_AT = new Date('2027-01-01T00:00:00.000Z');
const FINISHED_AT = new Date('2026-09-01T10:00:00.000Z');

const connection = (overrides: Partial<Connection> = {}): ConnectionDocument =>
  ({
    _id: CONNECTION_ID,
    workspaceId: WORKSPACE_ID,
    email: 'clinic@example.com',
    externalUserId: 7,
    tokenCiphertext: 'cipher',
    tokenIv: 'iv',
    tokenAuthTag: 'tag',
    tokenExpiresAt: EXPIRES_AT,
    status: ConnectionStatus.Active,
    syncState: SyncState.Idle,
    syncLockedUntil: null,
    syncRequestedAt: null,
    lastSyncFinishedAt: null,
    lastError: null,
    ...overrides,
  }) as ConnectionDocument;

/** Матчер Vitest объявлен как any и сохраняется отдельным значением. */
const anyDate: unknown = expect.any(Date);

const build = (options: { found?: ConnectionDocument | null } = {}) => {
  const connectionModel = {
    findOne: vi.fn().mockResolvedValue(options.found ?? null),
    findOneAndUpdate: vi.fn().mockResolvedValue(connection()),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const targetModel = { countDocuments: vi.fn().mockResolvedValue(2) };
  const reviewModel = { countDocuments: vi.fn().mockResolvedValue(10) };
  const client = {
    login: vi.fn().mockResolvedValue('token'),
    fetchProfile: vi.fn().mockResolvedValue({ id: 7 }),
  };
  const cipher = {
    encrypt: vi.fn().mockReturnValue({ ciphertext: 'cipher', iv: 'iv', authTag: 'tag' }),
  };
  return {
    service: new ConnectionService(
      connectionModel as unknown as Model<Connection>,
      targetModel as unknown as Model<ReviewTarget>,
      reviewModel as unknown as Model<Review>,
      client as unknown as AggregatorClient,
      cipher as unknown as TokenCipher,
    ),
    connectionModel,
    client,
  };
};

describe('привязка аккаунта', () => {
  it('сохраняет только зашифрованный токен, но не пароль', async () => {
    const { service, connectionModel } = build();

    await service.connect(WORKSPACE_ID, { email: 'clinic@example.com', password: 'secret' });

    const [, update] = connectionModel.findOneAndUpdate.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ];

    expect(update.$set).toMatchObject({ tokenCiphertext: 'cipher', tokenIv: 'iv' });
    expect(JSON.stringify(update.$set)).not.toContain('secret');
  });

  it('приводит адрес к нижнему регистру', async () => {
    const { service, connectionModel } = build();

    await service.connect(WORKSPACE_ID, { email: '  Clinic@Example.COM ', password: 'secret' });

    const [, update] = connectionModel.findOneAndUpdate.mock.calls[0] as [
      unknown,
      { $set: { email: string } },
    ];

    expect(update.$set.email).toBe('clinic@example.com');
  });

  it('запрашивает первичную загрузку', async () => {
    const { service, connectionModel } = build();

    await service.connect(WORKSPACE_ID, { email: 'clinic@example.com', password: 'secret' });

    const [, update] = connectionModel.findOneAndUpdate.mock.calls[0] as [
      unknown,
      { $set: { syncRequestedAt: Date } },
    ];

    expect(update.$set.syncRequestedAt).toBeInstanceOf(Date);
  });

  it('снимает захват прогона вместе с его состоянием', async () => {
    const { service, connectionModel } = build();

    await service.connect(WORKSPACE_ID, { email: 'clinic@example.com', password: 'secret' });

    const [, update] = connectionModel.findOneAndUpdate.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ];

    expect(update.$set).toMatchObject({
      syncState: SyncState.Idle,
      syncLockedUntil: null,
    });
  });

  it('различает отказ учетных данных и недоступность сервиса', async () => {
    const { service, client } = build();
    client.login.mockRejectedValue(new AggregatorAuthError('отклонено'));

    await expect(
      service.connect(WORKSPACE_ID, { email: 'clinic@example.com', password: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    client.login.mockRejectedValue(new AggregatorError('сеть недоступна'));

    await expect(
      service.connect(WORKSPACE_ID, { email: 'clinic@example.com', password: 'secret' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('состояние подключения', () => {
  it('сообщает об отсутствии подключения вместе со счетчиками', async () => {
    const { service } = build({ found: null });

    await expect(service.getStatus(WORKSPACE_ID)).resolves.toEqual({
      connected: false,
      email: null,
      status: null,
      syncState: null,
      syncRequested: false,
      tokenExpiresAt: null,
      lastSyncFinishedAt: null,
      lastError: null,
      counts: { clinics: 2, doctors: 2, reviews: 10 },
    });
  });

  it('переводит даты в строки ISO 8601', async () => {
    const { service } = build({ found: connection({ lastSyncFinishedAt: FINISHED_AT }) });

    await expect(service.getStatus(WORKSPACE_ID)).resolves.toMatchObject({
      connected: true,
      tokenExpiresAt: EXPIRES_AT.toISOString(),
      lastSyncFinishedAt: FINISHED_AT.toISOString(),
    });
  });

  it('оставляет null, если синхронизация еще не завершалась', async () => {
    const { service } = build({ found: connection() });

    await expect(service.getStatus(WORKSPACE_ID)).resolves.toMatchObject({
      lastSyncFinishedAt: null,
    });
  });

  it('сообщает о запросе, ожидающем обработчика', async () => {
    const { service } = build({ found: connection({ syncRequestedAt: new Date() }) });

    await expect(service.getStatus(WORKSPACE_ID)).resolves.toMatchObject({ syncRequested: true });
  });

  it('не раскрывает зашифрованный токен', async () => {
    const { service } = build({ found: connection() });

    const result = await service.getStatus(WORKSPACE_ID);

    expect(JSON.stringify(result)).not.toContain('cipher');
  });
});

describe('ручной запуск синхронизации', () => {
  it('отмечает запрос синхронизации', async () => {
    const { service, connectionModel } = build({ found: connection() });

    await expect(service.triggerSync(WORKSPACE_ID)).resolves.toEqual({ started: true });
    expect(connectionModel.updateOne).toHaveBeenCalledWith(
      { _id: CONNECTION_ID },
      { $set: { syncRequestedAt: anyDate } },
    );
  });

  it('не запрашивает второй прогон поверх выполняемого', async () => {
    const found = connection({
      syncState: SyncState.Running,
      syncLockedUntil: new Date(Date.now() + 60_000),
    });
    const { service, connectionModel } = build({ found });

    await expect(service.triggerSync(WORKSPACE_ID)).resolves.toEqual({ started: false });
    expect(connectionModel.updateOne).not.toHaveBeenCalled();
  });

  it('перезапускает прогон, брошенный при аварийном завершении', async () => {
    const found = connection({
      syncState: SyncState.Running,
      syncLockedUntil: new Date(Date.now() - 60_000),
    });
    const { service, connectionModel } = build({ found });

    await expect(service.triggerSync(WORKSPACE_ID)).resolves.toEqual({ started: true });
    expect(connectionModel.updateOne).toHaveBeenCalled();
  });

  it('отказывает, если аккаунт не подключен', async () => {
    const { service } = build({ found: null });

    await expect(service.triggerSync(WORKSPACE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
