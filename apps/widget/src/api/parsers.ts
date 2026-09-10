import { isRecord, isUnknownArray, optionalString } from '../utils/guards';
import type { Review, ReviewsPage, ReviewTargetKind, Target } from './types';

/** Разбор ответов API виджета. */

export const isTargetKind = (value: unknown): value is ReviewTargetKind => {
  return value === 'clinic' || value === 'doctor';
};

export const parseTarget = (value: unknown): Target | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { id, kind, name } = value;

  if (typeof id !== 'string' || !isTargetKind(kind) || typeof name !== 'string') {
    return null;
  }

  return { id, kind, name, specialty: optionalString(value.specialty) };
};

export const parseReview = (value: unknown): Review | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { id, authorName, rating, text, publishedAt, source } = value;
  const target = parseTarget(value.target);

  if (
    typeof id !== 'string' ||
    typeof authorName !== 'string' ||
    typeof rating !== 'number' ||
    typeof text !== 'string' ||
    typeof publishedAt !== 'string' ||
    typeof source !== 'string' ||
    target === null
  ) {
    return null;
  }

  return {
    id,
    authorName,
    rating,
    // Переводы строк внутри текста значимы и выводятся без изменений. По
    // краям они избыточны: при `white-space: pre-line` образуются пустые
    // строки.
    text: text.trim(),
    publishedAt,
    source,
    answer: optionalString(value.answer),
    originUrl: optionalString(value.originUrl),
    target,
  };
};

/** Непригодные элементы пропускаются: один отзыв не нарушает вывод ленты. */
export const parseList = <T>(value: unknown, parseItem: (item: unknown) => T | null): T[] => {
  if (!isUnknownArray(value)) {
    return [];
  }

  const items: T[] = [];

  for (const raw of value) {
    const parsed = parseItem(raw);

    if (parsed !== null) {
      items.push(parsed);
    }
  }

  return items;
};

export const parseReviewsPage = (value: unknown): ReviewsPage => {
  if (!isRecord(value)) {
    return { items: [], nextCursor: null };
  }

  return {
    items: parseList(value.items, parseReview),
    nextCursor: optionalString(value.nextCursor),
  };
};
