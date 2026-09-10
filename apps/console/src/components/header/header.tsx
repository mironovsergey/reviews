import type { FC } from 'react';
import { useSignOut } from '../../queries/auth';
import type { CurrentUser } from '../../schemas/auth';
import styles from './header.module.css';

interface HeaderProps {
  user: CurrentUser;
}

export const Header: FC<HeaderProps> = ({ user }) => {
  const signOut = useSignOut();

  return (
    <header className={styles.header}>
      <span className={styles.workspace}>{user.workspaceName}</span>
      <span className={styles.user}>
        {user.email}
        <button className={styles.signOut} type="button" onClick={signOut}>
          Выйти
        </button>
      </span>
    </header>
  );
};
