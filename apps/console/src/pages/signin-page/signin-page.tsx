import type { FC } from 'react';
import { Link, Navigate } from 'react-router';
import { useSession } from '../../queries/auth';
import { AuthLayout } from '../../components/auth-layout/auth-layout';
import { SignInForm } from '../../components/signin-form/signin-form';
import { Loader } from '../../components/loader/loader';

/** Экран входа. Действующая сессия сразу уводит в консоль. */
export const SignInPage: FC = () => {
  const session = useSession();

  if (session.isChecking) {
    return <Loader text="Проверяем сессию…" />;
  }

  if (session.isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthLayout
      title="Вход"
      footer={
        <>
          Еще нет аккаунта? <Link to="/signup">Зарегистрироваться</Link>
        </>
      }
    >
      <SignInForm />
    </AuthLayout>
  );
};
