import { z } from 'zod';

/** Пользователь консоли. */
export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});

/** Результат входа и регистрации. */
export const AuthResponseSchema = z.object({
  /** JWT нашей консоли; не путать с токеном агрегатора. */
  token: z.string(),
  user: AuthUserSchema,
  workspaceId: z.string(),
});

/** Текущий пользователь вместе с его кабинетом. */
export const CurrentUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  workspaceId: z.string(),
  workspaceName: z.string(),
});

export type CurrentUser = z.infer<typeof CurrentUserSchema>;
