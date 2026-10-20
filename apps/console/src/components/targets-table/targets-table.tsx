import type { FC } from 'react';
import type { Target, TargetKind } from '../../schemas/target';
import styles from './targets-table.module.css';

interface TargetsTableProps {
  kind: TargetKind;
  targets: Target[];
  /** Доступное имя таблицы для программ чтения с экрана. */
  label: string;
}

/**
 * Таблица клиник или врачей.
 *
 * Специальность выводится только у врачей: у клиник ее нет. На узком экране
 * таблица прокручивается по горизонтали внутри своей области. Область
 * получает фокус, иначе прокрутить ее с клавиатуры нельзя.
 */
export const TargetsTable: FC<TargetsTableProps> = ({ kind, targets, label }) => {
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
          </tr>
        </thead>
        <tbody>
          {targets.map((target) => (
            <tr key={target.id}>
              <th className={`${styles.cell} ${styles.cellName}`} scope="row">
                {target.name}
              </th>
              {isDoctor && (
                <td className={styles.cell}>
                  {target.specialty ?? <span className={styles.muted}>не указана</span>}
                </td>
              )}
              <td className={`${styles.cell} ${styles.cellNumeric}`}>{target.reviewsCount}</td>
              <td className={styles.cell}>
                {target.isActive ? (
                  'Показывается'
                ) : (
                  <span className={styles.muted}>Не показывается</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
