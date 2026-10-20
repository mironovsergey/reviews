import type { FC } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { ConsoleLayout } from './components/console-layout/console-layout';
import { DashboardPage } from './pages/dashboard-page/dashboard-page';
import { SignInPage } from './pages/signin-page/signin-page';
import { SignUpPage } from './pages/signup-page/signup-page';

/**
 * Таблица маршрутов: вход, регистрация и разделы консоли.
 *
 * Разделы вложены в общий каркас, который проверяет сессию.
 */
const App: FC = () => (
  <Routes>
    <Route element={<ConsoleLayout />}>
      <Route path="/" element={<DashboardPage />} />
    </Route>
    <Route path="/signin" element={<SignInPage />} />
    <Route path="/signup" element={<SignUpPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
