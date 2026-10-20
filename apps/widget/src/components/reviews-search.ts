import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Task, TaskStatus } from '@lit/task';
import { iconClose } from '../icons/close';
import { iconSearch } from '../icons/search';
import { baseStyles } from '../styles/base';

import './reviews-avatar';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Идентификаторы списка и его пунктов.
 *
 * Постоянные значения допустимы: теневой DOM изолирует их от страницы, а
 * `aria-activedescendant` ссылается на пункт в пределах того же корня.
 */
const LISTBOX_ID = 'suggestions';

const optionId = (index: number): string => `suggestion-${String(index)}`;

/** Подсказка: значение для подстановки в поле и текст для показа. */
export interface SearchSuggestion {
  value: string;
  label: string;
  /** Вторая строка мелким шрифтом, например специальность врача. */
  hint: string | null;
}

/** Источник подсказок. Сигнал обязателен: им задача отменяет устаревший запрос. */
export type SearchSource = (query: string, signal: AbortSignal) => Promise<SearchSuggestion[]>;

/**
 * Результат отрисовки подсказок: шаблон либо `nothing`.
 *
 * Псевдоним требуется в аннотациях обработчиков `Task.render`: без явного
 * типа вывод расширяет `typeof nothing` до `symbol`, и результат перестает
 * соответствовать объявленному типу метода `render`.
 */
type Renderable = TemplateResult | typeof nothing;

/**
 * Поле поиска с подсказками.
 *
 * Компонент не зависит от предмета поиска: источник данных передается
 * функцией, подписи - свойствами. Пауза в наборе и отмена устаревшего
 * запроса относятся к поведению самого поля: при вынесении их наружу ответ
 * на прежнюю строку перезаписывает подсказки к текущей.
 */
@customElement('reviews-search')
export class ReviewsSearch extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
        position: relative;
      }

      .search__field {
        position: relative;
      }

      .search__icon {
        pointer-events: none;
        position: absolute;
        top: 50%;
        left: var(--reviews-space-lg);
        transform: translateY(-50%);
        color: var(--reviews-color-text-subtle);
      }

      .search__clear {
        background-color: transparent;
        background-image: none;
        border-width: 0;
        padding: 0;
        position: absolute;
        top: 50%;
        right: var(--reviews-space-lg);
        transform: translateY(-50%);
        color: var(--reviews-color-text-subtle);
      }

      .search__clear:hover {
        color: var(--reviews-color-text);
      }

      .search__input {
        display: block;
        width: 100%;
        padding: calc(var(--reviews-space-lg) - 1px);
        padding-left: 51px;
        border: 1px solid var(--reviews-color-border);
        border-radius: var(--reviews-radius-control);
        background-color: var(--reviews-color-surface);
        font-family: var(--reviews-font-family);
        font-size: var(--reviews-font-size-body);
        line-height: var(--reviews-line-height-body);
        color: var(--reviews-color-text);
      }

      .search__input::placeholder {
        color: var(--reviews-color-text-subtle);
      }

      .search__input::-webkit-search-decoration,
      .search__input::-webkit-search-cancel-button,
      .search__input::-webkit-search-results-button,
      .search__input::-webkit-search-results-decoration {
        display: none;
      }

      .search__clear:focus-visible,
      .search__input:focus-visible {
        outline: 1px solid var(--reviews-color-accent);
      }

      .search__field:has(.search__input:focus-visible) + .search__dropdown {
        box-shadow:
          -1px 0 0 var(--reviews-color-accent),
          1px 0 0 var(--reviews-color-accent),
          0 1px 0 var(--reviews-color-accent);
      }

      .search__input_open {
        border-bottom-right-radius: 0;
        border-bottom-left-radius: 0;
      }

      .search__dropdown {
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

      .search__option {
        display: flex;
        align-items: flex-start;
        gap: var(--reviews-space-md);
        padding: var(--reviews-space-sm) var(--reviews-space-md);
        border-radius: var(--reviews-space-sm);
        cursor: pointer;
      }

      .search__option:hover,
      .search__option_active {
        background: var(--reviews-color-accent-surface);
      }

      .search__option reviews-avatar {
        flex: 0 0 auto;
      }

      .search__option-body {
        flex: 1 1 0;
        min-width: 0;
      }

      .search__label {
        font-weight: 600;
        font-size: var(--reviews-font-size-body);
        line-height: var(--reviews-line-height-body);
        color: var(--reviews-color-text);
        overflow-wrap: break-word;
      }

      .search__hint {
        display: block;
        font-size: var(--reviews-font-size-legal);
        line-height: var(--reviews-line-height-legal);
        color: var(--reviews-color-text-subtle);
      }

      .search__message {
        padding: var(--reviews-space-md);
        font-size: var(--reviews-font-size-legal);
        line-height: var(--reviews-line-height-legal);
        color: var(--reviews-color-text-subtle);
      }
    `,
  ];

  /** Источник подсказок. Без него поле работает как обычное поле ввода. */
  @property({ attribute: false })
  source: SearchSource | null = null;

  /** Подпись выбранного значения; она же остается в поле после выбора. */
  @property({ attribute: false })
  selectedLabel: string | null = null;

  @property({ type: String })
  placeholder = '';

  /** Доступное имя поля для программ чтения с экрана. */
  @property({ type: String })
  label = '';

  @property({ type: String })
  emptyText = 'Ничего не найдено';

  /**
   * Выводить ли аватар рядом с подсказкой.
   *
   * Свойство относится к виду списка, а не к данным: аватар строится из
   * подписи подсказки, поэтому предмет поиска компоненту по-прежнему
   * неизвестен.
   */
  @property({ type: Boolean, attribute: 'with-avatars' })
  withAvatars = false;

  /** Текст в поле; обновляется на каждое нажатие. */
  @state()
  private query = '';

  /** Текст, дошедший до запроса после паузы в наборе. */
  @state()
  private settledQuery = '';

  @state()
  private open = false;

  /** Подсказка, выделенная с клавиатуры; -1 - выделение отсутствует. */
  @state()
  private activeIndex = -1;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Признак того, что выбор отменило само поле.
   *
   * Набор текста поверх выбранного значения отменяет прежний выбор, и
   * родитель возвращает `selectedLabel = null` тем же путем, каким приходит
   * сброс извне. Без этого признака поле приняло бы собственное действие за
   * внешнее и стерло бы только что набранный текст.
   */
  private discardedSelection = false;

  private readonly suggestionsTask = new Task(this, {
    task: async ([query]: readonly [string], { signal }): Promise<SearchSuggestion[]> => {
      // Пригодность строки для запроса определяет `onInput`: сюда она
      // поступает обрезанной и не короче `MIN_QUERY_LENGTH`. Пустой строке
      // соответствует сброшенный запрос, обращение к источнику не требуется.
      if (query.length === 0 || this.source === null) {
        return [];
      }

      return this.source(query, signal);
    },
    args: () => [this.settledQuery],
  });

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

    this.cancelDebounce();
  }

  override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('selectedLabel')) {
      return;
    }

    // Признак относится к одному переходу и снимается при любом изменении
    // значения: иначе он пережил бы свой повод и подавил бы следующий сброс.
    const discardedHere = this.discardedSelection;
    this.discardedSelection = false;

    // Значение сброшено извне: поле подлежит очистке. Сброс, вызванный
    // набором текста, поле учло само - query содержит введенное значение,
    // а список и отложенный запрос уже приведены в согласие с ним.
    if (this.selectedLabel === null && !discardedHere) {
      this.resetQuery();
    }
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

  private get inputValue(): string {
    return this.selectedLabel ?? this.query;
  }

  /** Снимает отложенный запрос, если пауза в наборе не истекла. */
  private cancelDebounce(): void {
    if (this.debounceTimer === null) {
      return;
    }

    clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  /**
   * Возвращает поле в исходное состояние.
   *
   * Снятие отложенного запроса обязательно: он относится к строке, уже
   * отсутствующей в поле, и при срабатывании открыл бы список с подсказками
   * к удаленному тексту.
   */
  private resetQuery(): void {
    this.cancelDebounce();
    this.query = '';
    this.settledQuery = '';
    this.closeList();
  }

  private readonly onInput = (event: Event): void => {
    const input = event.target;

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    this.query = input.value;

    // Изменение текста означает отказ от ранее выбранного значения.
    if (this.selectedLabel !== null) {
      this.discardedSelection = true;
      this.emitSelect(null);
    }

    this.cancelDebounce();

    const trimmed = this.query.trim();

    this.activeIndex = -1;

    if (trimmed.length < MIN_QUERY_LENGTH) {
      this.settledQuery = '';
      this.open = false;

      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.settledQuery = trimmed;
      this.open = true;
    }, DEBOUNCE_MS);
  };

  private readonly onClear = (): void => {
    this.resetQuery();
    this.emitSelect(null);
  };

  /**
   * Подсказки, выведенные на экран.
   *
   * Во время запроса вместо списка выводится сообщение, тогда как задача
   * еще хранит прежний результат. Навигация выполняется по выведенным
   * подсказкам: иначе `aria-activedescendant` ссылается на отсутствующий
   * в разметке пункт.
   */
  private get suggestions(): SearchSuggestion[] {
    if (this.suggestionsTask.status !== TaskStatus.COMPLETE) {
      return [];
    }

    return this.suggestionsTask.value ?? [];
  }

  /**
   * Обрабатывает клавиши управления списком.
   *
   * Раскладка соответствует шаблону «combobox» из WAI-ARIA: стрелки
   * перемещают выделение по кругу, Home и End - к краям списка, Enter
   * подтверждает выделенное, Escape закрывает список. Фокус остается в поле
   * ввода, поэтому набор текста не прерывается.
   */
  private readonly onKeydown = (event: KeyboardEvent): void => {
    const total = this.suggestions.length;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (total === 0) {
          return;
        }
        event.preventDefault();

        // Список мог быть закрыт клавишей Escape без изменения запроса:
        // стрелка открывает его повторно без нового запроса.
        this.open = true;

        // Первое нажатие переводит выделение на край списка по направлению
        // стрелки; дальнейшее перемещение выполняется по кругу.
        if (this.activeIndex < 0) {
          this.activeIndex = event.key === 'ArrowDown' ? 0 : total - 1;

          return;
        }

        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex = (this.activeIndex + step + total) % total;

        return;
      }
      case 'Home':
      case 'End': {
        if (!this.open || total === 0) {
          return;
        }
        event.preventDefault();
        this.activeIndex = event.key === 'Home' ? 0 : total - 1;

        return;
      }
      case 'Enter': {
        const suggestion = this.open ? this.suggestions[this.activeIndex] : undefined;

        if (suggestion === undefined) {
          return;
        }
        // Иначе нажатие поступает форме страницы размещения и отправляет ее.
        event.preventDefault();
        this.selectSuggestion(suggestion);

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

  /** Закрывает список, снимая выделение. */
  private closeList(): void {
    this.open = false;
    this.activeIndex = -1;
  }

  private selectSuggestion(suggestion: SearchSuggestion): void {
    this.closeList();
    this.emitSelect(suggestion.value);
  }

  private emitSelect(value: string | null): void {
    this.dispatchEvent(
      new CustomEvent('reviews-search-select', {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderMessage(text: string): TemplateResult {
    return html`
      <div class="search__dropdown">
        <p class="search__message" role="status">${text}</p>
      </div>
    `;
  }

  private renderSuggestionList(suggestions: SearchSuggestion[]): TemplateResult {
    if (suggestions.length === 0) {
      return this.renderMessage(this.emptyText);
    }

    return html`
      <ul
        class="search__dropdown"
        id="${LISTBOX_ID}"
        role="listbox"
        aria-label="${this.label}"
        @mousedown="${(event: MouseEvent) => {
          // Нажатие мышью по списку не должно уводить фокус из поля: иначе
          // список закрывается до наступления клика.
          event.preventDefault();
        }}"
      >
        ${suggestions.map((suggestion, index) => this.renderOption(suggestion, index))}
      </ul>
    `;
  }

  /**
   * Отрисовывает одну подсказку.
   *
   * Пункт списка не содержит вложенной кнопки: элемент с ролью `option` не
   * должен принимать фокус, иначе нарушается клавиатурный обход. Фокус
   * остается в поле ввода, а выделенный пункт указывается через
   * `aria-activedescendant`.
   */
  private renderOption(suggestion: SearchSuggestion, index: number): TemplateResult {
    const active = index === this.activeIndex;

    return html`
      <li
        class="search__option ${active ? 'search__option_active' : ''}"
        id="${optionId(index)}"
        role="option"
        aria-selected="${active ? 'true' : 'false'}"
        @click="${() => {
          this.selectSuggestion(suggestion);
        }}"
      >
        ${
          this.withAvatars
            ? html`<reviews-avatar name="${suggestion.label}"></reviews-avatar>`
            : nothing
        }
        <span class="search__option-body">
          <span class="search__label">${suggestion.label}</span>
          ${
            suggestion.hint !== null
              ? html`<span class="search__hint">${suggestion.hint}</span>`
              : nothing
          }
        </span>
      </li>
    `;
  }

  /**
   * Выведена ли панель в настоящий момент.
   *
   * Признака `open` недостаточно: до запуска задачи выводить нечего. Тот же
   * признак использует поле для выпрямления нижних углов, поэтому решение
   * принимается в одном месте: иначе поле остается с прямым низом без
   * панели под ним.
   */
  private get dropdownOpen(): boolean {
    return this.open && this.suggestionsTask.status !== TaskStatus.INITIAL;
  }

  private renderSuggestions(): Renderable {
    if (!this.dropdownOpen) {
      return nothing;
    }

    const suggestions = this.suggestionsTask.render({
      initial: (): Renderable => nothing,
      pending: (): Renderable => this.renderMessage('Ищем…'),
      complete: (items: SearchSuggestion[]): Renderable => this.renderSuggestionList(items),
      error: (): Renderable => this.renderMessage('Поиск недоступен'),
    });

    return suggestions ?? nothing;
  }

  override render(): TemplateResult {
    const value = this.inputValue;
    const expanded = this.dropdownOpen;

    return html`
      <div class="search__field">
        <span class="search__icon">${iconSearch}</span>
        <input
          class="search__input ${expanded ? 'search__input_open' : ''}"
          type="search"
          role="combobox"
          .value="${value}"
          placeholder="${this.placeholder}"
          aria-label="${this.label}"
          aria-autocomplete="list"
          aria-controls="${LISTBOX_ID}"
          aria-expanded="${expanded ? 'true' : 'false'}"
          aria-activedescendant="${this.activeIndex >= 0 ? optionId(this.activeIndex) : nothing}"
          @input="${this.onInput}"
          @keydown="${this.onKeydown}"
        />
        ${
          value.length > 0
            ? html`
                <button
                  class="search__clear"
                  type="button"
                  aria-label="Очистить поиск"
                  @click="${this.onClear}"
                >
                  ${iconClose}
                </button>
              `
            : nothing
        }
      </div>
      ${this.renderSuggestions()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reviews-search': ReviewsSearch;
  }
}
