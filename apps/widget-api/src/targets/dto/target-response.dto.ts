import type { ReviewTargetKind } from '@reviews/database';

/** Клиника или врач в фильтре виджета. */
export class TargetResponseDto {
  id: string;
  kind: ReviewTargetKind;
  name: string;
  /** Специальность врача; у клиник null. */
  specialty: string | null;
}
