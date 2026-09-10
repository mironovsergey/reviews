import { z } from 'zod';

/** Настройки встраивания виджета на сайт клиента. */
export const WidgetInfoSchema = z.object({
  /** Публичный ключ кабинета. */
  apiKey: z.string(),
  /** Домены, которым разрешено встраивать виджет. */
  allowedDomains: z.array(z.string()),
  /** Готовый код для вставки на сайт. */
  snippet: z.string(),
});

export type WidgetInfo = z.infer<typeof WidgetInfoSchema>;
