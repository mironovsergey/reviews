import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ReviewTargetKind } from '@reviews/database';

/** Условия отбора клиник и врачей для фильтра виджета. */
export class ListTargetsQueryDto {
  /** Без указания возвращаются и клиники, и врачи. */
  @IsOptional()
  @IsIn(Object.values(ReviewTargetKind), { message: 'Допустимые значения kind: clinic, doctor' })
  kind?: ReviewTargetKind;

  /** Пословный префиксный поиск по имени. */
  @IsOptional()
  @IsString({ message: 'Строка поиска должна быть строкой' })
  @MaxLength(120, { message: 'Строка поиска должна содержать не более 120 символов' })
  search?: string;

  /** Размер выборки; при отсутствии применяется значение по умолчанию. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Предел должен быть целым числом' })
  @Min(1, { message: 'Предел должен быть не меньше 1' })
  @Max(100, { message: 'Предел должен быть не больше 100' })
  limit?: number;
}
