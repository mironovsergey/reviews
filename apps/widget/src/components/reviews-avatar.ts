import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getInitials } from '../utils/formatters';
import { baseStyles } from '../styles/base';

/** Заглушка вместо фотографии врача: источник изображений отсутствует. */
@customElement('reviews-avatar')
export class ReviewsAvatar extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: inline-flex;
      }

      .avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--reviews-color-accent-surface);
        color: var(--reviews-color-accent);
        font-size: var(--reviews-font-size-body);
        font-weight: 600;
        line-height: 1;
        user-select: none;
      }
    `,
  ];

  @property({ type: String })
  name = '';

  override render(): TemplateResult {
    return html`<span class="avatar" aria-hidden="true">${getInitials(this.name)}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reviews-avatar': ReviewsAvatar;
  }
}
