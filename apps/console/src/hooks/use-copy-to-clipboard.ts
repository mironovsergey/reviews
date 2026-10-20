import { useEffect, useState } from 'react';

/** Отметка «скопировано» держится столько, затем кнопка возвращает подпись. */
const COPIED_RESET_MS = 2000;

/**
 * Состояние копирования: idle - копирования не было или отметка снята,
 * copied - текст только что скопирован, failed - браузер отказал.
 */
export type CopyStatus = 'idle' | 'copied' | 'failed';

/**
 * Копирование текста в буфер обмена с кратковременной отметкой успеха.
 *
 * Отказ браузера (нет разрешения, небезопасный источник) сохраняется до
 * следующей попытки: на это время интерфейс предлагает выделить текст
 * вручную.
 */
export const useCopyToClipboard = (): { status: CopyStatus; copy: (text: string) => void } => {
  const [status, setStatus] = useState<CopyStatus>('idle');

  useEffect(() => {
    if (status !== 'copied') {
      return;
    }

    const timer = setTimeout(() => {
      setStatus('idle');
    }, COPIED_RESET_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [status]);

  const copy = (text: string): void => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setStatus('copied');
      })
      .catch(() => {
        setStatus('failed');
      });
  };

  return { status, copy };
};
