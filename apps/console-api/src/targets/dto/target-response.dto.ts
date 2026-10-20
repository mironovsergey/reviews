import type { ReviewTargetKind } from '@reviews/database';

/** Клиника или врач в таблице консоли. */
export class TargetResponseDto {
  id: string;
  kind: ReviewTargetKind;
  name: string;
  /** Специальность врача; у клиник null. */
  specialty: string | null;
  /** Выводится ли цель в виджете. */
  isActive: boolean;
  /** Число загруженных отзывов без учета условий вывода. */
  reviewsCount: number;
}
