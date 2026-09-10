/** Настройки встраивания виджета на сайт клиента. */
export class WidgetResponseDto {
  /** Публичный ключ кабинета, подставляемый в код вставки. */
  apiKey: string;
  allowedDomains: string[];
  /** Готовый к вставке код виджета. */
  snippet: string;
}
