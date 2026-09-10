/**
 * Исходные ответы API агрегатора. Описаны только используемые поля;
 * фактические ответы заметно шире.
 */

/** Отзыв из GET /v1/review/index. */
export interface AggregatorRawReview {
  id: number;
  username: string;
  /** Дата в формате «дд.мм.гггг», без времени и часового пояса. */
  date_create: string;
  rating: number;
  message: string;
  firm_id: number;
  service: number;
  hidden: boolean;
  is_double: boolean;
  answer: string | null;
  url: string | null;
}

/**
 * Организация из GET /v1/firm/list. Клиника и врач приходят одной структурой
 * и различаются полем `type`.
 */
export interface AggregatorRawFirm {
  id: number;
  uuid: string;
  type: number;
  name: string;
  /** Специальность врача, у клиник пусто. */
  product_category: string | null;
}

/** Профиль из GET /v1/user/profile. */
export interface AggregatorRawProfile {
  id: number;
  email: string;
}

/** Страница отзывов со счетчиками из заголовков x-pagination-*. */
export interface AggregatorReviewPage {
  items: AggregatorRawReview[];
  /** null, если сервер не прислал заголовок. */
  pageCount: number | null;
  totalCount: number | null;
}
