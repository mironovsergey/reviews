import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';

/** Условия отбора страницы ленты отзывов. */
export class ListReviewsQueryDto {
  /**
   * Идентификатор клиники или врача. Фильтры в виджете взаимоисключающие,
   * поэтому параметр один на оба случая.
   */
  @IsOptional()
  @IsMongoId({ message: 'Недопустимый идентификатор клиники или врача' })
  targetId?: string;

  /** Положение в ленте, полученное с предыдущей страницей. */
  @IsOptional()
  @IsString({ message: 'Курсор должен быть строкой' })
  cursor?: string;

  /** Размер страницы; при отсутствии применяется значение по умолчанию. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Предел должен быть целым числом' })
  @Min(1, { message: 'Предел должен быть не меньше 1' })
  @Max(50, { message: 'Предел должен быть не больше 50' })
  limit?: number;
}
