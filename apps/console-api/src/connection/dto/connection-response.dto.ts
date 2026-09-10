import type { ConnectionStatus, SyncState } from '@reviews/database';

/** Объем данных кабинета, загруженных от агрегатора. */
export class ConnectionCountsDto {
  clinics: number;
  doctors: number;
  reviews: number;
}

/**
 * Состояние привязки учетной записи агрегатора.
 *
 * Отсутствующее подключение описывается тем же ответом с признаком
 * `connected: false`, поэтому поля подключения допускают null.
 */
export class ConnectionResponseDto {
  connected: boolean;
  /** Логин учетной записи агрегатора. */
  email: string | null;
  status: ConnectionStatus | null;
  syncState: SyncState | null;
  /** Синхронизация запрошена и ожидает обработчика. */
  syncRequested: boolean;
  /** ISO 8601; срок действия сохраненного токена. */
  tokenExpiresAt: string | null;
  /** ISO 8601; null, если синхронизация еще не завершалась. */
  lastSyncFinishedAt: string | null;
  /** Причина последнего неудачного прогона. */
  lastError: string | null;
  counts: ConnectionCountsDto;
}
