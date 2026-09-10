/**
 * Раскладка карточек по колонкам.
 *
 * Модуль не зависит от DOM и содержит только вычисление позиций. Измерение
 * элементов и применение стилей выполняет контроллер.
 */

/** Карточка на входе раскладки: идентификатор и высота. */
export interface MasonryItem {
  /** Устойчивый идентификатор; определяет закрепление за колонкой. */
  key: string;
  height: number;
}

/** Положение карточки внутри контейнера. */
export interface MasonryPlacement {
  key: string;
  column: number;
  /** Смещение от верха контейнера, px. */
  y: number;
}

export interface MasonryLayout {
  placements: MasonryPlacement[];
  /** Высота самой длинной колонки, px. */
  height: number;
}

/**
 * Состояние раскладки между вызовами.
 *
 * Хранит закрепление карточек за колонками и число колонок, для которого
 * оно выполнено. Состояние передается извне, чтобы раскладка оставалась
 * функцией.
 */
export interface MasonryState {
  /** Число колонок, для которого выполнено закрепление; 0 - раскладки не было. */
  columns: number;
  assignments: Map<string, number>;
}

/** Пустое состояние для первой раскладки. */
export const createMasonryState = (): MasonryState => ({ columns: 0, assignments: new Map() });

/** Индекс самой короткой колонки; при равенстве - наименьший индекс. */
const shortestColumn = (heights: readonly number[]): number => {
  let index = 0;

  for (let candidate = 1; candidate < heights.length; candidate += 1) {
    if ((heights[candidate] ?? 0) < (heights[index] ?? 0)) {
      index = candidate;
    }
  }

  return index;
};

/**
 * Раскладывает карточки по колонкам сверху вниз.
 *
 * Колонка выбирается при первом появлении карточки и сохраняется в
 * состоянии. Тем самым увеличение высоты карточки удлиняет только ее
 * колонку, а очередная порция размещается в конце, не смещая размещенные
 * ранее карточки.
 *
 * Смена числа колонок сбрасывает закрепление: перенос в новую сетку
 * оставил бы крайнюю колонку пустой.
 *
 * @param items - Карточки в порядке данных с измеренными высотами.
 * @param columns - Число колонок; не менее одной.
 * @param gap - Просвет между карточками по вертикали, px.
 * @param state - Состояние раскладки; обновляется на месте.
 * @returns Позиции карточек и итоговая высота контейнера.
 */
export function layoutMasonry(
  items: readonly MasonryItem[],
  columns: number,
  gap: number,
  state: MasonryState,
): MasonryLayout {
  const columnCount = Math.max(1, Math.trunc(columns));

  if (state.columns !== columnCount) {
    state.assignments.clear();
    state.columns = columnCount;
  }

  const heights = new Array<number>(columnCount).fill(0);
  const placements: MasonryPlacement[] = [];

  for (const item of items) {
    const column = state.assignments.get(item.key) ?? shortestColumn(heights);

    state.assignments.set(item.key, column);

    const y = heights[column] ?? 0;

    placements.push({ key: item.key, column, y });
    heights[column] = y + item.height + gap;
  }

  // Закрепления отсутствующих карточек удаляются: при смене фильтра список
  // заменяется полностью.
  const present = new Set(items.map((item) => item.key));

  for (const key of state.assignments.keys()) {
    if (!present.has(key)) {
      state.assignments.delete(key);
    }
  }

  // Последний просвет исключается: он расположен под нижней карточкой.
  const height = Math.max(0, Math.max(...heights) - gap);

  return { placements, height };
}
