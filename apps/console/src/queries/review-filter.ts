import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../api/fetcher';
import {
  ReviewFilterSchema,
  type ReviewFilter,
  type ReviewFilterPatch,
} from '../schemas/review-filter';

const REVIEW_FILTER_PATH = '/widget/review-filter';

/** Ключ изменений условий: по нему считаются изменения, ожидающие ответа. */
const UPDATE_REVIEW_FILTER_KEY = ['review-filter', 'update'];

export const reviewFilterQuery = () =>
  queryOptions({
    queryKey: ['review-filter'],
    queryFn: ({ signal }) => fetcher(REVIEW_FILTER_PATH, ReviewFilterSchema, { signal }),
  });

/** Условия до изменения; восстанавливаются при отказе сервера. */
interface UpdateSnapshot {
  previous: ReviewFilter | undefined;
}

/**
 * Изменение условий вывода.
 *
 * Условие сохраняется сразу при выборе, поэтому новое значение выводится до
 * ответа сервера, а при отказе возвращается прежнее. Передается только
 * измененная часть: прочие условия сервер оставляет как есть.
 *
 * Состояние перечитывается после последнего из одновременных изменений.
 * Ответы приходят в произвольном порядке, и запись ответа на раннее
 * изменение поверх позднего вернула бы на экран устаревшее значение.
 */
export const useUpdateReviewFilterMutation = () => {
  const queryClient = useQueryClient();
  const { queryKey } = reviewFilterQuery();

  return useMutation({
    mutationKey: UPDATE_REVIEW_FILTER_KEY,
    mutationFn: (patch: ReviewFilterPatch) =>
      fetcher(REVIEW_FILTER_PATH, ReviewFilterSchema, { method: 'PATCH', body: patch }),
    onMutate: async (patch): Promise<UpdateSnapshot> => {
      // Ответ ранее начатого чтения перезаписал бы выбранное значение.
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData(queryKey);

      if (previous !== undefined) {
        queryClient.setQueryData(queryKey, { ...previous, ...patch });
      }

      return { previous };
    },
    onError: (_error, _patch, snapshot) => {
      if (snapshot?.previous !== undefined) {
        queryClient.setQueryData(queryKey, snapshot.previous);
      }
    },
    onSettled: async () => {
      // Текущее изменение еще учитывается в счетчике.
      if (queryClient.isMutating({ mutationKey: UPDATE_REVIEW_FILTER_KEY }) === 1) {
        await queryClient.invalidateQueries({ queryKey });
      }
    },
  });
};
