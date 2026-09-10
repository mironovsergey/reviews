import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  createMasonryState,
  layoutMasonry,
  type MasonryItem,
  type MasonryState,
} from '../utils/masonry';

interface MasonryOptions {
  /** Контейнер списка: задает систему координат и итоговую высоту. */
  container: () => HTMLElement | null;
  /**
   * Карточки в порядке данных. Каждой требуется атрибут `data-key`: по нему
   * выполняется закрепление за колонкой, сохраняемое между перерисовками.
   */
  items: () => HTMLElement[];
  /** Число колонок по ширине контейнера. */
  columns: (width: number) => number;
  /** Просвет между карточками, px. */
  gap: number;
}

/**
 * Раскладка карточек колонками, устойчивая к изменению состава и высот.
 *
 * Заменяет `column-count`: тот перестраивает поток целиком, поэтому
 * увеличение высоты карточки перемещает соседние карточки в другие колонки,
 * а очередная порция смещает размещенные ранее. Здесь карточка закрепляется
 * за колонкой при первом появлении, и смещаются только карточки,
 * расположенные ниже в той же колонке.
 *
 * Позиции задаются через `transform`: в отличие от `top` и `left`, он не
 * вызывает пересчет раскладки страницы.
 */
export class MasonryController implements ReactiveController {
  private readonly options: MasonryOptions;
  private readonly state: MasonryState = createMasonryState();

  private observer: ResizeObserver | undefined;
  private readonly observed = new Set<Element>();
  private frame = 0;

  constructor(host: ReactiveControllerHost, options: MasonryOptions) {
    this.options = options;
    // Ссылка на хост не сохраняется: раскладка изменяет стили напрямую и
    // перерисовки не требует.
    host.addController(this);
  }

  hostConnected(): void {
    // Пересчет требуется при изменении ширины контейнера, от которой
    // зависит число колонок, и при изменении высоты карточки.
    this.observer = new ResizeObserver(() => {
      this.schedule();
    });
  }

  hostDisconnected(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.observed.clear();
    cancelAnimationFrame(this.frame);
  }

  hostUpdated(): void {
    this.layout();
    this.observe();
  }

  /** Откладывает пересчет до кадра: одно изменение порождает ряд событий. */
  private schedule(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      this.layout();
    });
  }

  private layout(): void {
    const container = this.options.container();

    if (container === null) {
      return;
    }

    const width = container.clientWidth;

    // Скрытый виджет измерению не подлежит: при нулевой ширине раскладка
    // лишена смысла.
    if (width === 0) {
      return;
    }

    const elements = this.options.items();
    const columns = Math.max(1, this.options.columns(width));
    const { gap } = this.options;
    const columnWidth = (width - gap * (columns - 1)) / columns;

    // Ширина задается отдельным проходом до чтения высот: чередование
    // записи и чтения вынуждает браузер пересчитывать раскладку на каждой
    // паре обращений.
    for (const element of elements) {
      element.style.width = `${String(columnWidth)}px`;
    }

    // Карточка представляет собой отдельный компонент и на момент
    // обновления списка еще не отрисована: Lit выполняет ее отрисовку
    // следующей микрозадачей. Высота такой карточки равна нулю, а
    // закрепление за колонкой необратимо, поэтому неизмеренные карточки
    // откладываются до следующего прохода. Иначе очередная порция целиком
    // размещается в одной колонке.
    const measured: HTMLElement[] = [];
    let awaiting = false;

    for (const element of elements) {
      if (element.offsetHeight > 0) {
        measured.push(element);
        continue;
      }

      awaiting = true;
      // Сокрытие обязательно: без заданной позиции карточка размещается в
      // левом верхнем углу поверх остальных.
      element.style.visibility = 'hidden';
    }

    const items: MasonryItem[] = measured.map((element) => ({
      key: element.dataset.key ?? '',
      height: element.offsetHeight,
    }));

    const { placements, height } = layoutMasonry(items, columns, gap, this.state);

    placements.forEach((placement, index) => {
      const element = measured[index];

      if (element === undefined) {
        return;
      }

      const x = placement.column * (columnWidth + gap);

      element.style.transform = `translate(${String(x)}px, ${String(placement.y)}px)`;
      element.style.visibility = '';
    });

    container.style.height = `${String(height)}px`;

    // Повтор в следующем кадре, к которому вложенные карточки отрисованы.
    // Расчет только на ResizeObserver недопустим: при отсутствии уведомления
    // карточки остались бы скрытыми.
    if (awaiting) {
      this.schedule();
    }
  }

  /** Подписывает наблюдателя на контейнер и текущий состав карточек. */
  private observe(): void {
    const { observer } = this;

    if (observer === undefined) {
      return;
    }

    const targets = new Set<Element>(this.options.items());
    const container = this.options.container();

    if (container !== null) {
      targets.add(container);
    }

    for (const element of this.observed) {
      if (!targets.has(element)) {
        observer.unobserve(element);
        this.observed.delete(element);
      }
    }

    for (const element of targets) {
      if (!this.observed.has(element)) {
        observer.observe(element);
        this.observed.add(element);
      }
    }
  }
}
