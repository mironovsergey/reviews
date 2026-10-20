import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../api/fetcher';
import { TargetListSchema, TargetSchema, type TargetKind } from '../schemas/target';
import { optimisticUpdate } from './optimistic-update';

/**
 * Клиники или врачи кабинета.
 *
 * Перечень меняет синхронизация, которая идет в отдельном процессе и о своем
 * завершении консоль не уведомляет. Поэтому при каждом открытии страницы он
 * запрашивается заново: до ответа выводится сохраненный, затем свежий.
 */
export const targetsQuery = (kind: TargetKind) =>
  queryOptions({
    queryKey: ['targets', kind],
    queryFn: ({ signal }) => fetcher(`/targets?kind=${kind}`, TargetListSchema, { signal }),
    staleTime: 0,
  });

/** Изменение флага вывода одной цели. */
export interface UpdateTargetInput {
  id: string;
  isActive: boolean;
}

/**
 * Включение и отключение вывода цели в виджете.
 *
 * Переключатель срабатывает сразу, и новое состояние строки выводится до
 * ответа сервера.
 */
export const useUpdateTargetMutation = (kind: TargetKind) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: UpdateTargetInput) =>
      fetcher(`/targets/${encodeURIComponent(id)}`, TargetSchema, {
        method: 'PATCH',
        body: { isActive },
      }),
    ...optimisticUpdate(queryClient, {
      queryKey: targetsQuery(kind).queryKey,
      mutationKey: ['targets', kind, 'update'],
      apply: (rows, { id, isActive }: UpdateTargetInput) =>
        rows.map((row) => (row.id === id ? { ...row, isActive } : row)),
    }),
  });
};
