import { z } from 'zod';

/** Условия вывода отзывов в виджете. */
export const ReviewFilterSchema = z.object({
  /** Наименьшая выводимая оценка; null, если ограничения нет. */
  minRating: z.number().nullable(),
});

export type ReviewFilter = z.infer<typeof ReviewFilterSchema>;

/** Изменение части условий: отсутствующее поле остается прежним. */
export type ReviewFilterPatch = Partial<ReviewFilter>;
