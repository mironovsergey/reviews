import { z } from 'zod';

/** Состояние подключенной учетной записи агрегатора. */
export const ConnectionStateSchema = z.enum(['active', 'needs_reauth', 'error']);

/** Выполняется ли синхронизация в настоящий момент. */
export const SyncStateSchema = z.enum(['idle', 'running']);

/** Объем данных, загруженных в кабинет. */
export const ConnectionCountsSchema = z.object({
  clinics: z.number(),
  doctors: z.number(),
  reviews: z.number(),
});

/** Сведения о привязке учетной записи и о загруженных данных. */
export const ConnectionInfoSchema = z.object({
  connected: z.boolean(),
  /** Логин учетной записи агрегатора; null, пока она не привязана. */
  email: z.string().nullable(),
  status: ConnectionStateSchema.nullable(),
  syncState: SyncStateSchema.nullable(),
  /** Синхронизация запрошена и ожидает обработчика. */
  syncRequested: z.boolean(),
  tokenExpiresAt: z.string().nullable(),
  lastSyncFinishedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  counts: ConnectionCountsSchema,
});

/** Итог запроса синхронизации. */
export const SyncTriggerSchema = z.object({
  /** Значение false означает, что синхронизация уже выполняется. */
  started: z.boolean(),
});

export type ConnectionState = z.infer<typeof ConnectionStateSchema>;
export type SyncState = z.infer<typeof SyncStateSchema>;
export type ConnectionInfo = z.infer<typeof ConnectionInfoSchema>;
