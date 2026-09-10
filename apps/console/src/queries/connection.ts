import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../api/fetcher';
import { ConnectionInfoSchema, SyncTriggerSchema } from '../schemas/connection';

/** Периодичность запроса состояния, пока идет или ожидается синхронизация. */
const SYNC_POLL_INTERVAL_MS = 3000;

export const connectionQuery = () =>
  queryOptions({
    queryKey: ['connection'],
    queryFn: ({ signal }) => fetcher('/connection', ConnectionInfoSchema, { signal }),
    // Загрузку выполняет отдельный обработчик, поэтому опрос продолжается и
    // пока запрос только принят: иначе консоль не увидела бы начала прогона.
    refetchInterval: (query) => {
      const data = query.state.data;
      const pending = data?.syncState === 'running' || data?.syncRequested === true;

      return pending ? SYNC_POLL_INTERVAL_MS : false;
    },
  });

interface ConnectInput {
  email: string;
  password: string;
}

/**
 * Привязка учетной записи агрегатора. Пароль передается одним запросом и не
 * сохраняется ни на сервере, ни в состоянии консоли.
 */
export const useConnectMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ConnectInput) =>
      fetcher('/connection', ConnectionInfoSchema, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (data) => {
      // Ответ содержит актуальное состояние, дополнительный запрос не требуется.
      queryClient.setQueryData(connectionQuery().queryKey, data);
    },
  });
};

export const useSyncMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => fetcher('/connection/sync', SyncTriggerSchema, { method: 'POST' }),
    onSuccess: async () => {
      // Состояние перечитывается, чтобы показать начатую синхронизацию.
      await queryClient.invalidateQueries({ queryKey: connectionQuery().queryKey });
    },
  });
};
