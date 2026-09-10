import type { Types } from 'mongoose';
import { Review, ReviewTarget, ReviewTargetKind, toNameWords } from '@reviews/database';
import { mapFirmType, mapServiceCode } from './aggregator-codes';
import type { AggregatorRawFirm, AggregatorRawReview } from '@reviews/aggregator';

const DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/u;
const MIN_RATING = 1;
const MAX_RATING = 5;

/** Ссылка на сохраненную цель, к которой относится отзыв. */
export interface ReviewTargetRef {
  id: Types.ObjectId;
  kind: ReviewTargetKind;
}

/**
 * Разбирает дату агрегатора вида «дд.мм.гггг» в полночь UTC.
 *
 * Времени в исходных данных нет, а UTC снимает зависимость от часового пояса
 * сервера: publishedAt участвует в сортировке и в курсоре пагинации, и при
 * смене пояса порядок отзывов не должен меняться.
 *
 * Возвращает null вместо исключения: одна битая дата не должна ронять
 * синхронизацию целиком, такой отзыв просто пропускается.
 */
export const parseAggregatorDate = (value: string): Date | null => {
  const match = DATE_PATTERN.exec(value);

  if (match === null) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  // Отсекаем несуществующие даты вроде 31.02.2026, которые Date молча сдвигает.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

/**
 * Возвращает null для организаций тех типов, которых нет в нашей модели.
 *
 * Флаг вывода в результат не входит: им распоряжается кабинет, а прогон
 * переносит только данные агрегатора. Тип это закрепляет - попытка передать
 * `isActive` отсюда не пройдет проверку типов.
 */
export const toReviewTargetProps = (
  firm: AggregatorRawFirm,
  workspaceId: Types.ObjectId,
): Omit<ReviewTarget, 'isActive'> | null => {
  const kind = mapFirmType(firm.type);

  if (kind === null) {
    return null;
  }

  const name = firm.name.trim();

  if (name.length === 0) {
    return null;
  }

  return {
    workspaceId,
    externalId: firm.id,
    externalUuid: firm.uuid,
    kind,
    name,
    nameWords: toNameWords(name),
    specialty: firm.product_category,
  };
};

/**
 * Возвращает null, если отзыв непригоден к показу: без текста, без автора,
 * с нераспознанной датой или с рейтингом вне шкалы. Такой отзыв пропускается.
 */
export const toReviewProps = (
  raw: AggregatorRawReview,
  workspaceId: Types.ObjectId,
  target: ReviewTargetRef,
  syncedAt: Date,
): Review | null => {
  const publishedAt = parseAggregatorDate(raw.date_create);

  if (publishedAt === null) {
    return null;
  }

  const text = raw.message.trim();
  const authorName = raw.username.trim();

  if (text.length === 0 || authorName.length === 0) {
    return null;
  }

  if (!Number.isInteger(raw.rating) || raw.rating < MIN_RATING || raw.rating > MAX_RATING) {
    return null;
  }

  return {
    workspaceId,
    targetId: target.id,
    targetKind: target.kind,
    sourceId: raw.id,
    source: mapServiceCode(raw.service),
    sourceCode: raw.service,
    authorName,
    rating: raw.rating,
    text,
    answer: raw.answer,
    originUrl: raw.url,
    publishedAt,
    syncedAt,
  };
};
