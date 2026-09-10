import type { z } from 'zod';

/** Сообщения об ошибках по именам полей формы. */
export type FieldErrors = Partial<Record<string, string>>;

/**
 * Сводит результат разбора Zod к карте «поле - первое сообщение». Вывод
 * одной ошибки на поле достаточен и не перегружает форму.
 */
export const collectFieldErrors = (error: z.ZodError): FieldErrors => {
  const errors: FieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === 'string' && errors[field] === undefined) {
      errors[field] = issue.message;
    }
  }

  return errors;
};
