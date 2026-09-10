/** Клиника или врач: предмет отзыва. */
export type ReviewTargetKind = 'clinic' | 'doctor';

export interface Target {
  id: string;
  kind: ReviewTargetKind;
  name: string;
  /** Специальность врача; у клиник null. */
  specialty: string | null;
}

/**
 * Код площадки: yandex, google, 2gis, prodoctorov и другие. Перечень ведет
 * бэкенд, поэтому тип объявлен строкой: неизвестное значение выводится без
 * подписи.
 */
export type ReviewSource = string;

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  /** ISO 8601. */
  publishedAt: string;
  source: ReviewSource;
  answer: string | null;
  originUrl: string | null;
  target: Target;
}

export interface ReviewsPage {
  items: Review[];
  /** null означает, что следующей страницы нет. */
  nextCursor: string | null;
}

export interface ListReviewsParams {
  targetId?: string | null;
  cursor?: string | null;
  limit?: number;
}
