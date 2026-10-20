import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { formatReviewDate, toDateAttribute } from '../utils/formatters';
import { baseStyles } from '../styles/base';
import type { Review } from '../api/types';

import './reviews-rating';
import './reviews-source';
import './reviews-avatar';

/**
 * Длина текста, после которой он сворачивается.
 *
 * Измерение фактической высоты точнее, но требует пересчета для каждой
 * карточки при каждом обновлении.
 */
const COLLAPSE_THRESHOLD = 180;

/** Карточка отзыва. */
@customElement('reviews-card')
export class ReviewsCard extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .review-card {
        background: var(--reviews-color-surface);
        border-radius: var(--reviews-radius-card);
        padding: var(--reviews-space-xl);
      }

      .review-card__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--reviews-space-sm);
        margin-bottom: var(--reviews-space-sm);
      }

      .review-card__meta {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--reviews-space-sm);
        margin-bottom: var(--reviews-space-lg);
      }

      .review-card__author {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .review-card__date {
        color: var(--reviews-color-text-muted);
        white-space: nowrap;
      }

      .review-card__text {
        margin: 0;
        white-space: pre-line;
        overflow-wrap: anywhere;
      }

      /*
       * Обрезка по числу строк. Префиксные свойства оставлены ради браузеров,
       * не понимающих line-clamp: они объявлены до стандартного, чтобы
       * выигрывало оно. Автопрефиксер к шаблонам Lit не применяется, поэтому
       * строки написаны вручную и убираются тоже вручную.
       */
      .review-card__text_collapsed {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 4;
        line-clamp: 4;
        overflow: hidden;
      }

      .review-card__toggle {
        margin-top: var(--reviews-space-xs);
        padding: 0;
        border: none;
        background: none;
        color: var(--reviews-color-link);
        text-decoration-line: underline;
        text-decoration-style: solid;
        text-decoration-skip-ink: auto;
        text-decoration-thickness: 6%;
        text-underline-offset: 14%;
        text-underline-position: from-font;
        font-size: var(--reviews-font-size-body);
        line-height: var(--reviews-line-height-body);
      }

      .review-card__toggle:hover {
        color: var(--reviews-color-link-hover);
      }

      .review-card__target {
        display: flex;
        align-items: center;
        gap: var(--reviews-space-md);
        margin-top: var(--reviews-space-lg);
      }

      .review-card__target-body {
        display: flex;
        flex-direction: column;
        row-gap: var(--reviews-space-xs);
        min-width: 0;
      }

      .review-card__target-kind {
        font-size: var(--reviews-font-size-caption);
        line-height: var(--reviews-line-height-caption);
        color: var(--reviews-color-text-muted);
      }

      .review-card__target-name {
        font-size: var(--reviews-font-size-caption);
        line-height: var(--reviews-line-height-caption);
        overflow-wrap: anywhere;
      }

      .review-card__target-link {
        padding: 0;
        border: none;
        background: none;
        text-align: left;
        color: var(--reviews-color-link);
        text-decoration-line: underline;
        text-decoration-style: solid;
        text-decoration-skip-ink: auto;
        text-decoration-thickness: 6%;
        text-underline-offset: 14%;
        text-underline-position: from-font;
        font-size: var(--reviews-font-size-caption);
        line-height: var(--reviews-line-height-caption);
      }

      .review-card__target-link:hover {
        color: var(--reviews-color-link-hover);
      }
    `,
  ];

  @property({ attribute: false })
  review: Review | null = null;

  @state()
  private expanded = false;

  private readonly onToggle = (): void => {
    this.expanded = !this.expanded;
  };

  /** Выбор врача ограничивает ленту его отзывами. */
  private readonly onTargetClick = (): void => {
    if (this.review === null) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent('reviews-target-select', {
        detail: { target: this.review.target },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private renderTarget(review: Review): TemplateResult {
    const isDoctor = review.target.kind === 'doctor';

    return html`
      <div class="review-card__target">
        ${
          isDoctor ? html`<reviews-avatar .name="${review.target.name}"></reviews-avatar>` : nothing
        }
        <div class="review-card__target-body">
          <span class="review-card__target-kind">
            ${isDoctor ? 'Отзыв о враче' : 'Отзыв о клинике'}
          </span>
          ${
            isDoctor
              ? html`
                  <button
                    class="review-card__target-link"
                    type="button"
                    @click="${this.onTargetClick}"
                  >
                    ${review.target.name}
                  </button>
                `
              : html`<span class="review-card__target-name">${review.target.name}</span>`
          }
        </div>
      </div>
    `;
  }

  /**
   * Отрисовывает текст отзыва.
   *
   * Значение подставляется вплотную к тегам: при `white-space: pre-line`
   * перевод строки в шаблоне образует пустую строку над текстом.
   */
  private renderText(text: string, collapsed: boolean): TemplateResult {
    const collapsedClass = collapsed ? ' review-card__text_collapsed' : '';

    return html`<blockquote class="review-card__text${collapsedClass}">${text}</blockquote>`;
  }

  override render(): TemplateResult | typeof nothing {
    const review = this.review;

    if (review === null) {
      return nothing;
    }

    const collapsible = review.text.length > COLLAPSE_THRESHOLD;
    const collapsed = collapsible && !this.expanded;

    return html`
      <article class="review-card">
        <div class="review-card__head">
          <reviews-rating .rating="${review.rating}"></reviews-rating>
          <reviews-source .source="${review.source}"></reviews-source>
        </div>

        <div class="review-card__meta">
          <span class="review-card__author">${review.authorName}</span>
          <time class="review-card__date" datetime="${toDateAttribute(review.publishedAt)}">
            ${formatReviewDate(review.publishedAt)}
          </time>
        </div>

        ${this.renderText(review.text, collapsed)}
        ${
          collapsible
            ? html`
                <button class="review-card__toggle" type="button" @click="${this.onToggle}">
                  ${this.expanded ? 'Свернуть' : 'Читать подробнее'}
                </button>
              `
            : nothing
        }
        ${this.renderTarget(review)}
      </article>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reviews-card': ReviewsCard;
  }
}
