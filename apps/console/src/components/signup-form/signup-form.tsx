import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { z } from 'zod';
import { useSignUpMutation } from '../../queries/auth';
import { collectFieldErrors, type FieldErrors } from '../../utils/form-errors';
import { Message } from '../message/message';
import styles from '../../styles/form.module.css';

const SignUpSchema = z.object({
  email: z.email('Введите корректный адрес почты'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
  name: z.string().trim().min(1, 'Укажите ваше имя'),
  workspaceName: z.string().trim(),
});

export const SignUpForm: FC = () => {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const signUp = useSignUpMutation();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const parsed = SignUpSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget).entries()),
    );

    if (!parsed.success) {
      setFieldErrors(collectFieldErrors(parsed.error));

      return;
    }

    setFieldErrors({});
    signUp.mutate({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
      // Пустое название кабинета сервер заменяет именем пользователя.
      workspaceName: parsed.data.workspaceName.length > 0 ? parsed.data.workspaceName : undefined,
    });
  };

  return (
    <>
      {signUp.isError && (
        <div className={styles.notice}>
          <Message>{signUp.error.message}</Message>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <label className={styles.field}>
          <span className={styles.label}>Ваше имя</span>
          <input className={styles.input} name="name" autoComplete="name" maxLength={120} />
          {fieldErrors.name !== undefined && (
            <span className={styles.fieldError}>{fieldErrors.name}</span>
          )}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Название кабинета</span>
          <input
            className={styles.input}
            name="workspaceName"
            maxLength={120}
            placeholder="Например, «Доктор Плюс»"
          />
        </label>

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
            autoComplete="new-password"
          />
          {fieldErrors.password !== undefined && (
            <span className={styles.fieldError}>{fieldErrors.password}</span>
          )}
        </label>

        <button
          className={`${styles.button} ${styles.buttonWide}`}
          type="submit"
          disabled={signUp.isPending}
        >
          {signUp.isPending ? 'Создаем кабинет…' : 'Зарегистрироваться'}
        </button>
      </form>
    </>
  );
};
