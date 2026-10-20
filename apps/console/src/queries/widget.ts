import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../api/fetcher';
import { WidgetInfoSchema, type WidgetInfo } from '../schemas/widget';

/** Ключ изменений списка доменов: по нему считаются изменения, ожидающие ответа. */
const SAVE_DOMAINS_KEY = ['widget', 'domains'];

export const widgetQuery = () =>
  queryOptions({
    queryKey: ['widget'],
    queryFn: ({ signal }) => fetcher('/widget', WidgetInfoSchema, { signal }),
  });

/** Настройки до изменения; восстанавливаются при отказе сервера. */
interface SaveDomainsSnapshot {
  previous: WidgetInfo | undefined;
}

/**
 * Сохранение списка доменов.
 *
 * Список сохраняется сразу при добавлении или удалении домена и выводится
 * до ответа сервера, а при отказе возвращается прежний. Запрос несет список
 * целиком, поэтому следующее изменение строится от уже выведенного списка:
 * иначе второй из двух быстро добавленных доменов вытеснил бы первый.
 *
 * Сервер нормализует домены, поэтому после последнего из одновременных
 * изменений список перечитывается и на экран попадает версия сервера.
 */
export const useSaveDomainsMutation = () => {
  const queryClient = useQueryClient();
  const { queryKey } = widgetQuery();

  return useMutation({
    mutationKey: SAVE_DOMAINS_KEY,
    mutationFn: (domains: string[]) =>
      fetcher('/widget/domains', WidgetInfoSchema, {
        method: 'PUT',
        body: { domains },
      }),
    onMutate: async (domains): Promise<SaveDomainsSnapshot> => {
      // Ответ ранее начатого чтения перезаписал бы измененный список.
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData(queryKey);

      if (previous !== undefined) {
        queryClient.setQueryData(queryKey, { ...previous, allowedDomains: domains });
      }

      return { previous };
    },
    onError: (_error, _domains, snapshot) => {
      if (snapshot?.previous !== undefined) {
        queryClient.setQueryData(queryKey, snapshot.previous);
      }
    },
    onSettled: async () => {
      // Текущее изменение еще учитывается в счетчике.
      if (queryClient.isMutating({ mutationKey: SAVE_DOMAINS_KEY }) === 1) {
        await queryClient.invalidateQueries({ queryKey });
      }
    },
  });
};
