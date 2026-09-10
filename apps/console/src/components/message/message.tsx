import type { FC, ReactNode } from 'react';
import styles from './message.module.css';

type MessageTone = 'error' | 'warning' | 'info' | 'success';

interface MessageProps {
  tone?: MessageTone;
  children: ReactNode;
}

/** Плашка с сообщением: ошибка, предупреждение, подсказка или успех. */
export const Message: FC<MessageProps> = ({ tone = 'error', children }) => (
  <p className={`${styles.message} ${styles[tone]}`} role={tone === 'error' ? 'alert' : undefined}>
    {children}
  </p>
);
