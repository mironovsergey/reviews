import { useEffect, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useSaveDomainsMutation, widgetQuery } from '../../queries/widget';
import { Loader } from '../loader/loader';
import { Message } from '../message/message';
import styles from './widget-card.module.css';

const COPIED_RESET_MS = 2000;

/** FormData.get() возвращает в том числе File, поэтому значение проверяется схемой. */
const DomainFieldSchema = z.string().trim().min(1);

/** Код для вставки на сайт и список разрешенных доменов. */
export const WidgetCard: FC = () => {
  const widget = useQuery(widgetQuery());
  const saveDomains = useSaveDomainsMutation();

  /** Черновик списка; передается на сервер по кнопке «Сохранить». */
  const [draft, setDraft] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => {
      setCopied(false);
    }, COPIED_RESET_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

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

  const domains = draft ?? widget.data.allowedDomains;
  const hasChanges = draft !== null;

  const handleCopy = (): void => {
    navigator.clipboard
      .writeText(widget.data.snippet)
      .then(() => {
        setCopied(true);
        setCopyFailed(false);
      })
      .catch(() => {
        setCopyFailed(true);
      });
  };

  const handleAdd = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const form = event.currentTarget;
    const parsed = DomainFieldSchema.safeParse(new FormData(form).get('domain'));

    if (!parsed.success || domains.includes(parsed.data)) {
      return;
    }

    setDraft([...domains, parsed.data]);
    saveDomains.reset();
    form.reset();
  };

  const removeDomain = (domain: string): void => {
    setDraft(domains.filter((item) => item !== domain));
    saveDomains.reset();
  };

  const handleSave = (): void => {
    saveDomains.mutate(domains, {
      onSuccess: () => {
        // Далее выводится результат нормализации, полученный от сервера.
        setDraft(null);
      },
    });
  };

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>Код для сайта</h2>
      <p className={styles.hint}>
        Вставьте этот код на страницу, где должны показываться отзывы. Ключ публичный — от чужого
        использования его защищает список доменов ниже.
      </p>

      <code className={styles.snippet}>{widget.data.snippet}</code>

      {copyFailed && (
        <div className={styles.notice}>
          <Message>Браузер не дал скопировать — выделите код вручную</Message>
        </div>
      )}

      <button
        className={`${styles.button} ${styles.buttonSecondary}`}
        type="button"
        onClick={handleCopy}
      >
        {copied ? 'Скопировано' : 'Скопировать код'}
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

        <div className={styles.actions}>
          <button
            className={styles.button}
            type="button"
            disabled={!hasChanges || saveDomains.isPending}
            onClick={handleSave}
          >
            {saveDomains.isPending ? 'Сохраняем…' : 'Сохранить домены'}
          </button>
          {saveDomains.isSuccess && !hasChanges && <Message tone="success">Сохранено</Message>}
        </div>
      </div>
    </section>
  );
};
