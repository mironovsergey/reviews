import { DatabaseEnv, IsTcpPort } from '@reviews/config';

/**
 * Переменные окружения API виджета.
 *
 * Наружу отдаются только отзывы и цели, поэтому ни секрет подписи, ни ключ
 * шифрования здесь не нужны. Значений по умолчанию нет: незаданная
 * переменная останавливает запуск.
 */
export class WidgetApiEnv extends DatabaseEnv {
  @IsTcpPort('WIDGET_API_PORT')
  WIDGET_API_PORT: number;
}
