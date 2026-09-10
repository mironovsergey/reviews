import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, ConnectionStatus, SyncState } from '@reviews/database';
import { Model, Types } from 'mongoose';
import { SyncService } from './sync.service';

/** Полная синхронизация всех кабинетов: дважды в сутки, в 03:00 и 15:00. */
const FULL_SYNC_CRON = '0 3,15 * * *';

/**
 * Часовой пояс расписания.
 *
 * Задан явно: без него отсчет ведется по времени процесса, а в контейнере
 * это UTC, и ночной прогон пришелся бы на утро рабочего дня.
 */
const SCHEDULE_TIME_ZONE = 'Europe/Moscow';

/** Опрос запросов из консоли. */
const REQUEST_POLL_CRON = '*/15 * * * * *';

@Injectable()
export class SyncScheduler {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    @InjectModel(Connection.name) private readonly connectionModel: Model<Connection>,
    private readonly syncService: SyncService,
  ) {}

  /** Последовательно синхронизирует все пригодные подключения. */
  @Cron(FULL_SYNC_CRON, { timeZone: SCHEDULE_TIME_ZONE })
  async runAll(): Promise<void> {
    // Подключения, ожидающие переавторизации, пропускаются: их токен заведомо
    // отклоняется, а попытка расходует лимит запросов.
    const connections = await this.connectionModel.find({
      status: { $ne: ConnectionStatus.NeedsReauth },
    });

    this.logger.log(`Плановая синхронизация запущена для подключений: ${connections.length}`);

    for (const connection of connections) {
      await this.runOne(connection._id);
    }
  }

  /**
   * Забирает в работу подключения, синхронизацию которых запросила консоль.
   *
   * Отметка снимается тем же запросом, что и выбирает подключение, поэтому
   * один запрос не приводит к двум прогонам даже при нескольких обработчиках.
   * Подключения с действующим захватом не выбираются, а если захват заняли
   * между выбором и началом прогона, отметка возвращается: иначе запрос
   * консоли исчезал бы, не приводя к синхронизации.
   *
   * Тик не накладывается на предыдущий: обход длится дольше промежутка между
   * запусками, а параллельные проходы боролись бы за одни и те же записи.
   */
  @Cron(REQUEST_POLL_CRON, { waitForCompletion: true })
  async runRequested(): Promise<void> {
    for (;;) {
      // Условие на свободный захват повторяет условие SyncService.acquire:
      // захват с истекшим сроком остался от процесса, завершившегося
      // аварийно, и признается брошенным.
      const connection = await this.connectionModel.findOneAndUpdate(
        {
          syncRequestedAt: { $ne: null },
          $or: [
            { syncState: SyncState.Idle },
            { syncLockedUntil: null },
            { syncLockedUntil: { $lte: new Date() } },
          ],
        },
        { $set: { syncRequestedAt: null } },
      );

      if (connection === null) {
        return;
      }

      this.logger.log(`Синхронизация подключения ${connection._id.toString()} по запросу консоли`);

      if (!(await this.runOne(connection._id))) {
        await this.restoreRequest(connection._id, connection.syncRequestedAt);
      }
    }
  }

  /**
   * Возвращает отметку запроса, если прогон не состоялся.
   *
   * Условие на пустую отметку сохраняет более новый запрос: он появился уже
   * после того, как этот был взят в работу, и отменять его нельзя.
   */
  private async restoreRequest(id: Types.ObjectId, requestedAt: Date | null): Promise<void> {
    await this.connectionModel.updateOne(
      { _id: id, syncRequestedAt: null },
      { $set: { syncRequestedAt: requestedAt ?? new Date() } },
    );
  }

  /**
   * Отказ одного кабинета не должен останавливать остальные.
   *
   * Возвращает false, только если прогон не состоялся: захват занят другим
   * обработчиком. Сбой самого прогона возвращает true - работа выполнялась,
   * и повторять ее в этом же тике бессмысленно.
   */
  private async runOne(connectionId: Types.ObjectId): Promise<boolean> {
    try {
      return (await this.syncService.run(connectionId)) !== null;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';

      this.logger.error(
        `Синхронизация подключения ${connectionId.toString()} не удалась: ${reason}`,
      );

      return true;
    }
  }
}
