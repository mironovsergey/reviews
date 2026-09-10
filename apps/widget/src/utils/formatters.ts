const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/**
 * Дата вида «20 июня 2025».
 *
 * Бэкенд передает полночь по UTC, поэтому разбор выполняется в UTC: иначе
 * для посетителей западнее Гринвича дата смещается на сутки назад.
 */
export const formatReviewDate = (isoDate: string): string => {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = MONTHS_GENITIVE[date.getUTCMonth()] ?? '';

  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
};

/** Значение атрибута datetime: только дата, без времени. */
export const toDateAttribute = (isoDate: string): string => {
  const date = new Date(isoDate);

  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

/** Инициалы для заглушки аватара: «Лякин Андрей» дает «ЛА». */
export const getInitials = (name: string): string => {
  return name
    .split(/[\s-]+/u)
    .filter((word) => word.length > 0)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
};
