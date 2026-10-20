import type { FC } from 'react';
import styles from './switch.module.css';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Имя переключателя; без visibleLabel служит только доступным именем. */
  label: string;
  /** Выводить ли имя рядом с переключателем. В таблице его заменяет заголовок столбца. */
  visibleLabel?: boolean;
}

/**
 * Переключатель «включено или выключено».
 *
 * Построен на кнопке с ролью switch: состояние сообщается атрибутом
 * aria-checked, а фокус и нажатие с клавиатуры кнопка принимает без
 * дополнительной обработки. Нажатие сразу сообщает новое состояние.
 */
export const Switch: FC<SwitchProps> = ({ checked, onChange, label, visibleLabel = false }) => (
  <button
    className={styles.switch}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={visibleLabel ? undefined : label}
    onClick={() => {
      onChange(!checked);
    }}
  >
    <span
      className={checked ? `${styles.track} ${styles.trackOn}` : styles.track}
      aria-hidden="true"
    >
      <span className={checked ? `${styles.thumb} ${styles.thumbOn}` : styles.thumb} />
    </span>
    {visibleLabel && <span className={styles.label}>{label}</span>}
  </button>
);
