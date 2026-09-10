import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../api/fetcher';
import { WidgetInfoSchema } from '../schemas/widget';

export const widgetQuery = () =>
  queryOptions({
    queryKey: ['widget'],
    queryFn: ({ signal }) => fetcher('/widget', WidgetInfoSchema, { signal }),
  });

export const useSaveDomainsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (domains: string[]) =>
      fetcher('/widget/domains', WidgetInfoSchema, {
        method: 'PUT',
        body: { domains },
      }),
    onSuccess: (data) => {
      // Сервер нормализует домены, поэтому используется его версия списка.
      queryClient.setQueryData(widgetQuery().queryKey, data);
    },
  });
};
