import { describe, expect, it } from 'vitest';
import { NAME_SEARCH_MAX_WORDS, toNamePrefixPatterns, toNameWords } from './name-words';

/** Проверяет шаблоны на строке, как это делает Mongo при поиске. */
const matches = (query: string, name: string): boolean => {
  const words = toNameWords(name);

  return toNamePrefixPatterns(query).every((pattern) => words.some((word) => pattern.test(word)));
};

describe('разбор имени на слова', () => {
  it('приводит к нижнему регистру', () => {
    expect(toNameWords('Иванов Пётр')).toEqual(['иванов', 'петр']);
  });

  it('сводит «ё» к «е»', () => {
    expect(toNameWords('Фёдоров')).toEqual(toNameWords('Федоров'));
  });

  it('разделяет слова по дефису', () => {
    expect(toNameWords('Петрова-Водкина')).toEqual(['петрова', 'водкина']);
  });

  it('отбрасывает пустые слова между разделителями', () => {
    expect(toNameWords('  Иванов --  Пётр  ')).toEqual(['иванов', 'петр']);
  });

  it('возвращает пустой массив для строки из разделителей', () => {
    expect(toNameWords('  -  ')).toEqual([]);
  });
});

describe('шаблоны префиксного поиска', () => {
  it('привязывает шаблон к началу слова', () => {
    expect(matches('Натал', 'Наталья Иванова')).toBe(true);
    expect(matches('атал', 'Наталья Иванова')).toBe(false);
  });

  it('не зависит от порядка слов запроса', () => {
    expect(matches('Иванова Наталья', 'Наталья Иванова')).toBe(true);
  });

  it('требует совпадения каждого слова запроса', () => {
    expect(matches('Наталья Петрова', 'Наталья Иванова')).toBe(false);
  });

  it('находит вторую часть двойной фамилии', () => {
    expect(matches('Водкина', 'Петрова-Водкина Мария')).toBe(true);
  });

  it('находит «Фёдоров» по написанию через «е»', () => {
    expect(matches('Федор', 'Фёдоров Иван')).toBe(true);
  });

  it('экранирует спецсимволы регулярного выражения', () => {
    // Без экранирования точка совпала бы с любым знаком, а скобка сделала бы
    // шаблон недопустимым и уронила бы запрос.
    expect(() => toNamePrefixPatterns('и.а (')).not.toThrow();
    expect(matches('и.а', 'Ива Петрова')).toBe(false);
    expect(matches('и.а', 'и.а Петрова')).toBe(true);
  });

  it('ограничивает число слов запроса', () => {
    const query = 'аа бб вв гг дд ее жж';

    expect(toNamePrefixPatterns(query)).toHaveLength(NAME_SEARCH_MAX_WORDS);
  });

  it('возвращает пустой список для запроса без слов', () => {
    expect(toNamePrefixPatterns('   ')).toEqual([]);
  });
});
