import { z } from 'zod';

/** Вид цели отзыва. */
export const TargetKindSchema = z.enum(['clinic', 'doctor']);

/** Клиника или врач в таблице консоли. */
export const TargetSchema = z.object({
  id: z.string(),
  kind: TargetKindSchema,
  name: z.string(),
  /** Специальность врача; у клиник null. */
  specialty: z.string().nullable(),
  /** Выводится ли цель в виджете. */
  isActive: z.boolean(),
  /** Число загруженных отзывов без учета условий вывода. */
  reviewsCount: z.number(),
});

export const TargetListSchema = z.array(TargetSchema);

export type TargetKind = z.infer<typeof TargetKindSchema>;
export type Target = z.infer<typeof TargetSchema>;
