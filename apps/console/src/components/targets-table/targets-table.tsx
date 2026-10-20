import type { FC } from 'react';
import type { Target, TargetKind } from '../../schemas/target';
import { Switch } from '../switch/switch';
import styles from './targets-table.module.css';

interface TargetsTableProps {
  kind: TargetKind;
  targets: Target[];
  /** Доступное имя таблицы для программ чтения с экрана. */
  label: string;
  /** Включение или отключение вывода цели в виджете. */
  onToggle: (target: Target, isActive: boolean) => void;
  /** Показ кода вставки для страницы цели. */
  onShowSnippet: (target: Target) => void;
}

/**
 * Таблица клиник или врачей.
 *
 * Специальность выводится только у врачей: у клиник ее нет. На узком экране
 * таблица прокручивается по горизонтали внутри своей области. Область
 * получает фокус, иначе прокрутить ее с клавиатуры нельзя.
 */
export const TargetsTable: FC<TargetsTableProps> = ({
  kind,
  targets,
  label,
  onToggle,
  onShowSnippet,
}) => {
  const isDoctor = kind === 'doctor';

  return (
    <div className={styles.scroller} role="region" aria-label={label} tabIndex={0}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={`${styles.cell} ${styles.cellHead}`} scope="col">
              {isDoctor ? 'ФИО' : 'Название'}
            </th>
            {isDoctor && (
              <th className={`${styles.cell} ${styles.cellHead}`} scope="col">
                Специальность
              </th>
            )}
            <th className={`${styles.cell} ${styles.cellHead} ${styles.cellNumeric}`} scope="col">
              Отзывов
            </th>
            <th className={`${styles.cell} ${styles.cellHead}`} scope="col">
              В виджете
            </th>
            <th className={`${styles.cell} ${styles.cellHead}`} scope="col">
              Код вставки
            </th>
          </tr>
        </thead>
        <tbody>
          {targets.map((target) => (
            <tr key={target.id}>
              <th
                className={
                  target.isActive
                    ? `${styles.cell} ${styles.cellName}`
                    : `${styles.cell} ${styles.cellName} ${styles.cellMuted}`
                }
                scope="row"
              >
                {target.name}
              </th>
              {isDoctor && (
                <td className={styles.cell}>
                  {target.specialty ?? <span className={styles.muted}>не указана</span>}
                </td>
              )}
              <td className={`${styles.cell} ${styles.cellNumeric}`}>{target.reviewsCount}</td>
              <td className={styles.cell}>
                <Switch
                  checked={target.isActive}
                  label={`Показывать «${target.name}» в виджете`}
                  onChange={(isActive) => {
                    onToggle(target, isActive);
                  }}
                />
              </td>
              <td className={styles.cell}>
                <button
                  className={styles.action}
                  type="button"
                  aria-label={`Код вставки для «${target.name}»`}
                  onClick={() => {
                    onShowSnippet(target);
                  }}
                >
                  Показать код
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
