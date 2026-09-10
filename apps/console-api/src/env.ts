import { DatabaseEnv, DecodesToBytes, IsTcpPort } from '@reviews/config';
import { IsBase64, IsNotEmpty, IsString, IsUrl, MinLength } from 'class-validator';

/** Длина ключа AES-256. */
const TOKEN_KEY_BYTES = 32;

/**
 * Нижняя граница длины секрета подписи.
 *
 * Короткий секрет подбирается перебором, а подделанный токен консоли дает
 * доступ к чужому кабинету.
 */
const MIN_JWT_SECRET_LENGTH = 16;

/**
 * Переменные окружения API консоли управления.
 *
 * Значений по умолчанию нет: каждое задается в .env, и незаданная переменная
 * останавливает запуск. Тихая подстановка скрывала бы ошибку настройки до
 * первого обращения клиента.
 */
export class ConsoleApiEnv extends DatabaseEnv {
  @IsTcpPort('CONSOLE_API_PORT')
  CONSOLE_API_PORT: number;

  @IsString({ message: 'JWT_SECRET: секрет подписи должен быть строкой' })
  @MinLength(MIN_JWT_SECRET_LENGTH, {
    message: `JWT_SECRET: секрет подписи должен содержать не менее ${MIN_JWT_SECRET_LENGTH} символов`,
  })
  JWT_SECRET: string;

  /** Ключ AES-256 для шифрования токенов агрегатора. */
  @IsBase64({}, { message: 'TOKEN_ENCRYPTION_KEY: ключ должен быть закодирован в base64' })
  @DecodesToBytes(TOKEN_KEY_BYTES, {
    message: `TOKEN_ENCRYPTION_KEY: ключ должен раскодироваться в ${TOKEN_KEY_BYTES} байт`,
  })
  TOKEN_ENCRYPTION_KEY: string;

  @IsUrl({ require_tld: false }, { message: 'AGGREGATOR_BASE_URL: требуется адрес вида https://…' })
  AGGREGATOR_BASE_URL: string;

  /** Адрес скрипта виджета, подставляемый в код вставки. */
  @IsString({ message: 'WIDGET_SCRIPT_URL: адрес скрипта должен быть строкой' })
  @IsNotEmpty({ message: 'WIDGET_SCRIPT_URL: адрес скрипта не может быть пустым' })
  WIDGET_SCRIPT_URL: string;
}
