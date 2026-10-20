import { IsIn } from 'class-validator';
import { ReviewTargetKind } from '@reviews/database';

/** Условия отбора клиник или врачей для таблицы консоли. */
export class ListTargetsQueryDto {
  /** Вид цели: клиники и врачи выводятся на разных страницах. */
  @IsIn(Object.values(ReviewTargetKind), { message: 'Допустимые значения kind: clinic, doctor' })
  kind: ReviewTargetKind;
}
