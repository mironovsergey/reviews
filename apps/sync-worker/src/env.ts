import { DatabaseEnv, DecodesToBytes } from '@reviews/config';
import { IsBase64, IsUrl } from 'class-validator';

/** Длина ключа AES-256. */
const TOKEN_KEY_BYTES = 32;

/**
 * Переменные окружения обработчика синхронизации.
 *
 * Порт не требуется: обработчик не принимает запросы, а работает по
 * расписанию и по отметкам в хранилище. Значений по умолчанию нет:
 * незаданная переменная останавливает запуск.
 */
export class SyncWorkerEnv extends DatabaseEnv {
  /** Ключ AES-256 для расшифровки токенов агрегатора. */
  @IsBase64({}, { message: 'TOKEN_ENCRYPTION_KEY: ключ должен быть закодирован в base64' })
  @DecodesToBytes(TOKEN_KEY_BYTES, {
    message: `TOKEN_ENCRYPTION_KEY: ключ должен раскодироваться в ${TOKEN_KEY_BYTES} байт`,
  })
  TOKEN_ENCRYPTION_KEY: string;

  @IsUrl({ require_tld: false }, { message: 'AGGREGATOR_BASE_URL: требуется адрес вида https://…' })
  AGGREGATOR_BASE_URL: string;
}
