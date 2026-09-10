import type { FC, ReactNode } from 'react';
import styles from './auth-layout.module.css';

interface AuthLayoutProps {
  title: string;
  /** Ссылка на противоположный экран: вход или регистрация. */
  footer: ReactNode;
  children: ReactNode;
}

/** Общий каркас экранов входа и регистрации. */
export const AuthLayout: FC<AuthLayoutProps> = ({ title, footer, children }) => (
  <div className={styles.screen}>
    <div className={styles.card}>
      <h1 className={styles.title}>{title}</h1>
      {children}
      <p className={styles.footer}>{footer}</p>
    </div>
  </div>
);
