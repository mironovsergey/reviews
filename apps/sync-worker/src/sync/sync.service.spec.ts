import { Model, Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import {
  Connection,
  ConnectionDocument,
  ConnectionStatus,
  Review,
  ReviewTarget,
  ReviewTargetKind,
  SyncState,
} from '@reviews/database';
import { modelQuery } from '@reviews/testing';
import {
  AggregatorAuthError,
  AggregatorClient,
  AggregatorError,
  AggregatorResponseError,
  TokenCipher,
} from '@reviews/aggregator';
import { SyncService } from './sync.service';

const WORKSPACE_ID = new Types.ObjectId();
const CONNECTION_ID = new Types.ObjectId();
const TARGET_ID = new Types.ObjectId();
const SYNC_LOCK_TTL_MS = 15 * 60 * 1000;

/**
 * Матчеры Vitest объявлены как any, поэтому сохраняются отдельными
 * значениями: иначе они попадают в объектные литералы проверок и лишают
 * их типизации.
 */
const anyDate: unknown = expect.any(Date);
const containing = (fields: Record<string, unknown>): unknown => expect.objectContaining(fields);

const connection = (): ConnectionDocument =>
  ({
    _id: CONNECTION_ID,
    workspaceId: WORKSPACE_ID,
    email: 'clinic@example.com',
    externalUserId: 7,
    tokenCiphertext: 'c',
    tokenIv: 'i',
    tokenAuthTag: 'a',
    tokenExpiresAt: new Date(),
    status: ConnectionStatus.Active,
    syncState: SyncState.Running,
    syncLockedUntil: null,
    lastError: null,
  }) as ConnectionDocument;

const firm = { id: 10, uuid: 'u', type: 1, name: 'Клиника на Ленина', product_category: null };

const rawReview = (overrides: Record<string, unknown> = {}) => ({
  id: 100,
  username: 'Петр',
  date_create: '20.06.2026',
  rating: 5,
  message: 'Отлично',
  firm_id: 10,
  service: 1,
  hidden: false,
  is_double: false,
  answer: null,
  url: null,
  ...overrides,
});

const build = (
  options: {
    acquired?: ConnectionDocument | null;
    reviews?: unknown[];
    counts?: { total: number; stale: number };
    /** Число целей, уже хранящихся в кабинете. */
    storedTargets?: number;
  } = {},
) => {
  const counts = options.counts ?? { total: 10, stale: 1 };
  const connectionModel = {
    findOneAndUpdate: vi
      .fn()
      .mockResolvedValue(options.acquired === undefined ? connection() : options.acquired),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const targetModel = {
    bulkWrite: vi.fn().mockResolvedValue({ upsertedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    countDocuments: vi.fn().mockResolvedValue(options.storedTargets ?? 0),
    find: modelQuery([{ _id: TARGET_ID, externalId: 10, kind: ReviewTargetKind.Clinic }]),
  };
  const reviewModel = {
    bulkWrite: vi.fn().mockResolvedValue({ upsertedCount: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    countDocuments: vi
      .fn()
      .mockImplementation((filter: { syncedAt?: unknown }) =>
        Promise.resolve(filter.syncedAt === undefined ? counts.total : counts.stale),
      ),
  };
  const client = {
    fetchFirms: vi.fn().mockResolvedValue([firm]),
    iterateReviews: vi.fn().mockImplementation(async function* () {
      yield await Promise.resolve(options.reviews ?? [rawReview()]);
    }),
  };
  const cipher = { decrypt: vi.fn().mockReturnValue('token') };

  return {
    service: new SyncService(
      connectionModel as unknown as Model<Connection>,
      targetModel as unknown as Model<ReviewTarget>,
      reviewModel as unknown as Model<Review>,
      client as unknown as AggregatorClient,
      cipher as unknown as TokenCipher,
    ),
    connectionModel,
    targetModel,
    reviewModel,
    client,
  };
};

describe('захват прогона', () => {
  it('назначает захвату срок действия', async () => {
    const { service, connectionModel } = build();

    await service.run(CONNECTION_ID);

    const [, update] = connectionModel.findOneAndUpdate.mock.calls[0] as [
      unknown,
      { $set: { syncLockedUntil: Date; lastSyncStartedAt: Date } },
    ];

    expect(update.$set.syncLockedUntil.getTime()).toBe(
      update.$set.lastSyncStartedAt.getTime() + SYNC_LOCK_TTL_MS,
    );
  });

  it('перехватывает брошенный и просроченный захват', async () => {
    const { service, connectionModel } = build();

    await service.run(CONNECTION_ID);

    const [filter] = connectionModel.findOneAndUpdate.mock.calls[0] as [
      { $or: Record<string, unknown>[] },
    ];

    expect(filter.$or).toContainEqual({ syncState: SyncState.Idle });
    expect(filter.$or).toContainEqual({ syncLockedUntil: null });
    expect(filter.$or).toContainEqual({ syncLockedUntil: { $lte: anyDate } });
  });

  it('не запускает работу, если прогон уже выполняется', async () => {
    const { service, client } = build({ acquired: null });

    await expect(service.run(CONNECTION_ID)).resolves.toBeNull();
    expect(client.fetchFirms).not.toHaveBeenCalled();
  });

  it('снимает срок захвата и освобождает подключение после прогона', async () => {
    const { service, connectionModel } = build();

    await service.run(CONNECTION_ID);

    expect(connectionModel.updateOne).toHaveBeenCalledWith(
      { _id: CONNECTION_ID },
      {
        $set: containing({
          syncState: SyncState.Idle,
          syncLockedUntil: null,
          status: ConnectionStatus.Active,
          lastError: null,
        }),
      },
    );
  });

  it('переводит подключение в состояние переавторизации при отказе токена', async () => {
    const { service, connectionModel, client } = build();
    client.fetchFirms.mockRejectedValue(new AggregatorAuthError('отклонено'));

    await expect(service.run(CONNECTION_ID)).rejects.toBeInstanceOf(AggregatorAuthError);
    expect(connectionModel.updateOne).toHaveBeenCalledWith(
      { _id: CONNECTION_ID },
      { $set: containing({ status: ConnectionStatus.NeedsReauth }) },
    );
  });

  it('считает прочие сбои временными', async () => {
    const { service, connectionModel, client } = build();
    client.fetchFirms.mockRejectedValue(new Error('сеть недоступна'));

    await expect(service.run(CONNECTION_ID)).rejects.toThrow('сеть недоступна');
    expect(connectionModel.updateOne).toHaveBeenCalledWith(
      { _id: CONNECTION_ID },
      { $set: containing({ status: ConnectionStatus.Error }) },
    );
  });
});

describe('причина отказа для консоли', () => {
  it('не выпускает наружу сообщение постороннего сбоя', async () => {
    const { service, connectionModel, client } = build();
    client.fetchFirms.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.7:27017'));

    await expect(service.run(CONNECTION_ID)).rejects.toThrow(/ECONNREFUSED/u);

    const [, update] = connectionModel.updateOne.mock.calls[0] as [
      unknown,
      { $set: { lastError: string } },
    ];

    expect(update.$set.lastError).toBe('Загрузка не удалась из-за внутренней ошибки');
  });

  it('различает виды сбоев агрегатора', async () => {
    const cases: [Error, string][] = [
      [new AggregatorAuthError('MyReviews отклонил токен на /v1/user/profile'), 'токен доступа'],
      [new AggregatorResponseError('Неожиданный вид ответа со списком'), 'неожиданного вида'],
      [new AggregatorError('Запрос к /v1/firm/list не выполнен: fetch failed'), 'недоступен'],
    ];

    for (const [error, expected] of cases) {
      const { service, connectionModel, client } = build();
      client.fetchFirms.mockRejectedValue(error);

      await expect(service.run(CONNECTION_ID)).rejects.toBe(error);

      const [, update] = connectionModel.updateOne.mock.calls[0] as [
        unknown,
        { $set: { lastError: string } },
      ];

      expect(update.$set.lastError).toContain(expected);
      expect(update.$set.lastError).not.toContain('/v1/');
    }
  });

  it('показывает сообщение проверки самой синхронизации как есть', async () => {
    const { service, connectionModel, client } = build({ storedTargets: 3 });
    client.fetchFirms.mockResolvedValue([]);

    await expect(service.run(CONNECTION_ID)).rejects.toThrow(/Синхронизация отменена/u);

    const [, update] = connectionModel.updateOne.mock.calls[0] as [
      unknown,
      { $set: { lastError: string } },
    ];

    expect(update.$set.lastError).toMatch(/^Синхронизация отменена: MyReviews вернул 0/u);
  });
});

describe('флаг вывода цели', () => {
  it('выставляет флаг только при создании записи', async () => {
    const { service, targetModel } = build();

    await service.run(CONNECTION_ID);

    const [operations] = targetModel.bulkWrite.mock.calls[0] as [
      { updateOne: { update: { $set: Record<string, unknown>; $setOnInsert: unknown } } }[],
    ];
    const [operation] = operations;

    expect(operation?.updateOne.update.$setOnInsert).toEqual({ isActive: true });
  });

  it('не сбрасывает флаг при обновлении цели', async () => {
    // Значение задает кабинет вручную, и прогон синхронизации не должен
    // возвращать его к исходному при каждом обновлении данных организации.
    const { service, targetModel } = build();

    await service.run(CONNECTION_ID);

    const [operations] = targetModel.bulkWrite.mock.calls[0] as [
      { updateOne: { update: { $set: Record<string, unknown> } } }[],
    ];

    expect(operations[0]?.updateOne.update.$set).not.toHaveProperty('isActive');
  });
});

describe('отбор отзывов', () => {
  it('пропускает скрытые отзывы и дубли', async () => {
    const { service, reviewModel } = build({
      reviews: [rawReview({ hidden: true }), rawReview({ id: 101, is_double: true })],
    });

    const result = await service.run(CONNECTION_ID);

    expect(result?.reviewsSkipped).toBe(2);
    expect(reviewModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('пропускает отзывы неизвестной организации', async () => {
    const { service } = build({ reviews: [rawReview({ firm_id: 999 })] });

    await expect(service.run(CONNECTION_ID)).resolves.toMatchObject({ reviewsSkipped: 1 });
  });

  it('записывает пригодные отзывы', async () => {
    const { service, reviewModel } = build();

    const result = await service.run(CONNECTION_ID);

    expect(result).toMatchObject({ reviewsSeen: 1, reviewsInserted: 1 });
    expect(reviewModel.bulkWrite).toHaveBeenCalledTimes(1);
  });
});

describe('удаление исчезнувших записей', () => {
  it('отказывается удалять больше половины отзывов', async () => {
    const { service } = build({ counts: { total: 10, stale: 6 } });

    await expect(service.run(CONNECTION_ID)).rejects.toThrow(/Удаление 6 отзывов из 10 отменено/u);
  });

  it('удаляет устаревшие отзывы в пределах порога', async () => {
    const { service, reviewModel } = build({ counts: { total: 10, stale: 5 } });

    await service.run(CONNECTION_ID);

    expect(reviewModel.deleteMany).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      syncedAt: { $lt: anyDate },
    });
  });

  it('не применяет порог к пустой базе', async () => {
    const { service } = build({ counts: { total: 0, stale: 0 } });

    await expect(service.run(CONNECTION_ID)).resolves.not.toBeNull();
  });

  it('удаляет отзывы исчезнувших организаций без учета порога', async () => {
    const { service, reviewModel } = build();

    await service.run(CONNECTION_ID);

    expect(reviewModel.deleteMany).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      targetId: { $nin: [TARGET_ID] },
    });
  });
});

describe('защита от пустой выдачи организаций', () => {
  it('прерывает прогон, если организаций нет, а в базе они есть', async () => {
    const { service, client } = build({ storedTargets: 3 });
    client.fetchFirms.mockResolvedValue([]);

    await expect(service.run(CONNECTION_ID)).rejects.toThrow(
      /MyReviews вернул 0 организаций, пригодных к записи нет, а в базе хранится 3/u,
    );
  });

  it('не удаляет ни целей, ни отзывов при пустой выдаче', async () => {
    const { service, client, targetModel, reviewModel } = build({ storedTargets: 3 });
    client.fetchFirms.mockResolvedValue([]);

    await expect(service.run(CONNECTION_ID)).rejects.toThrow(/Синхронизация отменена/u);

    expect(targetModel.bulkWrite).not.toHaveBeenCalled();
    expect(targetModel.deleteMany).not.toHaveBeenCalled();
    expect(reviewModel.deleteMany).not.toHaveBeenCalled();
  });

  it('прерывает прогон, когда ни одна организация не пригодна к записи', async () => {
    const { service, client } = build({ storedTargets: 3 });
    client.fetchFirms.mockResolvedValue([{ ...firm, type: 3 }]);

    await expect(service.run(CONNECTION_ID)).rejects.toThrow(
      /MyReviews вернул 1 организаций, пригодных к записи нет, а в базе хранится 3/u,
    );
  });

  it('оставляет подключение в состоянии ошибки с причиной отказа', async () => {
    const { service, client, connectionModel } = build({ storedTargets: 3 });
    const cancelReason: unknown = expect.stringContaining('Синхронизация отменена');
    client.fetchFirms.mockResolvedValue([]);

    await expect(service.run(CONNECTION_ID)).rejects.toThrow(/Синхронизация отменена/u);

    expect(connectionModel.updateOne).toHaveBeenCalledWith(
      { _id: CONNECTION_ID },
      { $set: containing({ status: ConnectionStatus.Error, lastError: cancelReason }) },
    );
  });

  it('синхронизирует кабинет без организаций без ошибки', async () => {
    const { service, client, targetModel } = build({
      storedTargets: 0,
      counts: { total: 0, stale: 0 },
    });
    client.fetchFirms.mockResolvedValue([]);

    await expect(service.run(CONNECTION_ID)).resolves.not.toBeNull();
    expect(targetModel.deleteMany).toHaveBeenCalled();
  });
});
