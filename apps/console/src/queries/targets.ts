import { queryOptions } from '@tanstack/react-query';
import { fetcher } from '../api/fetcher';
import { TargetListSchema, type TargetKind } from '../schemas/target';

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
