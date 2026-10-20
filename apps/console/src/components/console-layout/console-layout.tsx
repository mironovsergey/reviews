import type { FC } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useSession } from '../../queries/auth';
import { Header } from '../header/header';
import { Loader } from '../loader/loader';
import styles from './console-layout.module.css';

/**
 * Каркас разделов консоли: проверка сессии, шапка и область содержимого.
 *
 * Проверка сессии выполняется здесь, а не на каждой странице: без действующей
 * сессии любой раздел уводит на экран входа.
 */
export const ConsoleLayout: FC = () => {
  const session = useSession();

  if (session.isChecking) {
    return <Loader text="Проверяем сессию…" />;
  }

  if (!session.isAuthenticated || session.user === null) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <>
      <Header user={session.user} />
      <main className={styles.content}>
        <Outlet />
      </main>
    </>
  );
};
