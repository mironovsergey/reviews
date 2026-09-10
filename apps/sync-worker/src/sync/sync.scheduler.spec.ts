import { Model, Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { Connection, ConnectionStatus, SyncState } from '@reviews/database';
import { SyncScheduler } from './sync.scheduler';
import { SyncService, type SyncResult } from './sync.service';

const CONNECTION_ID = new Types.ObjectId();
const REQUESTED_AT = new Date('2026-09-09T12:00:00.000Z');

/** Матчер Vitest объявлен как any и сохраняется отдельным значением. */
const anyDate: unknown = expect.any(Date);

const result: SyncResult = {
  targetsUpserted: 1,
  targetsDeleted: 0,
  reviewsInserted: 1,
  reviewsSeen: 1,
  reviewsDeleted: 0,
  reviewsSkipped: 0,
};

/**
 * Отметку запроса выбирает и снимает один запрос findOneAndUpdate, поэтому
 * подставная модель отдает подключение ровно один раз: иначе обход в
 * runRequested не завершился бы.
 */
const build = (options: { run?: SyncResult | null | Error } = {}) => {
  const connectionModel = {
    find: vi.fn().mockResolvedValue([]),
    findOneAndUpdate: vi
      .fn()
      .mockResolvedValueOnce({ _id: CONNECTION_ID, syncRequestedAt: REQUESTED_AT })
      .mockResolvedValue(null),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const outcome = options.run === undefined ? result : options.run;
  const syncService = {
    run: vi
      .fn()
      .mockImplementation(() =>
        outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome),
      ),
  };

  return {
    scheduler: new SyncScheduler(
      connectionModel as unknown as Model<Connection>,
      syncService as unknown as SyncService,
    ),
    connectionModel,
    syncService,
  };
};

describe('запросы синхронизации из консоли', () => {
  it('не выбирает подключение с действующим захватом', async () => {
    const { scheduler, connectionModel } = build();

    await scheduler.runRequested();

    const [filter] = connectionModel.findOneAndUpdate.mock.calls[0] as [
      { syncRequestedAt: unknown; $or: Record<string, unknown>[] },
    ];

    expect(filter.syncRequestedAt).toEqual({ $ne: null });
    expect(filter.$or).toContainEqual({ syncState: SyncState.Idle });
    expect(filter.$or).toContainEqual({ syncLockedUntil: null });
    expect(filter.$or).toContainEqual({ syncLockedUntil: { $lte: anyDate } });
  });

  it('снимает отметку запроса, когда прогон состоялся', async () => {
    const { scheduler, connectionModel, syncService } = build();

    await scheduler.runRequested();

    expect(syncService.run).toHaveBeenCalledWith(CONNECTION_ID);
    expect(connectionModel.updateOne).not.toHaveBeenCalled();
  });

  it('возвращает отметку, если захват заняли перед началом прогона', async () => {
    const { scheduler, connectionModel } = build({ run: null });

    await scheduler.runRequested();

    expect(connectionModel.updateOne).toHaveBeenCalledWith(
      { _id: CONNECTION_ID, syncRequestedAt: null },
      { $set: { syncRequestedAt: REQUESTED_AT } },
    );
  });

  it('не возвращает отметку после сбоя прогона', async () => {
    const { scheduler, connectionModel } = build({ run: new Error('сеть недоступна') });

    await scheduler.runRequested();

    expect(connectionModel.updateOne).not.toHaveBeenCalled();
  });
});

describe('плановая синхронизация', () => {
  it('пропускает подключения, ожидающие переавторизации', async () => {
    const { scheduler, connectionModel } = build();

    await scheduler.runAll();

    expect(connectionModel.find).toHaveBeenCalledWith({
      status: { $ne: ConnectionStatus.NeedsReauth },
    });
  });
});
