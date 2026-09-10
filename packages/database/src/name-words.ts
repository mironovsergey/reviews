/**
 * Максимум слов запроса, которые учитывает поиск по ФИО.
 */
export const NAME_SEARCH_MAX_WORDS = 5;

/** Дефис разделяет слова: запрос «Водкина» находит «Петрова-Водкина». */
const WORD_SEPARATOR = /[\s-]+/u;

const REGEXP_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/gu;

const escapeRegExp = (value: string): string => {
  return value.replace(REGEXP_SPECIAL_CHARS, '\\$&');
};

/**
 * Разбивает имя на нормализованные слова. Массив хранится в документе и
 * обеспечивает префиксный поиск по multikey-индексу.
 *
 * Сравнение регистронезависимо, буква «ё» сводится к «е», поэтому написания
 * «Фёдоров» и «Федоров» равнозначны.
 */
export const toNameWords = (name: string): string[] => {
  return name
    .toLowerCase()
    .replaceAll('ё', 'е')
    .split(WORD_SEPARATOR)
    .filter((word) => word.length > 0);
};

/**
 * Составляет по шаблону на каждое слово запроса с привязкой к началу слова.
 *
 * Каждое слово запроса должно совпадать с началом какого-либо слова имени.
 * Шаблоны объединяются через AND на стороне вызывающего, порядок слов
 * значения не имеет: запрос «Натал» находит Наталью, запрос «атал» - нет.
 */
export const toNamePrefixPatterns = (query: string): RegExp[] => {
  return toNameWords(query)
    .slice(0, NAME_SEARCH_MAX_WORDS)
    .map((word) => new RegExp(`^${escapeRegExp(word)}`, 'u'));
};
