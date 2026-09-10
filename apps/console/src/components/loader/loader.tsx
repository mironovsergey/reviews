import type { FC } from 'react';
import styles from './loader.module.css';

interface LoaderProps {
  text?: string;
}

/** Индикатор загрузки с необязательной подписью. */
export const Loader: FC<LoaderProps> = ({ text = 'Загрузка…' }) => (
  <div className={styles.loader} role="status" aria-live="polite">
    <span className={styles.spinner} />
    <span className={styles.text}>{text}</span>
  </div>
);
