import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { connectionQuery, useConnectMutation, useSyncMutation } from '../../queries/connection';
import type { ConnectionInfo } from '../../schemas/connection';
import { formatDate, formatDateTime, plural } from '../../utils/format';
import { Loader } from '../loader/loader';
import { Message } from '../message/message';
import cardStyles from '../../styles/card.module.css';
import styles from './connection-card.module.css';

const ConnectSchema = z.object({
  email: z.email('Введите корректный адрес почты'),
  password: z.string().min(1, 'Введите пароль'),
});

/** Привязка учетной записи агрегатора и состояние синхронизации. */
export const ConnectionCard: FC = () => {
  const connection = useQuery(connectionQuery());
  const connect = useConnectMutation();
  const sync = useSyncMutation();

  const [reconnecting, setReconnecting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (connection.isPending) {
    return (
      <section className={cardStyles.card}>
        <Loader text="Загружаем состояние подключения…" />
      </section>
    );
  }

  if (connection.isError) {
    return (
      <section className={cardStyles.card}>
        <Message>{connection.error.message}</Message>
      </section>
    );
  }

  const data: ConnectionInfo = connection.data;
  // Загрузку выполняет отдельный обработчик, поэтому принятый запрос для
  // пользователя ничем не отличается от начатого прогона.
  const running = data.syncState === 'running' || data.syncRequested;
  const showForm = !data.connected || reconnecting || data.status === 'needs_reauth';

  const handleConnect = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const form = event.currentTarget;
    const parsed = ConnectSchema.safeParse(Object.fromEntries(new FormData(form).entries()));

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Проверьте введенные данные');

      return;
    }

    setFormError(null);
    connect.mutate(parsed.data, {
      onSuccess: () => {
        setReconnecting(false);
        form.reset();
      },
    });
  };

  return (
    <section className={cardStyles.card}>
      <h2 className={cardStyles.title}>Аккаунт MyReviews</h2>
      <p className={cardStyles.hint}>
        {data.connected
          ? `Отзывы, клиники и врачи загружаются автоматически дважды в сутки. Всего ${plural(
              data.counts.reviews,
              ['отзыв', 'отзыва', 'отзывов'],
            )}.`
          : 'Подключите личный кабинет MyReviews. После этого мы загрузим клиники, врачей и отзывы.'}
      </p>

      {data.status === 'needs_reauth' && (
        <div className={styles.notice}>
          <Message tone="warning">
            Токен MyReviews больше не действует. Подключите аккаунт заново, иначе отзывы перестанут
            обновляться.
          </Message>
        </div>
      )}

      {data.status === 'error' && data.lastError !== null && (
        <div className={styles.notice}>
          <Message>Последняя синхронизация не удалась: {data.lastError}</Message>
        </div>
      )}

      {running && (
        <div className={styles.notice}>
          <Message tone="info">Идет синхронизация, это займет около минуты…</Message>
        </div>
      )}

      {data.connected && !reconnecting && (
        <>
          <div className={styles.account}>
            <span className={styles.email}>{data.email}</span>
            <button
              className={styles.link}
              type="button"
              onClick={() => {
                setReconnecting(true);
                setFormError(null);
              }}
            >
              Подключить другой аккаунт
            </button>
          </div>

          <dl className={styles.counts}>
            <div className={styles.count}>
              <dt className={styles.countLabel}>клиник</dt>
              <dd className={styles.countValue}>{data.counts.clinics}</dd>
            </div>
            <div className={styles.count}>
              <dt className={styles.countLabel}>врачей</dt>
              <dd className={styles.countValue}>{data.counts.doctors}</dd>
            </div>
            <div className={styles.count}>
              <dt className={styles.countLabel}>отзывов</dt>
              <dd className={styles.countValue}>{data.counts.reviews}</dd>
            </div>
          </dl>

          <div className={styles.meta}>
            <span>Последняя синхронизация: {formatDateTime(data.lastSyncFinishedAt)}</span>
            <span>Токен действует до: {formatDate(data.tokenExpiresAt)}</span>
          </div>

          {sync.isError && (
            <div className={styles.notice}>
              <Message>{sync.error.message}</Message>
            </div>
          )}

          <button
            className={styles.button}
            type="button"
            disabled={running || sync.isPending}
            onClick={() => {
              sync.mutate();
            }}
          >
            {running ? 'Синхронизация идет…' : 'Синхронизировать сейчас'}
          </button>
        </>
      )}

      {showForm && (
        <form onSubmit={handleConnect} noValidate>
          <label className={styles.field}>
            <span className={styles.label}>Электронная почта в MyReviews</span>
            <input className={styles.input} type="email" name="email" maxLength={254} />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Пароль от MyReviews</span>
            <input className={styles.input} type="password" name="password" maxLength={256} />
          </label>

          <p className={styles.formHint}>
            Пароль используется один раз, чтобы получить токен доступа, и не сохраняется. В базе
            хранится только зашифрованный токен.
          </p>

          {(formError !== null || connect.isError) && (
            <div className={styles.notice}>
              <Message>{formError ?? connect.error?.message}</Message>
            </div>
          )}

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={connect.isPending}>
              {connect.isPending ? 'Подключаем…' : 'Подключить'}
            </button>
            {reconnecting && (
              <button
                className={`${styles.button} ${styles.buttonSecondary}`}
                type="button"
                onClick={() => {
                  setReconnecting(false);
                  setFormError(null);
                }}
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
};
