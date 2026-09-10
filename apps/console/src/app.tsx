import type { FC } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { DashboardPage } from './pages/dashboard-page/dashboard-page';
import { SignInPage } from './pages/signin-page/signin-page';
import { SignUpPage } from './pages/signup-page/signup-page';

/** Таблица маршрутов: вход, регистрация и защищенная консоль. */
const App: FC = () => (
  <Routes>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/signin" element={<SignInPage />} />
    <Route path="/signup" element={<SignUpPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
