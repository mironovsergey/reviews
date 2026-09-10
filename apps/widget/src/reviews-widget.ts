import { LitElement, html, css, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { provide } from '@lit/context';
import { ApiClient } from './api/client';
import { apiClientContext } from './api/context';
import { isTargetKind } from './api/parsers';
import type { Target } from './api/types';
import { baseStyles } from './styles/base';
import { tokens } from './styles/tokens';
import { isRecord } from './utils/guards';

import './components/reviews-filter';
import './components/reviews-feed';

/**
 * Адрес API по умолчанию; подставляется в бандл при сборке.
 *
 * Адрес одинаков для всех инсталляций и известен заранее, поэтому код
 * вставки содержит только ключ. Атрибут `api-url` сохранен для случаев,
 * когда требуется указать другой сервер.
 */
const DEFAULT_API_URL = import.meta.env.VITE_WIDGET_API_URL ?? '';

/**
 * Корень виджета отзывов.
 *
 * Хранит конфигурацию, создает клиент API и передает его вложенным
 * компонентам через контекст.
 *
 * Лента выводится в одном из двух видов. При заданной извне клинике или
 * враче лента ограничена ими, а фильтр не выводится. Если цель не задана,
 * выбор делает посетитель; клиника и врач при этом взаимоисключающи,
 * поэтому хранятся одним значением.
 *
 * Код вставки на сайт:
 *
 * ```html
 * <!-- Все отзывы кабинета, с фильтром. -->
 * <reviews-widget api-key="…"></reviews-widget>
 *
 * <!-- Страница клиники или врача: только ее отзывы, без фильтра. -->
 * <reviews-widget api-key="…" target-id="68f1…a2"></reviews-widget>
 *
 * <script type="module" src="https://…/reviews-widget.js"></script>
 * ```
 */
@customElement('reviews-widget')
export class ReviewsWidget extends LitElement {
  static override styles = [
    tokens,
    baseStyles,
    css`
      :host {
        display: block;
      }

      .widget__filter {
        margin-bottom: var(--reviews-space-2xl);
      }

      .widget__notice {
        padding: var(--reviews-space-2xl) var(--reviews-space-lg);
        text-align: center;
        color: var(--reviews-color-text-subtle);
      }
    `,
  ];

  /** Публичный ключ кабинета; выдается в консоли вместе с кодом вставки. */
  @property({ attribute: 'api-key' })
  apiKey = '';

  /** Базовый адрес API; по умолчанию подставленный при сборке. */
  @property({ attribute: 'api-url' })
  apiUrl = DEFAULT_API_URL;

  /**
   * Клиника или врач, к которым относится страница.
   *
   * Идентификатор общий для обоих случаев: в данных это одна сущность с
   * единым пространством идентификаторов. Значение выдает консоль управления
   * вместе с кодом вставки; пустое значение означает все отзывы кабинета.
   */
  @property({ attribute: 'target-id' })
  targetId = '';

  /**
   * Клиент, передаваемый вложенным компонентам.
   *
   * Пересоздается при смене конфигурации. Декоратор `@provide` подменяет
   * сеттер поля и сам рассылает новое значение потребителям, поэтому
   * `@state()` не требуется: отрисовка корня от клиента не зависит.
   */
  @provide({ context: apiClientContext })
  client: ApiClient | undefined = undefined;

  /** Выбранная в фильтре клиника или врач; null - вся лента. */
  @state()
  private selected: Target | null = null;

  /** Задана ли цель извне; в этом случае фильтр не выводится. */
  private get isPinned(): boolean {
    return this.targetId !== '';
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('apiKey') || changed.has('apiUrl')) {
      this.client = this.apiKey.length > 0 ? new ApiClient(this.apiUrl, this.apiKey) : undefined;
    }
  }

  private readonly onClinicChange = (event: Event): void => {
    if (event instanceof CustomEvent) {
      const detail: unknown = event.detail;

      this.selected = isClinicDetail(detail) ? detail.clinic : null;
    }
  };

  private readonly onDoctorChange = (event: Event): void => {
    if (event instanceof CustomEvent) {
      const detail: unknown = event.detail;

      this.selected = isDoctorDetail(detail) ? detail.doctor : null;
    }
  };

  /** Выбор врача в карточке ограничивает ленту его отзывами. */
  private readonly onTargetSelect = (event: Event): void => {
    if (event instanceof CustomEvent) {
      const detail: unknown = event.detail;

      if (isTargetDetail(detail) && detail.target.kind === 'doctor') {
        this.selected = detail.target;
      }
    }
  };

  private renderNotice(text: string): TemplateResult {
    return html`<p class="widget__notice">${text}</p>`;
  }

  override render(): TemplateResult {
    if (this.apiKey.length === 0) {
      return this.renderNotice('Не задан ключ виджета');
    }

    return this.isPinned
      ? html`<reviews-feed .targetId="${this.targetId}"></reviews-feed>`
      : this.renderFilterable();
  }

  /** Лента с фильтром: цель извне не задана, выбор делает посетитель. */
  private renderFilterable(): TemplateResult {
    return html`
      <div
        class="widget"
        @reviews-clinic-change="${this.onClinicChange}"
        @reviews-doctor-change="${this.onDoctorChange}"
        @reviews-target-select="${this.onTargetSelect}"
      >
        <reviews-filter class="widget__filter" .selected="${this.selected}"></reviews-filter>
        <reviews-feed class="widget__feed" .targetId="${this.selected?.id ?? null}"></reviews-feed>
      </div>
    `;
  }
}

/**
 * Полезная нагрузка событий имеет тип unknown и подлежит проверке.
 *
 * Проверяется каждое поле цели, а вид - разбором того же значения, каким
 * пользуется parseTarget: проверка на произвольную строку допустила бы в
 * `kind` значение, отсутствующее в объединении, и сузила бы тип неверно.
 */
const isTarget = (value: unknown): value is Target => {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isTargetKind(value.kind) &&
    typeof value.name === 'string' &&
    (value.specialty === null || typeof value.specialty === 'string')
  );
};

const isClinicDetail = (value: unknown): value is { clinic: Target | null } => {
  return isRecord(value) && (value.clinic === null || isTarget(value.clinic));
};

const isDoctorDetail = (value: unknown): value is { doctor: Target | null } => {
  return isRecord(value) && (value.doctor === null || isTarget(value.doctor));
};

const isTargetDetail = (value: unknown): value is { target: Target } => {
  return isRecord(value) && isTarget(value.target);
};

declare global {
  interface HTMLElementTagNameMap {
    'reviews-widget': ReviewsWidget;
  }
}
