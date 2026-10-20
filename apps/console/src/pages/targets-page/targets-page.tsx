import { useState } from 'react';
import type { ChangeEvent, FC, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { targetsQuery } from '../../queries/targets';
import type { Target, TargetKind } from '../../schemas/target';
import { Loader } from '../../components/loader/loader';
import { Message } from '../../components/message/message';
import { TargetsTable } from '../../components/targets-table/targets-table';
import { plural } from '../../utils/format';
import { matchesNameQuery } from '../../utils/name-search';
import styles from './targets-page.module.css';

interface PageTexts {
  title: string;
  searchLabel: string;
  loading: string;
  empty: string;
  /** Формы склонения для счетчика: один, два, пять. */
  countForms: [string, string, string];
}

/** Тексты страницы для каждого вида цели. */
const PAGE_TEXTS: Readonly<Record<TargetKind, PageTexts>> = {
  clinic: {
    title: 'Клиники',
    searchLabel: 'Поиск по названию',
    loading: 'Загружаем клиники…',
    empty: 'Клиник пока нет. Они появятся после подключения аккаунта MyReviews и синхронизации.',
    countForms: ['клиника', 'клиники', 'клиник'],
  },
  doctor: {
    title: 'Врачи',
    searchLabel: 'Поиск по ФИО',
    loading: 'Загружаем врачей…',
    empty: 'Врачей пока нет. Они появятся после подключения аккаунта MyReviews и синхронизации.',
    countForms: ['врач', 'врача', 'врачей'],
  },
};

interface TargetsPageProps {
  kind: TargetKind;
}

/**
 * Раздел клиник или врачей: таблица с поиском по имени.
 *
 * Обе страницы выводит один компонент. Маршруты задают ему разные ключи:
 * иначе при переходе между разделами React сохранил бы строку поиска.
 */
export const TargetsPage: FC<TargetsPageProps> = ({ kind }) => {
  const texts = PAGE_TEXTS[kind];
  const targets = useQuery(targetsQuery(kind));
  const [search, setSearch] = useState('');

  const handleSearch = (event: ChangeEvent<HTMLInputElement>): void => {
    setSearch(event.target.value);
  };

  const renderList = (all: Target[]): ReactNode => {
    if (all.length === 0) {
      return <p className={styles.state}>{texts.empty}</p>;
    }

    const found = all.filter((target) => matchesNameQuery(target.name, search));
    const isFiltered = search.trim().length > 0;

    return (
      <>
        <div className={styles.toolbar}>
          <input
            className={styles.search}
            type="search"
            value={search}
            placeholder={texts.searchLabel}
            aria-label={texts.searchLabel}
            maxLength={120}
            onChange={handleSearch}
          />
          <span className={styles.count} role="status">
            {isFiltered
              ? `Найдено ${found.length} из ${all.length}`
              : plural(all.length, texts.countForms)}
          </span>
        </div>

        {found.length === 0 ? (
          <p className={styles.state}>По запросу «{search.trim()}» ничего не найдено.</p>
        ) : (
          <TargetsTable kind={kind} targets={found} label={texts.title} />
        )}
      </>
    );
  };

  return (
    <>
      <div className={styles.intro}>
        <h1 className={styles.title}>{texts.title}</h1>
        <p className={styles.hint}>
          Перечень обновляется при каждой синхронизации с MyReviews. Число отзывов указано без учета
          условий отбора.
        </p>
      </div>

      <section className={styles.card}>
        {targets.isPending && <Loader text={texts.loading} />}
        {targets.isError && <Message>{targets.error.message}</Message>}
        {targets.isSuccess && renderList(targets.data)}
      </section>
    </>
  );
};
