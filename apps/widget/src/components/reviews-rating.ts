import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { iconStar } from '../icons/star';
import { baseStyles } from '../styles/base';

const MAX_RATING = 5;

/** Оценка отзыва в звездах. */
@customElement('reviews-rating')
export class ReviewsRating extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .rating {
        display: flex;
      }

      .rating__star {
        display: block;
      }
    `,
  ];

  @property({ type: Number })
  rating = 0;

  override render(): TemplateResult {
    const filled = Math.round(this.rating);

    return html`
      <span class="rating" role="img" aria-label="Оценка ${filled} из ${MAX_RATING}">
        ${Array.from(
          { length: MAX_RATING },
          (_, index) => html`
            <span class="rating__star">
              ${iconStar(
                index < filled ? 'var(--reviews-color-rating)' : 'var(--reviews-color-inactive)',
              )}
            </span>
          `,
        )}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reviews-rating': ReviewsRating;
  }
}
