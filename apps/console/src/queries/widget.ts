import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../api/fetcher';
import { WidgetInfoSchema } from '../schemas/widget';
import { optimisticUpdate } from './optimistic-update';

export const widgetQuery = () =>
  queryOptions({
    queryKey: ['widget'],
    queryFn: ({ signal }) => fetcher('/widget', WidgetInfoSchema, { signal }),
  });

/**
 * Сохранение списка доменов.
 *
 * Список сохраняется сразу при добавлении или удалении домена и выводится
 * до ответа сервера. Запрос несет список целиком, поэтому следующее
 * изменение строится от уже выведенного списка: иначе второй из двух быстро
 * добавленных доменов вытеснил бы первый.
 *
 * Сервер нормализует домены; перечитывание после последнего изменения
 * выводит на экран его версию.
 */
export const useSaveDomainsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (domains: string[]) =>
      fetcher('/widget/domains', WidgetInfoSchema, {
        method: 'PUT',
        body: { domains },
      }),
    ...optimisticUpdate(queryClient, {
      queryKey: widgetQuery().queryKey,
      mutationKey: ['widget', 'domains'],
      apply: (current, domains: string[]) => ({ ...current, allowedDomains: domains }),
    }),
  });
};
