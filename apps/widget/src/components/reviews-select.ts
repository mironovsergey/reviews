import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { iconChevron } from '../icons/chevron';
import { baseStyles } from '../styles/base';

/** Пункт списка: значение и подпись. */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Идентификаторы списка и его пунктов.
 *
 * Постоянные значения допустимы: теневой DOM изолирует их от страницы, а
 * `aria-activedescendant` ссылается на пункт в пределах того же корня.
 */
const LISTBOX_ID = 'options';

const optionId = (index: number): string => `option-${String(index)}`;

/** Пункт списка; значение `null` соответствует сброшенному выбору. */
interface Item {
  value: string | null;
  label: string;
}

/**
 * Выпадающий список.
 *
 * Компонент не зависит от предмета выбора: пункты передаются извне.
 *
 * Список реализован собственными средствами, а не элементом `select`:
 * раскрытый перечень последнего рисует операционная система и оформлению
 * не поддается. Взамен требуется самостоятельно обеспечить работу с
 * клавиатуры и разметку для программ чтения с экрана по шаблону
 * «select-only combobox» из WAI-ARIA.
 */
@customElement('reviews-select')
export class ReviewsSelect extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }

      .select {
        position: relative;
      }

      .select__control {
        display: flex;
        align-items: center;
        gap: var(--reviews-space-sm);
        width: 100%;
        padding: calc(var(--reviews-space-lg) - 1px);
        border: 1px solid var(--reviews-color-border);
        border-radius: var(--reviews-radius-control);
        background-color: var(--reviews-color-surface);
        font-family: var(--reviews-font-family);
        font-size: var(--reviews-font-size-body);
        line-height: var(--reviews-line-height-body);
        color: var(--reviews-color-text);
        text-align: left;
      }

      .select__control:focus-visible {
        outline: 1px solid var(--reviews-color-accent);
      }

      .select:has(.select__control:focus-visible) .select__dropdown {
        box-shadow:
          -1px 0 0 var(--reviews-color-accent),
          1px 0 0 var(--reviews-color-accent),
          0 1px 0 var(--reviews-color-accent);
      }

      .select__control_open {
        border-bottom-right-radius: 0;
        border-bottom-left-radius: 0;
      }

      .select__value {
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .select__value_placeholder {
        color: var(--reviews-color-text-subtle);
      }

      .select__chevron {
        flex: 0 0 auto;
        color: var(--reviews-color-text-subtle);
      }

      .select__control_open .select__chevron {
        transform: rotate(180deg);
      }

      .select__dropdown {
        position: absolute;
        z-index: 10;
        top: 100%;
        right: 0;
        left: 0;
        display: flex;
        flex-direction: column;
        gap: var(--reviews-space-xs);
        padding: var(--reviews-space-xs);
        border: 1px solid var(--reviews-color-border);
        border-top-width: 0;
        border-radius: var(--reviews-radius-control);
        border-top-left-radius: 0;
        border-top-right-radius: 0;
        background: var(--reviews-color-surface);
        max-height: 344px;
        overflow-y: auto;
      }

      .select__option {
        padding: var(--reviews-space-sm) var(--reviews-space-md);
        border-radius: var(--reviews-space-sm);
        font-weight: 600;
        color: var(--reviews-color-text);
        cursor: pointer;
        overflow-wrap: break-word;
      }

      .select__option:hover,
      .select__option_active {
        background: var(--reviews-color-accent-surface);
      }
    `,
  ];

  @property({ attribute: false })
  options: SelectOption[] = [];

  /** Выбранное значение; null соответствует пункту «ничего не выбрано». */
  @property({ attribute: false })
  value: string | null = null;

  /** Подпись пункта «ничего не выбрано». */
  @property({ type: String })
  placeholder = '';

  /** Доступное имя списка для программ чтения с экрана. */
  @property({ type: String })
  label = '';

  @state()
  private open = false;

  /** Пункт, выделенный с клавиатуры; -1 - выделение отсутствует. */
  @state()
  private activeIndex = -1;

  private readonly onDocumentClick = (event: MouseEvent): void => {
    if (!event.composedPath().includes(this)) {
      this.closeList();
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this.onDocumentClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this.onDocumentClick);
  }

  /**
   * Тип уведомления об изменениях взят без параметра: `PropertyValues<this>`
   * ограничивает ключи типом `keyof this`, в который приватные поля не
   * входят, а проверяется здесь именно приватное реактивное поле.
   */
  override updated(changed: PropertyValues): void {
    // Выделение перемещается по списку без участия фокуса, поэтому браузер
    // не прокручивает список: выделенный пункт подводится к краю.
    if (!changed.has('activeIndex') || this.activeIndex < 0) {
      return;
    }

    this.renderRoot
      .querySelector(`#${optionId(this.activeIndex)}`)
      ?.scrollIntoView({ block: 'nearest' });
  }

  /** Пункты списка; сброс выбора расположен первым. */
  private get items(): Item[] {
    return [
      { value: null, label: this.placeholder },
      ...this.options.map((option) => ({ value: option.value, label: option.label })),
    ];
  }

  /** Подпись выбранного пункта; при неизвестном значении - приглашение. */
  private get selectedLabel(): string {
    return this.items.find((item) => item.value === this.value)?.label ?? this.placeholder;
  }

  private openList(): void {
    this.open = true;
    // Список раскрывается на текущем выборе: очередное нажатие стрелки
    // смещает выделение от него, а не от начала перечня.
    this.activeIndex = Math.max(
      this.items.findIndex((item) => item.value === this.value),
      0,
    );
  }

  private closeList(): void {
    this.open = false;
    this.activeIndex = -1;
  }

  private selectItem(item: Item): void {
    this.closeList();
    this.dispatchEvent(
      new CustomEvent('reviews-select-change', {
        detail: { value: item.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private readonly onControlClick = (): void => {
    if (this.open) {
      this.closeList();

      return;
    }

    this.openList();
  };

  /**
   * Обрабатывает клавиши управления списком.
   *
   * Раскладка соответствует шаблону «select-only combobox» из WAI-ARIA:
   * стрелки перемещают выделение по кругу, Home и End - к краям списка,
   * Enter и пробел подтверждают выделенное, Escape закрывает список. Фокус
   * остается на кнопке, а выделенный пункт указывается через
   * `aria-activedescendant`.
   */
  private readonly onKeydown = (event: KeyboardEvent): void => {
    const total = this.items.length;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();

        if (!this.open) {
          this.openList();

          return;
        }

        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex = (this.activeIndex + step + total) % total;

        return;
      }
      case 'Home':
      case 'End': {
        if (!this.open) {
          return;
        }
        event.preventDefault();
        this.activeIndex = event.key === 'Home' ? 0 : total - 1;

        return;
      }
      case 'Enter':
      case ' ': {
        // Иначе пробел на кнопке приводит к повторному нажатию.
        event.preventDefault();

        if (!this.open) {
          this.openList();

          return;
        }

        const item = this.items[this.activeIndex];

        if (item !== undefined) {
          this.selectItem(item);
        }

        return;
      }
      case 'Escape': {
        this.closeList();

        return;
      }
      case 'Tab': {
        this.closeList();

        return;
      }
      default:
        return;
    }
  };

  override render(): TemplateResult {
    return html`
      <div class="select">
        <button
          class="select__control ${this.open ? 'select__control_open' : ''}"
          type="button"
          role="combobox"
          aria-label="${this.label}"
          aria-haspopup="listbox"
          aria-controls="${LISTBOX_ID}"
          aria-expanded="${this.open ? 'true' : 'false'}"
          aria-activedescendant="${this.open && this.activeIndex >= 0
            ? optionId(this.activeIndex)
            : nothing}"
          @click="${this.onControlClick}"
          @keydown="${this.onKeydown}"
        >
          <span class="select__value ${this.value === null ? 'select__value_placeholder' : ''}">
            ${this.selectedLabel}
          </span>
          <span class="select__chevron">${iconChevron}</span>
        </button>
        ${this.open ? this.renderList() : nothing}
      </div>
    `;
  }

  private renderList(): TemplateResult {
    return html`
      <ul
        class="select__dropdown"
        id="${LISTBOX_ID}"
        role="listbox"
        aria-label="${this.label}"
        @mousedown="${(event: MouseEvent) => {
          // Нажатие мышью по списку не должно уводить фокус с кнопки:
          // иначе список закрывается до наступления клика.
          event.preventDefault();
        }}"
      >
        ${this.items.map((item, index) => this.renderOption(item, index))}
      </ul>
    `;
  }

  /**
   * Отрисовывает один пункт.
   *
   * Пункт не содержит вложенной кнопки: элемент с ролью `option` не должен
   * принимать фокус, иначе нарушается клавиатурный обход.
   */
  private renderOption(item: Item, index: number): TemplateResult {
    return html`
      <li
        class="select__option ${index === this.activeIndex ? 'select__option_active' : ''}"
        id="${optionId(index)}"
        role="option"
        aria-selected="${item.value === this.value ? 'true' : 'false'}"
        @click="${() => {
          this.selectItem(item);
        }}"
      >
        ${item.label}
      </li>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reviews-select': ReviewsSelect;
  }
}
