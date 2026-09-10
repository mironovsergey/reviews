import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Connection,
  ConnectionDocument,
  ConnectionStatus,
  Review,
  ReviewTarget,
  ReviewTargetKind,
  SyncState,
} from '@reviews/database';
import {
  AggregatorAuthError,
  AggregatorClient,
  parseTokenExpiry,
  TokenCipher,
} from '@reviews/aggregator';
import type { ConnectAccountDto } from './dto/connect-account.dto';
import type { ConnectionCountsDto, ConnectionResponseDto } from './dto/connection-response.dto';

/** Запасной срок, если в токене не оказалось поля exp. */
const FALLBACK_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Признак выполняемого прогона.
 *
 * Одного состояния недостаточно: при аварийном завершении процесса
 * подключение осталось бы помечено выполняемой синхронизацией, и ручной
 * запуск из консоли навсегда получал бы отказ. Захват с истекшим сроком
 * считается брошенным, и прогон разрешен.
 */
const isSyncRunning = (connection: ConnectionDocument): boolean =>
  connection.syncState === SyncState.Running &&
  connection.syncLockedUntil !== null &&
  connection.syncLockedUntil.getTime() > Date.now();

/**
 * Привязка учетной записи агрегатора и состояние загрузки данных.
 *
 * Сама загрузка выполняется отдельным обработчиком: она занимает секунды и
 * не должна задерживать ответ консоли.
 */
@Injectable()
export class ConnectionService {
  constructor(
    @InjectModel(Connection.name)
    private readonly connectionModel: Model<Connection>,
    @InjectModel(ReviewTarget.name) private readonly targetModel: Model<ReviewTarget>,
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    private readonly client: AggregatorClient,
    private readonly cipher: TokenCipher,
  ) {}

  /**
   * Привязывает учетную запись агрегатора: обменивает пароль на токен и
   * сохраняет только токен, запрашивая первичную загрузку.
   */
  async connect(
    workspaceId: Types.ObjectId,
    dto: ConnectAccountDto,
  ): Promise<ConnectionResponseDto> {
    const email = dto.email.toLowerCase().trim();
    const token = await this.obtainToken(email, dto.password);
    const profile = await this.client.fetchProfile(token);
    const encrypted = this.cipher.encrypt(token);

    await this.connectionModel.findOneAndUpdate(
      { workspaceId },
      {
        $set: {
          email,
          externalUserId: profile.id,
          tokenCiphertext: encrypted.ciphertext,
          tokenIv: encrypted.iv,
          tokenAuthTag: encrypted.authTag,
          tokenExpiresAt: parseTokenExpiry(token) ?? new Date(Date.now() + FALLBACK_TOKEN_TTL_MS),
          status: ConnectionStatus.Active,
          // Срок захвата снимается вместе с состоянием: признак выполняемого
          // прогона составлен из обоих полей, и оставленный срок заставил бы
          // isSyncRunning считать прогон идущим при свободном состоянии.
          syncState: SyncState.Idle,
          syncLockedUntil: null,
          lastError: null,
          // Первичная загрузка запрашивается сразу: без нее кабинет пуст.
          syncRequestedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    return this.getStatus(workspaceId);
  }

  /** Возвращает состояние подключения вместе со счетчиками загруженных данных. */
  async getStatus(workspaceId: Types.ObjectId): Promise<ConnectionResponseDto> {
    const [connection, clinics, doctors, reviews] = await Promise.all([
      this.connectionModel.findOne({ workspaceId }),
      this.targetModel.countDocuments({ workspaceId, kind: ReviewTargetKind.Clinic }),
      this.targetModel.countDocuments({ workspaceId, kind: ReviewTargetKind.Doctor }),
      this.reviewModel.countDocuments({ workspaceId }),
    ]);

    return this.toResponse(connection, { clinics, doctors, reviews });
  }

  /**
   * Запрашивает синхронизацию у обработчика.
   *
   * Возвращает false, если прогон уже выполняется: повторный запрос ничего
   * не изменил бы, а консоль показала бы вводящее в заблуждение сообщение.
   */
  async triggerSync(workspaceId: Types.ObjectId): Promise<{ started: boolean }> {
    const connection = await this.connectionModel.findOne({ workspaceId });

    if (connection === null) {
      throw new NotFoundException('Аккаунт MyReviews не подключен');
    }

    if (isSyncRunning(connection)) {
      return { started: false };
    }

    await this.connectionModel.updateOne(
      { _id: connection._id },
      { $set: { syncRequestedAt: new Date() } },
    );

    return { started: true };
  }

  /**
   * Обменивает учетные данные на токен агрегатора.
   *
   * Отказ учетных данных и недоступность службы различаются: первый требует
   * действий клиента, второй проходит сам.
   */
  private async obtainToken(email: string, password: string): Promise<string> {
    try {
      return await this.client.login(email, password);
    } catch (error) {
      if (error instanceof AggregatorAuthError) {
        throw new UnauthorizedException('MyReviews отклонил эти учетные данные');
      }

      throw new ServiceUnavailableException('Сервис MyReviews временно недоступен');
    }
  }

  /** Переводит запись подключения в ответ консоли. */
  private toResponse(
    connection: ConnectionDocument | null,
    counts: ConnectionCountsDto,
  ): ConnectionResponseDto {
    if (connection === null) {
      return {
        connected: false,
        email: null,
        status: null,
        syncState: null,
        syncRequested: false,
        tokenExpiresAt: null,
        lastSyncFinishedAt: null,
        lastError: null,
        counts,
      };
    }

    return {
      connected: true,
      email: connection.email,
      status: connection.status,
      syncState: connection.syncState,
      syncRequested: connection.syncRequestedAt !== null,
      tokenExpiresAt: connection.tokenExpiresAt.toISOString(),
      lastSyncFinishedAt: connection.lastSyncFinishedAt?.toISOString() ?? null,
      lastError: connection.lastError,
      counts,
    };
  }
}
