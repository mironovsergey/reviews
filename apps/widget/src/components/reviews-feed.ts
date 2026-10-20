import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { repeat } from 'lit/directives/repeat.js';
import { apiClientContext } from '../api/context';
import { userMessage } from '../api/error';
import type { ApiClient } from '../api/client';
import { FeedController } from '../controllers/feed-controller';
import { MasonryController } from '../controllers/masonry-controller';
import { baseStyles } from '../styles/base';

import './reviews-card';

/** Просвет между карточками, px; соответствует --reviews-space-2xl. */
const GAP = 32;

/**
 * Число колонок по ширине ленты.
 *
 * Пороги заданы явно, а не выведены из минимальной ширины карточки: тем
 * самым сохранены значения, применявшиеся в контейнерных запросах.
 */
const columnsForWidth = (width: number): number => {
  if (width >= 900) {
    return 3;
  }

  return width >= 600 ? 2 : 1;
};

/** Лента отзывов с загрузкой очередных страниц по кнопке. */
@customElement('reviews-feed')
export class ReviewsFeed extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .reviews__list {
        position: relative;
      }

      .reviews__item {
        position: absolute;
        top: 0;
        left: 0;
      }

      .reviews_reloading {
        opacity: 0.5;
        transition: opacity 150ms ease;
      }

      .reviews__footer {
        display: flex;
        justify-content: center;
        margin-top: var(--reviews-space-2xl);
      }

      .reviews__button {
        padding: var(--reviews-space-lg) var(--reviews-space-2xl);
        border: 1px solid color-mix(in srgb, var(--reviews-color-action) 30%, transparent);
        border-radius: var(--reviews-radius-control);
        background: var(--reviews-color-surface);
        font-size: var(--reviews-font-size-button);
        font-weight: 700;
        line-height: var(--reviews-line-height-button);
        color: var(--reviews-color-action);
      }

      .reviews__button:hover:not(:disabled) {
        border-color: color-mix(in srgb, var(--reviews-color-action-hover) 40%, transparent);
        color: var(--reviews-color-action-hover);
      }

      .reviews__button:focus-visible {
        outline: 1px solid var(--reviews-color-accent);
      }

      .reviews__button:disabled {
        border-color: var(--reviews-color-inactive);
        color: var(--reviews-color-inactive);
        cursor: default;
      }

      .reviews__state {
        padding: var(--reviews-space-2xl) var(--reviews-space-lg);
        text-align: center;
        color: var(--reviews-color-text-subtle);
      }
    `,
  ];

  @consume({ context: apiClientContext, subscribe: true })
  private client: ApiClient | undefined = undefined;

  /** Идентификатор клиники или врача; null - вся лента. */
  @property({ attribute: false })
  targetId: string | null = null;

  private readonly feed = new FeedController(this, {
    client: () => this.client,
    targetId: () => this.targetId,
  });

  /**
   * Раскладка карточек колонками.
   *
   * Поле не помечено `private` намеренно: контроллер подключается в
   * конструкторе, и приватное поле компилятор счел бы неиспользуемым.
   */
  readonly masonry = new MasonryController(this, {
    container: () => this.renderRoot.querySelector<HTMLElement>('.reviews__list'),
    items: () => [...this.renderRoot.querySelectorAll<HTMLElement>('.reviews__item')],
    columns: columnsForWidth,
    gap: GAP,
  });

  private readonly onLoadMore = (): void => {
    void this.feed.loadMore();
  };

  private renderState(message: string): TemplateResult {
    return html`<p class="reviews__state">${message}</p>`;
  }

  private renderList(): TemplateResult {
    const items = this.feed.items;

    if (items.length === 0) {
      return this.renderState(
        this.targetId === null ? 'Отзывов пока нет' : 'По выбранному фильтру отзывов не нашлось',
      );
    }

    return html`
      <div class="reviews ${this.feed.isReloading ? 'reviews_reloading' : ''}">
        <ul class="reviews__list" role="list">
          ${repeat(
            items,
            (review) => review.id,
            (review) => html`
              <li class="reviews__item" data-key="${review.id}">
                <reviews-card .review="${review}"></reviews-card>
              </li>
            `,
          )}
        </ul>

        ${
          this.feed.hasMore
            ? html`
                <div class="reviews__footer">
                  <button
                    class="reviews__button"
                    type="button"
                    ?disabled="${this.feed.isLoadingMore}"
                    @click="${this.onLoadMore}"
                  >
                    ${this.feed.isLoadingMore ? 'Загрузка…' : 'Показать еще'}
                  </button>
                </div>
              `
            : nothing
        }
        ${
          this.feed.didLoadMoreFail
            ? this.renderState('Не удалось загрузить продолжение. Попробуйте еще раз.')
            : nothing
        }
      </div>
    `;
  }

  override render(): TemplateResult {
    return this.feed.task.render({
      initial: () => this.renderState('Загружаем отзывы…'),
      pending: () =>
        this.feed.items.length > 0 ? this.renderList() : this.renderState('Загружаем отзывы…'),
      complete: () => this.renderList(),
      error: (error: unknown) =>
        this.renderState(userMessage(error, 'Не удалось загрузить отзывы')),
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reviews-feed': ReviewsFeed;
  }
}
