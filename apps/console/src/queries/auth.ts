import { useSyncExternalStore } from 'react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { fetcher } from '../api/fetcher';
import { getToken, setToken, subscribeToken } from '../api/auth-token';
import { AuthResponseSchema, CurrentUserSchema, type CurrentUser } from '../schemas/auth';

/**
 * Текущий пользователь. Ответ 401 означает отсутствие сессии, а не сбой,
 * поэтому повторный запрос не выполняется.
 */
export const currentUserQuery = () =>
  queryOptions({
    queryKey: ['current-user'],
    queryFn: ({ signal }) => fetcher('/auth/me', CurrentUserSchema, { signal }),
    retry: false,
    staleTime: Infinity,
  });

interface Session {
  /** Токен имеется, но сервером не подтвержден. */
  isChecking: boolean;
  isAuthenticated: boolean;
  user: CurrentUser | null;
}

/**
 * Состояние сессии для страниц.
 *
 * При отсутствии сохраненного токена запрос не отправляется: он заведомо
 * вернет 401, а экран входа должен открываться сразу.
 *
 * Токен читается подпиской, а не прямым обращением: его сбрасывает обработчик
 * отказа 401 вне дерева компонентов, и без уведомления страница осталась бы
 * на месте с недействительной сессией.
 */
export const useSession = (): Session => {
  const hasToken = useSyncExternalStore(subscribeToken, getToken) !== null;
  const query = useQuery({ ...currentUserQuery(), enabled: hasToken });

  return {
    isChecking: hasToken && query.isPending,
    isAuthenticated: query.isSuccess,
    user: query.data ?? null,
  };
};

interface SignInInput {
  email: string;
  password: string;
}

interface SignUpInput extends SignInInput {
  name: string;
  workspaceName?: string;
}

export const useSignInMutation = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: SignInInput) =>
      fetcher('/auth/signin', AuthResponseSchema, { method: 'POST', body: input }),
    onSuccess: async (data) => {
      setToken(data.token);
      // Данные предыдущей сессии более не актуальны.
      await queryClient.invalidateQueries();
      // Переход выполняется явно: запрос текущего пользователя включается
      // по наличию токена, появление которого не вызывает перерисовку формы.
      await navigate('/', { replace: true });
    },
  });
};

export const useSignUpMutation = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: SignUpInput) =>
      fetcher('/auth/signup', AuthResponseSchema, { method: 'POST', body: input }),
    onSuccess: async (data) => {
      setToken(data.token);
      await queryClient.invalidateQueries();
      await navigate('/', { replace: true });
    },
  });
};

/** Завершение сессии: очистка токена и кэша с переходом на экран входа. */
export const useSignOut = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (): void => {
    setToken(null);
    queryClient.clear();
    void navigate('/signin', { replace: true });
  };
};
