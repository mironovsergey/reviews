import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model, Types } from 'mongoose';
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
  AggregatorRateLimitError,
  AggregatorResponseError,
  TokenCipher,
} from '@reviews/aggregator';
import { toReviewProps, toReviewTargetProps, type ReviewTargetRef } from './sync.mapper';

/**
 * Срок действия захвата прогона.
 *
 * Прогон занимает секунды, поэтому запас взят с избытком: за это время
 * успевает завершиться и синхронизация крупного кабинета. По истечении
 * срока захват считается брошенным и может быть перехвачен.
 */
const SYNC_LOCK_TTL_MS = 15 * 60 * 1000;

/** Размер пачки для bulkWrite: соотношение числа обращений и объема запроса. */
const BULK_BATCH_SIZE = 500;

/**
 * Доля отзывов, которую разрешено удалить за один прогон.
 *
 * Обход выполняется с сортировкой по убыванию id, поэтому появление новых
 * отзывов во время прохода может сместить страницы и скрыть часть записей.
 * Без этого ограничения единичный сбой агрегатора приводит к очистке базы,
 * восстановление которой невозможно.
 */
const MAX_DELETE_RATIO = 0.5;

/**
 * Прогон прерван проверкой самой синхронизации.
 *
 * Сообщение такой ошибки составлено здесь и пригодно для показа в консоли,
 * в отличие от сообщений сторонних сбоев.
 */
export class SyncAbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncAbortedError';
  }
}

/**
 * Переводит сбой прогона в сообщение для консоли.
 *
 * Наружу выпускается только классифицированный текст: сообщения сторонних
 * ошибок содержат внутренние пути, имена узлов и подробности работы
 * шифрования, которым в интерфейсе клиента не место. Исходное сообщение
 * остается в журнале обработчика.
 */
const toClientReason = (error: unknown): string => {
  if (error instanceof SyncAbortedError) {
    return error.message;
  }

  if (error instanceof AggregatorAuthError) {
    return 'MyReviews отклонил токен доступа: подключите аккаунт заново';
  }

  if (error instanceof AggregatorRateLimitError) {
    return 'MyReviews ограничил частоту запросов, загрузка повторится позже';
  }

  if (error instanceof AggregatorResponseError) {
    return 'MyReviews вернул ответ неожиданного вида';
  }

  if (error instanceof AggregatorError) {
    return 'MyReviews временно недоступен';
  }

  return 'Загрузка не удалась из-за внутренней ошибки';
};

export interface SyncResult {
  targetsUpserted: number;
  targetsDeleted: number;
  /** Отзывы, отсутствовавшие в базе. */
  reviewsInserted: number;
  /** Всего отзывов, принятых к записи за прогон. */
  reviewsSeen: number;
  reviewsDeleted: number;
  reviewsSkipped: number;
}

interface TargetSyncResult {
  upserted: number;
  deleted: number;
  refs: Map<number, ReviewTargetRef>;
}

/** Загрузка клиник, врачей и отзывов от агрегатора в базу кабинета. */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectModel(Connection.name)
    private readonly connectionModel: Model<Connection>,
    @InjectModel(ReviewTarget.name) private readonly targetModel: Model<ReviewTarget>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    private readonly client: AggregatorClient,
    private readonly cipher: TokenCipher,
  ) {}

  /**
   * Полностью синхронизирует один рабочий кабинет.
   *
   * Возвращает null, если синхронизация этого подключения уже выполняется.
   */
  async run(connectionId: Types.ObjectId): Promise<SyncResult | null> {
    const startedAt = new Date();
    const connection = await this.acquire(connectionId, startedAt);

    if (connection === null) {
      this.logger.warn(`Синхронизация подключения ${connectionId.toString()} уже выполняется`);

      return null;
    }

    try {
      const token = this.cipher.decrypt({
        ciphertext: connection.tokenCiphertext,
        iv: connection.tokenIv,
        authTag: connection.tokenAuthTag,
      });

      const result = await this.syncWorkspace(connection.workspaceId, token, startedAt);

      await this.release(connectionId, ConnectionStatus.Active, null);

      this.logger.log(
        `Кабинет ${connection.workspaceId.toString()} синхронизирован: ` +
          `цели +${result.targetsUpserted}/-${result.targetsDeleted}, ` +
          `отзывы ${result.reviewsSeen} принято, ${result.reviewsInserted} новых, ` +
          `${result.reviewsDeleted} удалено, ${result.reviewsSkipped} пропущено`,
      );

      return result;
    } catch (error) {
      // Отклоненный токен не является временным сбоем: до переподключения
      // аккаунта повторные запросы бесполезны.
      const status =
        error instanceof AggregatorAuthError
          ? ConnectionStatus.NeedsReauth
          : ConnectionStatus.Error;

      await this.release(connectionId, status, toClientReason(error));

      throw error;
    }
  }

  /**
   * Переводит подключение в состояние выполняемой синхронизации.
   *
   * Условие на текущее состояние делает захват атомарным: расписание и
   * ручной запуск не выполняют один прогон дважды. Захват с истекшим сроком
   * перехватывается: он остался от процесса, завершившегося аварийно.
   */
  private acquire(id: Types.ObjectId, startedAt: Date): Promise<ConnectionDocument | null> {
    return this.connectionModel.findOneAndUpdate(
      {
        _id: id,
        $or: [
          { syncState: SyncState.Idle },
          // Записи, созданные до появления срока, признаются брошенными.
          { syncLockedUntil: null },
          { syncLockedUntil: { $lte: startedAt } },
        ],
      },
      {
        $set: {
          syncState: SyncState.Running,
          lastSyncStartedAt: startedAt,
          syncLockedUntil: new Date(startedAt.getTime() + SYNC_LOCK_TTL_MS),
        },
      },
      { returnDocument: 'after' },
    );
  }

  /** Завершает прогон, фиксируя итоговое состояние подключения. */
  private async release(
    id: Types.ObjectId,
    status: ConnectionStatus,
    lastError: string | null,
  ): Promise<void> {
    await this.connectionModel.updateOne(
      { _id: id },
      {
        $set: {
          syncState: SyncState.Idle,
          syncLockedUntil: null,
          status,
          lastError,
          lastSyncFinishedAt: new Date(),
        },
      },
    );
  }

  /** Загружает цели, затем отзывы: отзыв привязывается к уже сохраненной цели. */
  private async syncWorkspace(
    workspaceId: Types.ObjectId,
    token: string,
    startedAt: Date,
  ): Promise<SyncResult> {
    const targets = await this.syncTargets(workspaceId, token);
    const reviews = await this.syncReviews(workspaceId, token, startedAt, targets.refs);

    return {
      targetsUpserted: targets.upserted,
      targetsDeleted: targets.deleted,
      ...reviews,
    };
  }

  /** Клиники и врачи приходят одним списком и различаются полем `type`. */
  private async syncTargets(workspaceId: Types.ObjectId, token: string): Promise<TargetSyncResult> {
    const firms = await this.client.fetchFirms(token);

    const operations: AnyBulkWriteOperation<ReviewTarget>[] = [];
    const externalIds: number[] = [];

    for (const firm of firms) {
      const props = toReviewTargetProps(firm, workspaceId);

      if (props === null) {
        continue;
      }

      externalIds.push(props.externalId);
      operations.push({
        updateOne: {
          filter: { workspaceId, externalId: props.externalId },
          // Флаг вывода задается кабинетом вручную, поэтому прогон выставляет
          // его только при создании записи и не сбрасывает при обновлении.
          update: { $set: props, $setOnInsert: { isActive: true } },
          upsert: true,
        },
      });
    }

    // Пустой список неотличим от удаления всех организаций в кабинете, но сбой
    // агрегатора или изменение формата ответа несопоставимо вероятнее. Цена
    // ошибки несимметрична: externalIds служит фильтром удаления целей ниже, а
    // отзывы исчезнувших организаций удаляются без учета MAX_DELETE_RATIO,
    // поэтому такой прогон стер бы данные кабинета безвозвратно. Проверка
    // выполняется до записи; пустой кабинет синхронизируется без помех.
    if (externalIds.length === 0) {
      const stored = await this.targetModel.countDocuments({ workspaceId });

      if (stored > 0) {
        throw new SyncAbortedError(
          `Синхронизация отменена: MyReviews вернул ${firms.length} организаций, ` +
            `пригодных к записи нет, а в базе хранится ${stored}`,
        );
      }
    }

    if (operations.length > 0) {
      await this.targetModel.bulkWrite(operations);
    }

    // Организаций единицы, поэтому сверка по списку идентификаторов обходится
    // дешевле сверки по меткам времени.
    const removed = await this.targetModel.deleteMany({
      workspaceId,
      externalId: { $nin: externalIds },
    });

    const stored = await this.targetModel.find({ workspaceId }).select('_id externalId kind');
    const refs = new Map<number, ReviewTargetRef>();

    for (const target of stored) {
      refs.set(target.externalId, { id: target._id, kind: target.kind });
    }

    // Отзывы отсутствующих организаций удаляются сразу, без учета порога
    // ниже: это не частичная выдача данных, а исчезновение самого объекта,
    // например при переключении на другой аккаунт. Иначе такие отзывы
    // остаются без цели, и каждый последующий прогон упирается в защиту от
    // массового удаления.
    await this.reviewModel.deleteMany({
      workspaceId,
      targetId: { $nin: stored.map((target) => target._id) },
    });

    return { upserted: operations.length, deleted: removed.deletedCount, refs };
  }

  /**
   * Обходит отзывы аккаунта постранично и записывает их пачками.
   *
   * Отзывы, непригодные к показу либо принадлежащие неизвестной цели,
   * пропускаются и учитываются отдельным счетчиком.
   */
  private async syncReviews(
    workspaceId: Types.ObjectId,
    token: string,
    startedAt: Date,
    refs: Map<number, ReviewTargetRef>,
  ): Promise<Omit<SyncResult, 'targetsUpserted' | 'targetsDeleted'>> {
    let operations: AnyBulkWriteOperation<Review>[] = [];
    let inserted = 0;
    let seen = 0;
    let skipped = 0;

    const flush = async (): Promise<void> => {
      if (operations.length === 0) {
        return;
      }

      // Валидаторы схемы для updateOne внутри bulkWrite не выполняются, что
      // проверено; опция throwOnValidationError на них не влияет. Пригодность
      // данных обеспечивает sync.mapper.
      const result = await this.reviewModel.bulkWrite(operations);

      inserted += result.upsertedCount;
      seen += operations.length;
      operations = [];
    };

    for await (const batch of this.client.iterateReviews(token)) {
      for (const raw of batch) {
        // Скрытые отзывы и дубли не выводятся. Присутствующий в базе отзыв
        // не получает нового syncedAt и удаляется при сверке.
        if (raw.hidden || raw.is_double) {
          skipped += 1;
          continue;
        }

        const target = refs.get(raw.firm_id);

        if (target === undefined) {
          skipped += 1;
          continue;
        }

        const props = toReviewProps(raw, workspaceId, target, startedAt);

        if (props === null) {
          skipped += 1;
          continue;
        }

        operations.push({
          updateOne: {
            filter: { workspaceId, sourceId: props.sourceId },
            update: { $set: props },
            upsert: true,
          },
        });
      }

      if (operations.length >= BULK_BATCH_SIZE) {
        await flush();
      }
    }

    await flush();

    const deleted = await this.reconcile(workspaceId, startedAt);

    return {
      reviewsInserted: inserted,
      reviewsSeen: seen,
      reviewsDeleted: deleted,
      reviewsSkipped: skipped,
    };
  }

  /**
   * Удаляет отзывы, отсутствующие в выдаче агрегатора: у них сохранился
   * syncedAt прошлого прогона. К ним же относятся отзывы, ставшие скрытыми
   * или помеченные как дубли.
   */
  private async reconcile(workspaceId: Types.ObjectId, startedAt: Date): Promise<number> {
    const [total, stale] = await Promise.all([
      this.reviewModel.countDocuments({ workspaceId }),
      this.reviewModel.countDocuments({ workspaceId, syncedAt: { $lt: startedAt } }),
    ]);

    if (total > 0 && stale > total * MAX_DELETE_RATIO) {
      throw new SyncAbortedError(
        `Удаление ${stale} отзывов из ${total} отменено: ` +
          `MyReviews вернул значительно меньше отзывов, чем хранится`,
      );
    }

    const removed = await this.reviewModel.deleteMany({
      workspaceId,
      syncedAt: { $lt: startedAt },
    });

    return removed.deletedCount;
  }
}
