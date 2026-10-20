import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetcher } from '../api/fetcher';
import { ReviewFilterSchema, type ReviewFilterPatch } from '../schemas/review-filter';
import { optimisticUpdate } from './optimistic-update';

const REVIEW_FILTER_PATH = '/widget/review-filter';

export const reviewFilterQuery = () =>
  queryOptions({
    queryKey: ['review-filter'],
    queryFn: ({ signal }) => fetcher(REVIEW_FILTER_PATH, ReviewFilterSchema, { signal }),
  });

/**
 * Изменение условий вывода.
 *
 * Условие сохраняется сразу при выборе и выводится до ответа сервера.
 * Передается только измененная часть: прочие условия сервер оставляет как
 * есть.
 */
export const useUpdateReviewFilterMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: ReviewFilterPatch) =>
      fetcher(REVIEW_FILTER_PATH, ReviewFilterSchema, { method: 'PATCH', body: patch }),
    ...optimisticUpdate(queryClient, {
      queryKey: reviewFilterQuery().queryKey,
      mutationKey: ['review-filter', 'update'],
      apply: (current, patch: ReviewFilterPatch) => ({ ...current, ...patch }),
    }),
  });
};
