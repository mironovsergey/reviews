import type { AggregatorRawFirm, AggregatorRawProfile, AggregatorRawReview } from './types';

/**
 * Разбор ответов агрегатора. Тело имеет тип unknown, поэтому структура
 * проверяется во время выполнения: приведение типов создает ложную
 * уверенность в данных, находящихся вне контроля приложения.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isUnknownArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value);
};

/** Непустая строка либо null: агрегатор передает и null, и пустую строку. */
const optionalString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

/**
 * Формат ответа неоднороден: GET /v1/review/index возвращает массив,
 * остальные методы - объект {status, message, data}. Обрабатываются оба.
 */
export const unwrapPayload = (value: unknown): unknown => {
  if (isRecord(value) && 'data' in value) {
    return value.data;
  }

  return value;
};

export const parseReview = (value: unknown): AggregatorRawReview | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { id, username, date_create, rating, message, firm_id, service } = value;

  if (
    typeof id !== 'number' ||
    typeof username !== 'string' ||
    typeof date_create !== 'string' ||
    typeof rating !== 'number' ||
    typeof message !== 'string' ||
    typeof firm_id !== 'number' ||
    typeof service !== 'number'
  ) {
    return null;
  }

  return {
    id,
    username,
    date_create,
    rating,
    message,
    firm_id,
    service,
    // Флаги приходят не всегда; отсутствие трактуем как «не скрыт, не дубль».
    hidden: value.hidden === true,
    is_double: value.is_double === true,
    answer: optionalString(value.answer),
    url: optionalString(value.url),
  };
};

export const parseFirm = (value: unknown): AggregatorRawFirm | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { id, uuid, type, name } = value;

  if (
    typeof id !== 'number' ||
    typeof uuid !== 'string' ||
    typeof type !== 'number' ||
    typeof name !== 'string'
  ) {
    return null;
  }

  return {
    id,
    uuid,
    type,
    name,
    product_category: optionalString(value.product_category),
  };
};

export const parseProfile = (value: unknown): AggregatorRawProfile | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { id, email } = value;

  if (typeof id !== 'number' || typeof email !== 'string') {
    return null;
  }

  return { id, email };
};

/** Токен логина лежит в data.jwt. */
export const parseLoginToken = (value: unknown): string | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { jwt } = value;

  return typeof jwt === 'string' && jwt.length > 0 ? jwt : null;
};

/**
 * Извлекает срок действия из JWT агрегатора.
 *
 * Подпись не проверяется: секрет принадлежит стороннему сервису, а
 * требуется лишь момент, когда потребуется переподключение.
 */
export const parseTokenExpiry = (token: string): Date | null => {
  const parts = token.split('.');

  if (parts.length !== 3) {
    return null;
  }

  let payload: unknown;

  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const { exp } = payload;

  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    return null;
  }

  return new Date(exp * 1000);
};

/**
 * Разбирает массив, пропуская непригодные элементы и считая их отдельно:
 * один битый отзыв не должен ронять синхронизацию целиком.
 */
export const parseList = <T>(
  value: unknown,
  parseItem: (item: unknown) => T | null,
): { items: T[]; malformed: number } | null => {
  if (!isUnknownArray(value)) {
    return null;
  }

  const items: T[] = [];
  let malformed = 0;

  for (const raw of value) {
    const parsed = parseItem(raw);

    if (parsed === null) {
      malformed += 1;
      continue;
    }

    items.push(parsed);
  }

  return { items, malformed };
};
