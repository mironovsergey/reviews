/** Условия вывода отзывов в виджете. */
export class ReviewFilterResponseDto {
  /** Наименьшая выводимая оценка; null, если ограничения нет. */
  minRating: number | null;
}
