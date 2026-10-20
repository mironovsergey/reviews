import type {
  DataTag,
  DefaultError,
  MutationKey,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query';

interface OptimisticUpdateOptions<TData, TVariables> {
  /**
   * Запрос, данные которого изменение меняет до ответа сервера. Ключ берется
   * из queryOptions: по нему выводится тип данных.
   */
  queryKey: DataTag<QueryKey, TData, unknown>;
  /** Ключ изменений: по нему считаются изменения, ожидающие ответа. */
  mutationKey: MutationKey;
  /** Данные запроса после изменения. */
  apply: (current: TData, variables: TVariables) => TData;
}

/** Данные до изменения; восстанавливаются при отказе сервера. */
interface Snapshot<TData> {
  previous: TData | undefined;
}

/**
 * Обработчики изменения, которое выводится до ответа сервера.
 *
 * Результат подставляется в параметры useMutation. Новое значение попадает
 * в кэш сразу, при отказе возвращается прежнее. Прочитанное до изменения
 * состояние отменяется: ответ ранее начатого чтения перезаписал бы новое
 * значение.
 *
 * Данные перечитываются после последнего из одновременных изменений. Ответы
 * приходят в произвольном порядке, и запись ответа на раннее изменение
 * поверх позднего вернула бы на экран устаревшее значение. Пока изменение
 * выполняется, оно учитывается в счетчике, поэтому последнему соответствует
 * единица.
 */
export const optimisticUpdate = <TData, TVariables>(
  queryClient: QueryClient,
  { queryKey, mutationKey, apply }: OptimisticUpdateOptions<TData, TVariables>,
) => ({
  mutationKey,
  onMutate: async (variables: TVariables): Promise<Snapshot<TData>> => {
    await queryClient.cancelQueries({ queryKey });

    const previous = queryClient.getQueryData(queryKey);

    if (previous !== undefined) {
      queryClient.setQueryData(queryKey, apply(previous, variables));
    }

    return { previous };
  },
  // Тип ошибки совпадает с принятым в useMutation по умолчанию: иначе вывод
  // типов сузил бы ошибку изменения до unknown.
  onError: (
    _error: DefaultError,
    _variables: TVariables,
    snapshot: Snapshot<TData> | undefined,
  ): void => {
    if (snapshot?.previous !== undefined) {
      queryClient.setQueryData(queryKey, snapshot.previous);
    }
  },
  onSettled: async (): Promise<void> => {
    if (queryClient.isMutating({ mutationKey }) === 1) {
      await queryClient.invalidateQueries({ queryKey });
    }
  },
});
