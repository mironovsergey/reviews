import type { FC } from 'react';
import { Link, Navigate } from 'react-router';
import { useSession } from '../../queries/auth';
import { AuthLayout } from '../../components/auth-layout/auth-layout';
import { SignUpForm } from '../../components/signup-form/signup-form';
import { Loader } from '../../components/loader/loader';

/** Экран регистрации: создает пользователя вместе с его кабинетом. */
export const SignUpPage: FC = () => {
  const session = useSession();

  if (session.isChecking) {
    return <Loader text="Проверяем сессию…" />;
  }

  if (session.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthLayout
      title="Регистрация"
      footer={
        <>
          Уже есть аккаунт? <Link to="/signin">Войти</Link>
        </>
      }
    >
      <SignUpForm />
    </AuthLayout>
  );
};
