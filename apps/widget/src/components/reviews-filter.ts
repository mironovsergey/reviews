import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { consume } from '@lit/context';
import { Task } from '@lit/task';
import { apiClientContext } from '../api/context';
import type { ApiClient } from '../api/client';
import type { Target } from '../api/types';
import { baseStyles } from '../styles/base';
import { isRecord } from '../utils/guards';
import type { SearchSuggestion } from './reviews-search';
import type { SelectOption } from './reviews-select';

import './reviews-search';
import './reviews-select';

/** Извлекает строковое поле `value` из полезной нагрузки события. */
const readSelectedValue = (detail: unknown): string | null => {
  if (!isRecord(detail)) {
    return null;
  }

  return typeof detail.value === 'string' ? detail.value : null;
};

/**
 * Панель фильтров: поиск по ФИО врача и выбор клиники.
 *
 * Поля взаимоисключающи: выбор клиники сбрасывает поиск и наоборот, поэтому
 * оба отображают одно и то же значение.
 *
 * Знание о предметной области сосредоточено здесь: список и поле поиска
 * получают готовые пункты и о клиниках с врачами не осведомлены.
 */
@customElement('reviews-filter')
export class ReviewsFilter extends LitElement {
  static override styles = [
    baseStyles,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }

      .filter {
        display: grid;
        gap: var(--reviews-space-lg);
        padding: var(--reviews-space-xl);
        border-radius: var(--reviews-radius-card);
        background: var(--reviews-color-surface);
      }

      @container (min-width: 700px) {
        .filter {
          grid-template-columns: 1fr minmax(220px, 280px);
          align-items: center;
        }
      }
    `,
  ];

  @consume({ context: apiClientContext, subscribe: true })
  private client: ApiClient | undefined = undefined;

  /** Выбранная клиника или врач; null - фильтр не задан. */
  @property({ attribute: false })
  selected: Target | null = null;

  /** Последняя выдача поиска; служит для восстановления врача по идентификатору. */
  private doctorsById = new Map<string, Target>();

  private readonly clinicsTask = new Task(this, {
    task: async ([client]: readonly [ApiClient | undefined], { signal }): Promise<Target[]> => {
      if (client === undefined) {
        return [];
      }

      return client.listClinics(signal);
    },
    // Список клиник не зависит от состояния, но зависит от клиента: тот
    // пересоздается при смене ключа или адреса, после чего требуется
    // повторный запрос.
    args: () => [this.client] as const,
  });

  private get selectedClinicId(): string | null {
    return this.selected?.kind === 'clinic' ? this.selected.id : null;
  }

  private get selectedDoctorName(): string | null {
    return this.selected?.kind === 'doctor' ? this.selected.name : null;
  }

  /** Источник подсказок для поля поиска. */
  private readonly searchDoctors = async (
    query: string,
    signal: AbortSignal,
  ): Promise<SearchSuggestion[]> => {
    if (this.client === undefined) {
      return [];
    }

    const doctors = await this.client.searchDoctors(query, signal);

    this.doctorsById = new Map(doctors.map((doctor) => [doctor.id, doctor]));

    return doctors.map((doctor) => ({
      value: doctor.id,
      label: doctor.name,
      hint: doctor.specialty,
    }));
  };

  private readonly onDoctorSelect = (event: Event): void => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const value = readSelectedValue(event.detail);
    const doctor = value === null ? null : (this.doctorsById.get(value) ?? null);

    this.dispatchEvent(
      new CustomEvent('reviews-doctor-change', {
        detail: { doctor },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private readonly onClinicSelect = (event: Event): void => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const value = readSelectedValue(event.detail);
    const clinics = this.clinicsTask.value ?? [];
    const clinic = value === null ? null : (clinics.find((item) => item.id === value) ?? null);

    this.dispatchEvent(
      new CustomEvent('reviews-clinic-change', {
        detail: { clinic },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private renderClinicSelect(clinics: Target[]): TemplateResult {
    const options: SelectOption[] = clinics.map((clinic) => ({
      value: clinic.id,
      label: clinic.name,
    }));

    return html`
      <reviews-select
        class="filter__clinic"
        .options="${options}"
        .value="${this.selectedClinicId}"
        placeholder="Все клиники"
        label="Клиника"
        @reviews-select-change="${this.onClinicSelect}"
      ></reviews-select>
    `;
  }

  override render(): TemplateResult {
    return html`
      <div class="filter">
        <reviews-search
          class="filter__search"
          .source="${this.searchDoctors}"
          .selectedLabel="${this.selectedDoctorName}"
          placeholder="Поиск по имени врача"
          label="Поиск по имени врача"
          emptyText="Врач не найден"
          with-avatars
          @reviews-search-select="${this.onDoctorSelect}"
        ></reviews-search>
        ${this.clinicsTask.render({
          // До получения списка контрол выводится без пунктов.
          initial: () => this.renderClinicSelect([]),
          pending: () => this.renderClinicSelect([]),
          complete: (clinics: Target[]) => this.renderClinicSelect(clinics),
          error: () => this.renderClinicSelect([]),
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'reviews-filter': ReviewsFilter;
  }
}
