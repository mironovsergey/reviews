import { useState } from 'react';
import type { ChangeEvent, FC, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { targetsQuery, useUpdateTargetMutation } from '../../queries/targets';
import type { Target, TargetKind } from '../../schemas/target';
import { Loader } from '../../components/loader/loader';
import { Message } from '../../components/message/message';
import { Switch } from '../../components/switch/switch';
import { TargetSnippetDialog } from '../../components/target-snippet-dialog/target-snippet-dialog';
import { TargetsTable } from '../../components/targets-table/targets-table';
import { plural } from '../../utils/format';
import { matchesNameQuery } from '../../utils/name-search';
import styles from './targets-page.module.css';

interface PageTexts {
  title: string;
  searchLabel: string;
  loading: string;
  empty: string;
  noneHidden: string;
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
    noneHidden: 'Скрытых клиник нет.',
    countForms: ['клиника', 'клиники', 'клиник'],
  },
  doctor: {
    title: 'Врачи',
    searchLabel: 'Поиск по ФИО',
    loading: 'Загружаем врачей…',
    empty: 'Врачей пока нет. Они появятся после подключения аккаунта MyReviews и синхронизации.',
    noneHidden: 'Скрытых врачей нет.',
    countForms: ['врач', 'врача', 'врачей'],
  },
};

interface TargetsPageProps {
  kind: TargetKind;
}

/**
 * Раздел клиник или врачей: таблица с поиском по имени, переключателями
 * вывода в виджете и кодом вставки для страницы каждой записи.
 *
 * Обе страницы выводит один компонент. Маршруты задают ему разные ключи:
 * иначе при переходе между разделами React сохранил бы строку поиска.
 */
export const TargetsPage: FC<TargetsPageProps> = ({ kind }) => {
  const texts = PAGE_TEXTS[kind];
  const targets = useQuery(targetsQuery(kind));
  const update = useUpdateTargetMutation(kind);
  const [search, setSearch] = useState('');
  const [onlyHidden, setOnlyHidden] = useState(false);
  const [snippetTargetId, setSnippetTargetId] = useState<string | null>(null);

  // Запись берется из текущих данных, а не запоминается при открытии окна:
  // так окно видит переключение показа, сделанное после открытия.
  const snippetTarget = targets.data?.find((target) => target.id === snippetTargetId) ?? null;

  const handleSearch = (event: ChangeEvent<HTMLInputElement>): void => {
    setSearch(event.target.value);
  };

  const handleToggle = (target: Target, isActive: boolean): void => {
    update.mutate({ id: target.id, isActive });
  };

  const handleShowSnippet = (target: Target): void => {
    setSnippetTargetId(target.id);
  };

  const handleCloseSnippet = (): void => {
    setSnippetTargetId(null);
  };

  /** Сообщение об отказе называет цель, чей переключатель вернулся в прежнее положение. */
  const renderUpdateError = (all: Target[]): ReactNode => {
    if (!update.isError) {
      return null;
    }

    const failed = all.find((target) => target.id === update.variables.id);
    const subject = failed === undefined ? '' : ` «${failed.name}»`;

    return (
      <div className={styles.notice}>
        <Message>
          Не удалось изменить показ{subject}: {update.error.message}
        </Message>
      </div>
    );
  };

  const renderList = (all: Target[]): ReactNode => {
    if (all.length === 0) {
      return <p className={styles.state}>{texts.empty}</p>;
    }

    const hiddenCount = all.filter((target) => !target.isActive).length;
    const found = all.filter(
      (target) => (!onlyHidden || !target.isActive) && matchesNameQuery(target.name, search),
    );
    const isSearching = search.trim().length > 0;
    const isFiltered = isSearching || onlyHidden;
    const total = plural(all.length, texts.countForms);

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
          <Switch
            checked={onlyHidden}
            label="Только скрытые"
            visibleLabel
            onChange={setOnlyHidden}
          />
          <span className={styles.count} role="status">
            {isFiltered && `Найдено ${found.length} из ${all.length}`}
            {!isFiltered && (hiddenCount > 0 ? `${total}, скрыто ${hiddenCount}` : total)}
          </span>
        </div>

        {renderUpdateError(all)}

        {found.length === 0 ? (
          <p className={styles.state}>
            {isSearching ? `По запросу «${search.trim()}» ничего не найдено.` : texts.noneHidden}
          </p>
        ) : (
          <TargetsTable
            kind={kind}
            targets={found}
            label={texts.title}
            onToggle={handleToggle}
            onShowSnippet={handleShowSnippet}
          />
        )}
      </>
    );
  };

  return (
    <>
      <div className={styles.intro}>
        <h1 className={styles.title}>{texts.title}</h1>
        <p className={styles.hint}>
          Перечень обновляется при каждой синхронизации с MyReviews. Скрытые записи не выводятся в
          фильтре виджета, а их отзывы не попадают в ленту. Изменение действует сразу. Число отзывов
          указано без учета условий отбора.
        </p>
      </div>

      <section className={styles.card}>
        {targets.isPending && <Loader text={texts.loading} />}
        {targets.isError && <Message>{targets.error.message}</Message>}
        {targets.isSuccess && renderList(targets.data)}
      </section>

      <TargetSnippetDialog target={snippetTarget} onClose={handleCloseSnippet} />
    </>
  );
};
