/** Пользователь консоли в ответах входа и регистрации. */
export class AuthUserResponseDto {
  id: string;
  email: string;
  name: string;
}

/** Результат входа и регистрации. */
export class AuthResponseDto {
  /** JWT консоли; не путать с токеном агрегатора. */
  token: string;
  user: AuthUserResponseDto;
  workspaceId: string;
}

/** Текущий пользователь вместе с его кабинетом. */
export class CurrentUserResponseDto {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
}
