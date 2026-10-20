import type { ChangeEvent, FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reviewFilterQuery, useUpdateReviewFilterMutation } from '../../queries/review-filter';
import { Loader } from '../loader/loader';
import { Message } from '../message/message';
import styles from './review-filter-card.module.css';

interface RatingOption {
  value: number | null;
  label: string;
}

/**
 * Варианты наименьшей оценки. Предел «от 1» не предлагается: он
 * равнозначен отсутствию ограничения.
 */
const MIN_RATING_OPTIONS: readonly RatingOption[] = [
  { value: null, label: 'Все оценки' },
  { value: 2, label: '2 звезды и выше' },
  { value: 3, label: '3 звезды и выше' },
  { value: 4, label: '4 звезды и выше' },
  { value: 5, label: 'Только 5 звезд' },
];

/** Значение элемента select: пустая строка соответствует отсутствию ограничения. */
const toOptionValue = (rating: number | null): string => (rating === null ? '' : String(rating));

/**
 * Условия отбора отзывов, которые выводит виджет.
 *
 * Каждое условие сохраняется сразу при изменении. Карточка рассчитана на
 * несколько условий: каждое занимает отдельное поле в общем перечне.
 */
export const ReviewFilterCard: FC = () => {
  const filter = useQuery(reviewFilterQuery());
  const update = useUpdateReviewFilterMutation();

  if (filter.isPending) {
    return (
      <section className={styles.card}>
        <Loader text="Загружаем условия отбора…" />
      </section>
    );
  }

  if (filter.isError) {
    return (
      <section className={styles.card}>
        <Message>{filter.error.message}</Message>
      </section>
    );
  }

  const handleMinRatingChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const option = MIN_RATING_OPTIONS.find(
      (item) => toOptionValue(item.value) === event.target.value,
    );

    if (option === undefined) {
      return;
    }

    update.mutate({ minRating: option.value });
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>Отзывы в виджете</h2>
      <p className={styles.hint}>
        Условия определяют, какие отзывы показывает виджет, и действуют сразу. Отзывы, не прошедшие
        отбор, не удаляются: ослабьте условие, и они вернутся в ленту.
      </p>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>Оценка</span>
          <select
            className={styles.select}
            value={toOptionValue(filter.data.minRating)}
            onChange={handleMinRatingChange}
          >
            {MIN_RATING_OPTIONS.map((option) => (
              <option key={toOptionValue(option.value)} value={toOptionValue(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
          <span className={styles.fieldHint}>Отзывы с более низкой оценкой не выводятся.</span>
        </label>
      </div>

      {update.isError && (
        <div className={styles.notice}>
          <Message>Не удалось сохранить условие: {update.error.message}</Message>
        </div>
      )}

      <p className={styles.status} role="status">
        {update.isPending && 'Сохраняем…'}
        {update.isSuccess && 'Сохранено'}
      </p>
    </section>
  );
};
