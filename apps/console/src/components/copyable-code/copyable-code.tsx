import type { FC } from 'react';
import { useCopyToClipboard } from '../../hooks/use-copy-to-clipboard';
import { Message } from '../message/message';
import formStyles from '../../styles/form.module.css';
import styles from './copyable-code.module.css';

interface CopyableCodeProps {
  /** Код, который выводится и копируется. */
  code: string;
}

/**
 * Блок кода с кнопкой копирования.
 *
 * Если браузер не дает записать в буфер обмена, над кнопкой появляется
 * просьба выделить код вручную: сам код при этом остается на виду.
 */
export const CopyableCode: FC<CopyableCodeProps> = ({ code }) => {
  const clipboard = useCopyToClipboard();

  return (
    <>
      <code className={styles.code}>{code}</code>

      {clipboard.status === 'failed' && (
        <div className={styles.notice}>
          <Message>Браузер не дал скопировать: выделите код вручную</Message>
        </div>
      )}

      <button
        className={`${formStyles.button} ${formStyles.buttonSecondary}`}
        type="button"
        onClick={() => {
          clipboard.copy(code);
        }}
      >
        {clipboard.status === 'copied' ? 'Скопировано' : 'Скопировать код'}
      </button>
    </>
  );
};
