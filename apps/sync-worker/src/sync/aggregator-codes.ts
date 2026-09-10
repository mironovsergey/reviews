import { ReviewSource, ReviewTargetKind } from '@reviews/database';

/**
 * Поле `type` организации у агрегатора. Клиника и врач представлены одной
 * сущностью и различаются только этим полем.
 */
export const AGGREGATOR_FIRM_TYPE_MAP: Readonly<Partial<Record<number, ReviewTargetKind>>> = {
  1: ReviewTargetKind.Clinic,
  5: ReviewTargetKind.Doctor,
};

/** Возвращает null для типов, отсутствующих в модели; такие записи пропускаются. */
export const mapFirmType = (type: number): ReviewTargetKind | null => {
  return AGGREGATOR_FIRM_TYPE_MAP[type] ?? null;
};

/**
 * Поле `service` отзыва у агрегатора; полный перечень возвращает
 * GET /v1/firm/services. Коды, отсутствующие в карте, сводятся к
 * ReviewSource.Other.
 */
export const AGGREGATOR_SERVICE_MAP: Readonly<Partial<Record<number, ReviewSource>>> = {
  1: ReviewSource.Yandex,
  2: ReviewSource.Google,
  3: ReviewSource.TwoGis,
  4: ReviewSource.Zoon,
  5: ReviewSource.Yell,
  6: ReviewSource.MyReviews,
  7: ReviewSource.ProDoctorov,
  8: ReviewSource.Flamp,
  9: ReviewSource.Hosters,
  10: ReviewSource.Otzovik,
  11: ReviewSource.HostingsInfo,
  12: ReviewSource.YandexServices,
  13: ReviewSource.Avito,
  14: ReviewSource.NaPopravku,
  15: ReviewSource.YandexBusiness,
  16: ReviewSource.SberZdorovie,
  17: ReviewSource.TBank,
  18: ReviewSource.Vk,
  19: ReviewSource.Trustpilot,
  20: ReviewSource.Hosting101,
  21: ReviewSource.IRecommend,
  22: ReviewSource.Perekrestok,
  23: ReviewSource.Metro,
  24: ReviewSource.Magnit,
  25: ReviewSource.Lenta,
  26: ReviewSource.Kuper,
  27: ReviewSource.ProDoctorovDoctors,
  28: ReviewSource.MySpar,
};

export const mapServiceCode = (code: number): ReviewSource => {
  return AGGREGATOR_SERVICE_MAP[code] ?? ReviewSource.Other;
};
