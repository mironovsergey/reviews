import type { FC, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';
import { useSaveDomainsMutation, widgetQuery } from '../../queries/widget';
import { Loader } from '../loader/loader';
import { Message } from '../message/message';
import styles from './widget-card.module.css';

/** FormData.get() возвращает в том числе File, поэтому значение проверяется схемой. */
const DomainFieldSchema = z.string().trim().min(1);

/**
 * Код для вставки на сайт и список разрешенных доменов.
 *
 * Список сохраняется сразу при добавлении или удалении домена.
 */
export const WidgetCard: FC = () => {
  const widget = useQuery(widgetQuery());
  const saveDomains = useSaveDomainsMutation();

  const clipboard = useCopyToClipboard();

  if (widget.isPending) {
    return (
      <section className={styles.card}>
        <Loader text="Загружаем код виджета…" />
      </section>
    );
  }

  if (widget.isError) {
    return (
      <section className={styles.card}>
        <Message>{widget.error.message}</Message>
      </section>
    );
  }

  // До ответа сервера здесь уже выведен измененный список.
  const domains = widget.data.allowedDomains;

  const handleAdd = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const form = event.currentTarget;
    const parsed = DomainFieldSchema.safeParse(new FormData(form).get('domain'));

    if (!parsed.success || domains.includes(parsed.data)) {
      return;
    }

    saveDomains.mutate([...domains, parsed.data]);
    form.reset();
  };

  const removeDomain = (domain: string): void => {
    saveDomains.mutate(domains.filter((item) => item !== domain));
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>Код для сайта</h2>
      <p className={styles.hint}>
        Вставьте этот код на страницу, где должны показываться отзывы. Ключ публичный — от чужого
        использования его защищает список доменов ниже.
      </p>

      <code className={styles.snippet}>{widget.data.snippet}</code>

      {clipboard.status === 'failed' && (
        <div className={styles.notice}>
          <Message>Браузер не дал скопировать — выделите код вручную</Message>
        </div>
      )}

      <button
        className={`${styles.button} ${styles.buttonSecondary}`}
        type="button"
        onClick={() => {
          clipboard.copy(widget.data.snippet);
        }}
      >
        {clipboard.status === 'copied' ? 'Скопировано' : 'Скопировать код'}
      </button>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Разрешенные домены</h3>

        {domains.length === 0 && (
          <div className={styles.notice}>
            <Message tone="warning">
              Пока не указан ни один домен, виджет не будет работать: запросы с сайта получат отказ.
              Добавьте домен, на котором стоит код.
            </Message>
          </div>
        )}

        <ul className={styles.domains}>
          {domains.map((domain) => (
            <li className={styles.domain} key={domain}>
              {domain}
              <button
                className={styles.remove}
                type="button"
                aria-label={`Удалить ${domain}`}
                onClick={() => {
                  removeDomain(domain);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <form className={styles.addRow} onSubmit={handleAdd}>
          <input
            className={styles.input}
            name="domain"
            placeholder="example.com"
            aria-label="Новый домен"
            maxLength={253}
          />
          <button className={`${styles.button} ${styles.buttonSecondary}`} type="submit">
            Добавить
          </button>
        </form>

        {saveDomains.isError && (
          <div className={styles.notice}>
            <Message>{saveDomains.error.message}</Message>
          </div>
        )}

        <p className={styles.status} role="status">
          {saveDomains.isPending && 'Сохраняем…'}
          {saveDomains.isSuccess && 'Сохранено'}
        </p>
      </div>
    </section>
  );
};
