import type { FC } from 'react';
import { NavLink } from 'react-router';
import { useSignOut } from '../../queries/auth';
import type { CurrentUser } from '../../schemas/auth';
import styles from './header.module.css';

interface NavItem {
  to: string;
  label: string;
  /** Совпадение только по полному пути: иначе корень отмечался бы на любой странице. */
  end: boolean;
}

/** Разделы консоли в шапке. */
const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Обзор', end: true },
  { to: '/clinics', label: 'Клиники', end: false },
  { to: '/doctors', label: 'Врачи', end: false },
];

interface HeaderProps {
  user: CurrentUser;
}

/** Шапка консоли: кабинет, разделы и пользователь. */
export const Header: FC<HeaderProps> = ({ user }) => {
  const signOut = useSignOut();

  return (
    <header className={styles.header}>
      <span className={styles.workspace}>{user.workspaceName}</span>
      <nav aria-label="Разделы консоли">
        <ul className={styles.nav} role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              {/* NavLink сам отмечает текущий раздел атрибутом aria-current. */}
              <NavLink
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
                to={item.to}
                end={item.end}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <span className={styles.user}>
        {user.email}
        <button className={styles.signOut} type="button" onClick={signOut}>
          Выйти
        </button>
      </span>
    </header>
  );
};
