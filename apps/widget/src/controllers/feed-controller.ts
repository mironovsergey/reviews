import { Task, TaskStatus } from '@lit/task';
import type { ReactiveControllerHost } from 'lit';
import type { ApiClient } from '../api/client';
import { isAbort } from '../api/error';
import type { Review, ReviewsPage } from '../api/types';

/** Число отзывов в одном запросе. */
const PAGE_SIZE = 12;

interface FeedOptions {
  /** Клиент передается через контекст и до подключения может отсутствовать. */
  client: () => ApiClient | undefined;
  /** Текущий фильтр: клиника, врач или ничего. */
  targetId: () => string | null;
}

/**
 * Лента отзывов: первая страница и загрузка последующих.
 *
 * Первая страница хранится в задаче: при смене фильтра она запрашивается
 * заново, а устаревший запуск отменяется. Загруженные далее страницы
 * накапливаются отдельно и сбрасываются при изменении фильтра.
 */
export class FeedController {
  private readonly host: ReactiveControllerHost;
  private readonly options: FeedOptions;

  /** Страницы после первой. */
  private loadedItems: Review[] = [];
  private cursor: string | null = null;
  private loadingMore = false;
  private moreFailed = false;

  /** Прерывает загрузку, если фильтр изменился до получения ответа. */
  private moreRequest: AbortController | null = null;

  readonly task: Task<readonly [string | null, ApiClient | undefined], ReviewsPage>;

  constructor(host: ReactiveControllerHost, options: FeedOptions) {
    this.host = host;
    this.options = options;

    this.task = new Task(host, {
      task: async (
        [targetId, client]: readonly [string | null, ApiClient | undefined],
        { signal },
      ): Promise<ReviewsPage> => {
        // Выдача изменилась: незавершенная загрузка относится к прежней.
        this.cancelLoadMore();

        if (client === undefined) {
          return { items: [], nextCursor: null };
        }

        const page = await client.listReviews({ targetId, limit: PAGE_SIZE }, signal);

        this.loadedItems = [];
        this.cursor = page.nextCursor;
        this.moreFailed = false;

        return page;
      },
      // Клиент входит в аргументы: он пересоздается при смене ключа или
      // адреса, после чего лента запрашивается заново.
      args: () => [this.options.targetId(), this.options.client()] as const,
    });
  }

  /** Первая страница вместе с загруженными по кнопке. */
  get items(): Review[] {
    const firstPage = this.task.value?.items ?? [];

    return [...firstPage, ...this.loadedItems];
  }

  get hasMore(): boolean {
    return this.cursor !== null;
  }

  get isLoadingMore(): boolean {
    return this.loadingMore;
  }

  get didLoadMoreFail(): boolean {
    return this.moreFailed;
  }

  /** Выполняется перезагрузка после смены фильтра; прежние отзывы на экране. */
  get isReloading(): boolean {
    return this.task.status === TaskStatus.PENDING && this.task.value !== undefined;
  }

  async loadMore(): Promise<void> {
    const client = this.options.client();
    // Фильтр на момент запроса; с ним сверяется полученный ответ.
    const requestedTarget = this.options.targetId();
    const requestedCursor = this.cursor;

    if (client === undefined || requestedCursor === null || this.loadingMore) {
      return;
    }

    this.cancelLoadMore();

    const request = new AbortController();

    this.moreRequest = request;
    this.loadingMore = true;
    this.moreFailed = false;
    this.host.requestUpdate();

    try {
      const page = await client.listReviews(
        { targetId: requestedTarget, cursor: requestedCursor, limit: PAGE_SIZE },
        request.signal,
      );

      // Ответ мог поступить после смены фильтра: отзывы и курсор относятся
      // к прежней выдаче и добавлению не подлежат.
      if (this.options.targetId() !== requestedTarget) {
        return;
      }

      this.loadedItems = [...this.loadedItems, ...page.items];
      this.cursor = page.nextCursor;
    } catch (error) {
      // Отмена представляет собой штатное завершение и не требует сообщения.
      if (!isAbort(error)) {
        this.moreFailed = true;
      }
    } finally {
      if (this.moreRequest === request) {
        this.moreRequest = null;
        this.loadingMore = false;
      }

      this.host.requestUpdate();
    }
  }

  private cancelLoadMore(): void {
    this.moreRequest?.abort();
    this.moreRequest = null;
    this.loadingMore = false;
  }
}
