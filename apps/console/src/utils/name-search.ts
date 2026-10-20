/** Дефис разделяет слова, как и пробел: запрос «Водкина» находит «Петрова-Водкина». */
const WORD_SEPARATOR = /[\s-]+/u;

/** Буква «е» с двумя точками (U+0451): при сравнении сводится к «е». */
const E_WITH_DIAERESIS = '\u0451';

/** Разбивает строку на слова в нижнем регистре. */
const toWords = (value: string): string[] => {
  return value
    .toLowerCase()
    .replaceAll(E_WITH_DIAERESIS, 'е')
    .split(WORD_SEPARATOR)
    .filter((word) => word.length > 0);
};

/**
 * Совпадает ли имя с поисковым запросом.
 *
 * Правило то же, что у поиска врача в виджете: каждое слово запроса должно
 * совпасть с началом какого-либо слова имени, порядок слов значения не
 * имеет. Запрос без слов совпадает с любым именем.
 *
 * Поиск выполняется в браузере: перечень приходит целиком, а разбор имени из
 * пакета базы данных сюда не подключить, он тянет за собой Mongoose.
 */
export const matchesNameQuery = (name: string, query: string): boolean => {
  const nameWords = toWords(name);

  return toWords(query).every((queryWord) =>
    nameWords.some((nameWord) => nameWord.startsWith(queryWord)),
  );
};
