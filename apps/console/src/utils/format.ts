/** Подпись вместо отсутствующей или непригодной даты. */
const MISSING_DATE = 'нет данных';

/** Дата и время в местной зоне: «4 августа 2026, 17:25». */
export const formatDateTime = (iso: string | null): string => {
  if (iso === null) {
    return MISSING_DATE;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return MISSING_DATE;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

/** Только дата; применяется для срока действия токена. */
export const formatDate = (iso: string | null): string => {
  if (iso === null) {
    return MISSING_DATE;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return MISSING_DATE;
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const PLURAL_RULES = new Intl.PluralRules('ru-RU');

/** Склонение: 1 отзыв, 2 отзыва, 5 отзывов. */
export const plural = (count: number, forms: [string, string, string]): string => {
  const category = PLURAL_RULES.select(count);
  const index = category === 'one' ? 0 : category === 'few' ? 1 : 2;

  return `${count} ${forms[index]}`;
};
