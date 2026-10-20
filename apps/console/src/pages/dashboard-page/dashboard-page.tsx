import type { FC } from 'react';
import { Navigate } from 'react-router';
import { useSession } from '../../queries/auth';
import { Header } from '../../components/header/header';
import { ConnectionCard } from '../../components/connection-card/connection-card';
import { WidgetCard } from '../../components/widget-card/widget-card';
import { ReviewFilterCard } from '../../components/review-filter-card/review-filter-card';
import { Loader } from '../../components/loader/loader';
import styles from './dashboard-page.module.css';

/** Консоль управления. Без действующей сессии уводит на экран входа. */
export const DashboardPage: FC = () => {
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
        <ConnectionCard />
        <WidgetCard />
        <ReviewFilterCard />
      </main>
    </>
  );
};
