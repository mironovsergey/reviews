import type { ReviewSource, ReviewTargetKind } from '@reviews/database';

/** Предмет отзыва: подпись под карточкой в виджете. */
export class ReviewTargetResponseDto {
  id: string;
  kind: ReviewTargetKind;
  /** Пустая строка, если запись цели удалена синхронизацией. */
  name: string;
  /** Специальность врача; у клиник null. */
  specialty: string | null;
}

/** Отзыв в ленте виджета. */
export class ReviewResponseDto {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  /** ISO 8601; форматирование по локали выполняет виджет. */
  publishedAt: string;
  source: ReviewSource;
  /** Ответ клиники на отзыв. */
  answer: string | null;
  /** Ссылка на отзыв на исходной площадке. */
  originUrl: string | null;
  target: ReviewTargetResponseDto;
}

/** Страница ленты отзывов. */
export class ListReviewsResponseDto {
  items: ReviewResponseDto[];
  /** Положение для следующего запроса; null означает конец ленты. */
  nextCursor: string | null;
}
