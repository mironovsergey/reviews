import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { z } from 'zod';
import { useSignInMutation } from '../../queries/auth';
import { collectFieldErrors, type FieldErrors } from '../../utils/form-errors';
import { Message } from '../message/message';
import styles from '../../styles/form.module.css';

const SignInSchema = z.object({
  email: z.email('Введите корректный адрес почты'),
  password: z.string().min(1, 'Введите пароль'),
});

export const SignInForm: FC = () => {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const signIn = useSignInMutation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const parsed = SignInSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget).entries()),
    );

    if (!parsed.success) {
      setFieldErrors(collectFieldErrors(parsed.error));

      return;
    }

    setFieldErrors({});
    signIn.mutate(parsed.data);
  };

  return (
    <>
      {signIn.isError && (
        <div className={styles.notice}>
          <Message>{signIn.error.message}</Message>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <label className={styles.field}>
          <span className={styles.label}>Электронная почта</span>
          <input
            className={styles.input}
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
          />
          {fieldErrors.email !== undefined && (
            <span className={styles.fieldError}>{fieldErrors.email}</span>
          )}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Пароль</span>
          <input
            className={styles.input}
            type="password"
            name="password"
            autoComplete="current-password"
          />
          {fieldErrors.password !== undefined && (
            <span className={styles.fieldError}>{fieldErrors.password}</span>
          )}
        </label>

        <button
          className={`${styles.button} ${styles.buttonWide}`}
          type="submit"
          disabled={signIn.isPending}
        >
          {signIn.isPending ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </>
  );
};
