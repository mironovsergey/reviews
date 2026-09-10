import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Workspace } from './workspace.schema';

/** Состояние подключенной учетной записи агрегатора. */
export const ConnectionStatus = {
  Active: 'active',
  /** Сохраненный токен отклонен: требуется повторная привязка учетной записи. */
  NeedsReauth: 'needs_reauth',
  Error: 'error',
} as const;

export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

/** Признак выполняемого прогона синхронизации. */
export const SyncState = {
  Idle: 'idle',
  Running: 'running',
} as const;

export type SyncState = (typeof SyncState)[keyof typeof SyncState];

/** Привязка учетной записи агрегатора к кабинету и состояние загрузки. */
@Schema({ timestamps: true, collection: 'connections' })
export class Connection {
  /** Кабинет; допускается одно подключение на кабинет. */
  @Prop({ type: Types.ObjectId, ref: Workspace.name, required: true, unique: true })
  workspaceId: Types.ObjectId;

  /** Логин учетной записи агрегатора; выводится в консоли. */
  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  /** Идентификатор владельца учетной записи у агрегатора. */
  @Prop({ required: true })
  externalUserId: number;

  /**
   * Токен агрегатора, зашифрованный AES-256-GCM. Пароль от учетной записи не
   * сохраняется: он применяется однократно для получения токена.
   */
  @Prop({ required: true })
  tokenCiphertext: string;

  /** Вектор инициализации AES-256-GCM для сохраненного токена. */
  @Prop({ required: true })
  tokenIv: string;

  /** Тег аутентификации AES-256-GCM: обнаруживает подмену шифротекста. */
  @Prop({ required: true })
  tokenAuthTag: string;

  /** Разобрано из поля `exp` токена; у агрегатора срок составляет около 167 дней. */
  @Prop({ required: true })
  tokenExpiresAt: Date;

  @Prop({
    type: String,
    enum: Object.values(ConnectionStatus),
    required: true,
    default: ConnectionStatus.Active,
  })
  status: ConnectionStatus;

  @Prop({
    type: String,
    enum: Object.values(SyncState),
    required: true,
    default: SyncState.Idle,
  })
  syncState: SyncState;

  /**
   * Срок действия захвата прогона.
   *
   * Признака `syncState` недостаточно: при аварийном завершении процесса
   * подключение осталось бы в состоянии выполняемой синхронизации навсегда.
   * По истечении срока захват считается брошенным и подлежит перехвату.
   */
  @Prop({ type: Date, default: null })
  syncLockedUntil: Date | null;

  /**
   * Отметка запроса синхронизации из консоли.
   *
   * Консоль и загрузка данных выполняются разными процессами, поэтому запрос
   * передается через хранилище: обработчик опрашивает подключения и снимает
   * отметку, забирая прогон в работу.
   */
  @Prop({ type: Date, default: null })
  syncRequestedAt: Date | null;

  /** Начало последнего прогона. */
  @Prop({ type: Date, default: null })
  lastSyncStartedAt: Date | null;

  /** Завершение последнего прогона, успешного или нет. */
  @Prop({ type: Date, default: null })
  lastSyncFinishedAt: Date | null;

  /** Причина последнего неудачного прогона; выводится в консоли. */
  @Prop({ type: String, default: null })
  lastError: string | null;
}

export type ConnectionDocument = HydratedDocument<Connection>;

export const ConnectionSchema = SchemaFactory.createForClass(Connection);
