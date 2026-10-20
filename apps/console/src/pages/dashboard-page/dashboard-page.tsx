import type { FC } from 'react';
import { ConnectionCard } from '../../components/connection-card/connection-card';
import { WidgetCard } from '../../components/widget-card/widget-card';
import { ReviewFilterCard } from '../../components/review-filter-card/review-filter-card';

/** Обзор кабинета: подключение MyReviews, код для сайта и условия вывода отзывов. */
export const DashboardPage: FC = () => (
  <>
    <ConnectionCard />
    <WidgetCard />
    <ReviewFilterCard />
  </>
);
