/**
 * Примитивы проверки типов для разбора ответов.
 *
 * Виджет размещается на стороннем сайте, поэтому неожиданный ответ должен
 * приводить к сообщению об ошибке, а не к отказу страницы.
 */

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isUnknownArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value);
};

/** Непустая строка либо null: бэкенд передает и null, и пустую строку. */
export const optionalString = (value: unknown): string | null => {
  return typeof value === 'string' && value.length > 0 ? value : null;
};
