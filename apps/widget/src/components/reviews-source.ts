import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getSourceLabel } from '../utils/source-labels';
import { baseStyles } from '../styles/base';

/** Площадка, с которой получен отзыв. */
@customElement('reviews-source')
export class ReviewsSource extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .source {
        display: block;
        font-size: var(--reviews-font-size-caption);
        line-height: var(--reviews-line-height-caption);
        color: var(--reviews-color-text-subtle);
        white-space: nowrap;
      }
    `,
  ];

  @property({ type: String })
  source = '';

  override render(): TemplateResult | typeof nothing {
    const label = getSourceLabel(this.source);

    if (label === null) {
      return nothing;
    }

    return html`<span class="source">${label}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reviews-source': ReviewsSource;
  }
}
